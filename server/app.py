import csv
import io
import json
import os
import sqlite3
from datetime import datetime
from pathlib import Path

import cv2
import numpy as np
from flask import Flask, Response, jsonify, request, send_file
from flask_cors import CORS

BASE_DIR = Path(__file__).resolve().parent
DATA_DIR = BASE_DIR / "data"
FACES_DIR = DATA_DIR / "faces"
SETTINGS_FILE = DATA_DIR / "settings.json"
DB_PATH = DATA_DIR / "presensi.db"
FACES_DIR.mkdir(parents=True, exist_ok=True)

DEFAULT_SETTINGS = {
    "masuk_mulai": "08:00",
    "masuk_batas": "08:15",
    "masuk_tutup": "09:00",
    "pulang_mulai": "17:00",
    "pulang_akhir": "22:00",
}

app = Flask(__name__)
CORS(app)


def get_db():
    connection = sqlite3.connect(DB_PATH)
    connection.row_factory = sqlite3.Row
    connection.execute("PRAGMA foreign_keys=ON")
    return connection


def init_db():
    with get_db() as connection:
        connection.executescript("""
            CREATE TABLE IF NOT EXISTS pegawai (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                nip TEXT UNIQUE NOT NULL,
                nama TEXT NOT NULL,
                departemen TEXT DEFAULT '',
                jabatan TEXT DEFAULT '',
                foto_path TEXT DEFAULT '',
                face_template BLOB,
                aktif INTEGER DEFAULT 1,
                created_at TEXT DEFAULT CURRENT_TIMESTAMP
            );
            CREATE TABLE IF NOT EXISTS presensi (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                pegawai_id INTEGER NOT NULL,
                tanggal TEXT NOT NULL,
                jam_masuk TEXT,
                jam_pulang TEXT,
                status_masuk TEXT DEFAULT '',
                status_pulang TEXT DEFAULT '',
                keterangan TEXT DEFAULT '',
                created_at TEXT DEFAULT CURRENT_TIMESTAMP,
                FOREIGN KEY (pegawai_id) REFERENCES pegawai(id) ON DELETE CASCADE
            );
        """)
        columns = {row[1] for row in connection.execute("PRAGMA table_info(pegawai)")}
        if "face_template" not in columns:
            connection.execute("ALTER TABLE pegawai ADD COLUMN face_template BLOB")


def extract_face_template(image):
    if image is None:
        return None
    gray = cv2.cvtColor(image, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, 1.1, 4)
    if len(faces) > 0:
        x, y, width, height = max(faces, key=lambda face: face[2] * face[3])
        gray = gray[y:y + height, x:x + width]
    gray = cv2.resize(gray, (96, 96)).astype(np.float32)
    gray = (gray - gray.mean()) / max(gray.std(), 1.0)
    buffer = io.BytesIO()
    np.save(buffer, gray, allow_pickle=False)
    return buffer.getvalue()


def template_from_blob(blob):
    if not blob:
        return None
    try:
        return np.load(io.BytesIO(bytes(blob)), allow_pickle=False)
    except (ValueError, OSError):
        return None


def load_face_templates():
    templates = []
    with get_db() as connection:
        rows = connection.execute(
            "SELECT id, nip, nama, foto_path, face_template FROM pegawai WHERE aktif=1"
        ).fetchall()
    for row in rows:
        template = template_from_blob(row["face_template"])
        if template is None and row["foto_path"] and Path(row["foto_path"]).is_file():
            template = extract_face_template(cv2.imread(row["foto_path"]))
            if template:
                with get_db() as connection:
                    connection.execute("UPDATE pegawai SET face_template=? WHERE id=?", (template, row["id"]))
                template = template_from_blob(template)
        if template is not None:
            templates.append({"id": row["id"], "nip": row["nip"], "nama": row["nama"], "template": template})
    return templates


def match_face(image, templates):
    probe_blob = extract_face_template(image)
    probe = template_from_blob(probe_blob)
    if probe is None:
        return None, 0.0
    best = None
    best_score = -1.0
    for person in templates:
        score = float(np.mean(probe * person["template"]))
        if score > best_score:
            best = person
            best_score = score
    return (best if best_score >= 0.45 else None), best_score


def apply_attendance_rules(person, detection):
    settings = load_settings()
    current_time = datetime.now().time()
    current_clock = now_time()

    def configured_time(key):
        return datetime.strptime(settings[key], "%H:%M").time()

    masuk_mulai = configured_time("masuk_mulai")
    masuk_batas = configured_time("masuk_batas")
    masuk_tutup = configured_time("masuk_tutup")
    pulang_mulai = configured_time("pulang_mulai")
    pulang_akhir = configured_time("pulang_akhir")

    with get_db() as connection:
        record = connection.execute(
            "SELECT jam_masuk, jam_pulang FROM presensi WHERE pegawai_id=? AND tanggal=?",
            (person["id"], today()),
        ).fetchone()

        if masuk_mulai <= current_time <= masuk_tutup:
            if record and record["jam_masuk"]:
                detection.update({
                    "time_status": "ALREADY.masuk",
                    "time_message": f"Sudah presensi masuk pada {record['jam_masuk']}",
                })
            else:
                status = "TEPAT WAKTU" if current_time <= masuk_batas else "TERLAMBAT"
                connection.execute(
                    "INSERT INTO presensi (pegawai_id, tanggal, jam_masuk, status_masuk) VALUES (?, ?, ?, ?)",
                    (person["id"], today(), current_clock, status),
                )
                detection["status"] = status
            return

        if pulang_mulai <= current_time <= pulang_akhir:
            if not record or not record["jam_masuk"]:
                detection.update({
                    "time_status": "BLOCKED.no_masuk",
                    "time_message": "Belum presensi masuk hari ini",
                })
            elif record["jam_pulang"]:
                detection.update({
                    "time_status": "ALREADY.pulang",
                    "time_message": f"Sudah presensi pulang pada {record['jam_pulang']}",
                })
            else:
                connection.execute(
                    "UPDATE presensi SET jam_pulang=?, status_pulang='PULANG VALID' WHERE pegawai_id=? AND tanggal=?",
                    (current_clock, person["id"], today()),
                )
                detection["status"] = "PULANG VALID"
            return

        if current_time < masuk_mulai:
            message = f"Belum waktunya presensi. Jam masuk mulai {settings['masuk_mulai']}"
        elif masuk_tutup < current_time < pulang_mulai:
            message = f"Di luar jam presensi. Presensi pulang mulai {settings['pulang_mulai']}"
        else:
            message = f"Jam presensi sudah ditutup. Batas pulang {settings['pulang_akhir']}"
        detection.update({"time_status": "BLOCKED.outside", "time_message": message})


def load_settings():
    try:
        with SETTINGS_FILE.open(encoding="utf-8") as settings_file:
            return {**DEFAULT_SETTINGS, **json.load(settings_file)}
    except (OSError, json.JSONDecodeError):
        return dict(DEFAULT_SETTINGS)


def save_settings(settings):
    with SETTINGS_FILE.open("w", encoding="utf-8") as settings_file:
        json.dump(settings, settings_file, indent=2)


def today():
    return datetime.now().strftime("%Y-%m-%d")


def now_time():
    return datetime.now().strftime("%H:%M:%S")


def row_data(row):
    return dict(row) if row else None


@app.get("/api/pegawai")
def get_pegawai():
    with get_db() as connection:
        rows = connection.execute(
            "SELECT id, nip, nama, departemen, jabatan, foto_path, aktif "
            "FROM pegawai WHERE aktif=1 ORDER BY nama"
        ).fetchall()
    return jsonify({"data": [row_data(row) for row in rows]})


@app.get("/api/pegawai/<int:pegawai_id>")
def get_pegawai_by_id(pegawai_id):
    with get_db() as connection:
        row = connection.execute("SELECT * FROM pegawai WHERE id=?", (pegawai_id,)).fetchone()
    if not row:
        return jsonify({"error": "Pegawai tidak ditemukan"}), 404
    return jsonify({"data": row_data(row)})


@app.get("/api/pegawai/<int:pegawai_id>/foto")
def get_foto(pegawai_id):
    with get_db() as connection:
        row = connection.execute("SELECT foto_path FROM pegawai WHERE id=?", (pegawai_id,)).fetchone()
    if row and row["foto_path"] and Path(row["foto_path"]).is_file():
        return send_file(row["foto_path"])
    return jsonify({"error": "Foto tidak ditemukan"}), 404


@app.post("/api/pegawai")
def tambah_pegawai():
    nip = request.form.get("nip", "").strip()
    nama = request.form.get("nama", "").strip()
    departemen = request.form.get("departemen", "").strip()
    jabatan = request.form.get("jabatan", "").strip()
    foto = request.files.get("foto")
    if not nip or not nama:
        return jsonify({"error": "NIP dan Nama harus diisi"}), 400

    foto_path = ""
    face_template = None
    if foto and foto.filename:
        foto_path = str(FACES_DIR / f"{nip}.jpg")
        foto.save(foto_path)
        face_template = extract_face_template(cv2.imread(foto_path))

    try:
        with get_db() as connection:
            connection.execute(
                "INSERT INTO pegawai (nip, nama, departemen, jabatan, foto_path, face_template) VALUES (?, ?, ?, ?, ?, ?)",
                (nip, nama, departemen, jabatan, foto_path, face_template),
            )
    except sqlite3.IntegrityError:
        return jsonify({"error": f"NIP {nip} sudah ada"}), 400
    return jsonify({"success": True, "message": f"Pegawai {nama} berhasil ditambahkan"})


@app.put("/api/pegawai/<int:pegawai_id>")
def update_pegawai(pegawai_id):
    with get_db() as connection:
        current = connection.execute("SELECT * FROM pegawai WHERE id=?", (pegawai_id,)).fetchone()
        if not current:
            return jsonify({"error": "Pegawai tidak ditemukan"}), 404
        fields = []
        values = []
        for field in ("nip", "nama", "departemen", "jabatan"):
            value = request.form.get(field)
            if value is not None:
                fields.append(f"{field}=?")
                values.append(value.strip())
        foto = request.files.get("foto")
        if foto and foto.filename:
            foto_path = str(FACES_DIR / f"{request.form.get('nip', current['nip'])}.jpg")
            foto.save(foto_path)
            fields.append("foto_path=?")
            values.append(foto_path)
            fields.append("face_template=?")
            values.append(extract_face_template(cv2.imread(foto_path)))
        if not fields:
            return jsonify({"error": "Tidak ada data yang diupdate"}), 400
        values.append(pegawai_id)
        try:
            connection.execute(f"UPDATE pegawai SET {', '.join(fields)} WHERE id=?", values)
        except sqlite3.IntegrityError:
            return jsonify({"error": "NIP sudah digunakan"}), 400
    return jsonify({"success": True, "message": "Pegawai berhasil diupdate"})


@app.delete("/api/pegawai/<int:pegawai_id>")
def hapus_pegawai(pegawai_id):
    with get_db() as connection:
        connection.execute("UPDATE pegawai SET aktif=0 WHERE id=?", (pegawai_id,))
    return jsonify({"success": True, "message": "Pegawai berhasil dihapus"})


@app.get("/api/presensi/hari-ini")
def presensi_hari_ini():
    with get_db() as connection:
        rows = connection.execute("""
            SELECT p.id, p.nama, p.nip, pr.jam_masuk, pr.status_masuk,
                   pr.jam_pulang, pr.status_pulang
            FROM pegawai p
            LEFT JOIN presensi pr ON pr.pegawai_id=p.id AND pr.tanggal=?
            WHERE p.aktif=1 ORDER BY pr.jam_masuk DESC, p.nama ASC
        """, (today(),)).fetchall()
    return jsonify({"data": [row_data(row) for row in rows if row["jam_masuk"]]})


@app.get("/api/presensi/riwayat")
def riwayat_presensi():
    tanggal = request.args.get("tanggal")
    query = """
        SELECT pr.*, p.nama, p.nip FROM presensi pr
        JOIN pegawai p ON p.id=pr.pegawai_id
    """
    params = ()
    if tanggal:
        query += " WHERE pr.tanggal=?"
        params = (tanggal,)
    query += " ORDER BY pr.tanggal DESC, pr.jam_masuk DESC LIMIT 500"
    with get_db() as connection:
        rows = connection.execute(query, params).fetchall()
    return jsonify({"data": [row_data(row) for row in rows]})


@app.post("/api/presensi/manual")
def presensi_manual():
    data = request.get_json(silent=True) or {}
    pegawai_id = data.get("pegawai_id")
    jam = data.get("jam", now_time())
    jenis = data.get("jenis", "masuk")
    if not pegawai_id:
        return jsonify({"error": "pegawai_id wajib diisi"}), 400
    with get_db() as connection:
        if jenis == "masuk":
            batas = load_settings()["masuk_batas"]
            status = "TEPAT WAKTU" if jam <= batas else "TERLAMBAT"
            connection.execute(
                "INSERT INTO presensi (pegawai_id, tanggal, jam_masuk, status_masuk) VALUES (?, ?, ?, ?)",
                (pegawai_id, today(), jam, status),
            )
        else:
            connection.execute(
                "UPDATE presensi SET jam_pulang=?, status_pulang='PULANG VALID' WHERE pegawai_id=? AND tanggal=?",
                (jam, pegawai_id, today()),
            )
    return jsonify({"success": True})


@app.get("/api/presensi/export")
def export_presensi():
    tanggal = request.args.get("tanggal")
    query = """
        SELECT pr.*, p.nama, p.nip, p.departemen FROM presensi pr
        JOIN pegawai p ON p.id=pr.pegawai_id
    """
    params = ()
    if tanggal:
        query += " WHERE pr.tanggal=?"
        params = (tanggal,)
    query += " ORDER BY pr.tanggal DESC, p.nama LIMIT 1000"
    with get_db() as connection:
        rows = connection.execute(query, params).fetchall()
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["Tanggal", "NIP", "Nama", "Departemen", "Jam Masuk", "Status Masuk", "Jam Pulang", "Status Pulang"])
    for row in rows:
        writer.writerow([row["tanggal"], row["nip"], row["nama"], row["departemen"], row["jam_masuk"] or "", row["status_masuk"] or "", row["jam_pulang"] or "", row["status_pulang"] or ""])
    return Response(output.getvalue(), mimetype="text/csv", headers={"Content-Disposition": f"attachment; filename=presensi_{tanggal or 'all'}.csv"})


@app.get("/api/statistik")
def statistik():
    with get_db() as connection:
        total = connection.execute("SELECT COUNT(*) FROM pegawai WHERE aktif=1").fetchone()[0]
        hadir = connection.execute("SELECT COUNT(*) FROM presensi WHERE tanggal=? AND jam_masuk IS NOT NULL", (today(),)).fetchone()[0]
        terlambat = connection.execute("SELECT COUNT(*) FROM presensi WHERE tanggal=? AND status_masuk='TERLAMBAT'", (today(),)).fetchone()[0]
    return jsonify({"total_pegawai": total, "hadir_hari_ini": hadir, "terlambat_hari_ini": terlambat, "belum_absen": max(0, total - hadir)})


@app.get("/api/settings")
def get_settings():
    return jsonify(load_settings())


@app.post("/api/settings")
def post_settings():
    data = request.get_json(silent=True) or {}
    settings = load_settings()
    settings.update({key: data[key] for key in DEFAULT_SETTINGS if key in data})
    save_settings(settings)
    return jsonify({"success": True, "message": "Settings saved"})


@app.post("/api/face/detect")
def face_detect():
    image = request.files.get("image")
    if not image:
        return jsonify({"error": "No image uploaded"}), 400
    frame = cv2.imdecode(np.frombuffer(image.read(), np.uint8), cv2.IMREAD_COLOR)
    if frame is None:
        return jsonify({"error": "Invalid image"}), 400
    gray = cv2.cvtColor(frame, cv2.COLOR_BGR2GRAY)
    cascade = cv2.CascadeClassifier(cv2.data.haarcascades + "haarcascade_frontalface_default.xml")
    faces = cascade.detectMultiScale(gray, 1.1, 4)
    templates = load_face_templates()
    detections = []
    for x, y, width, height in faces:
        person, score = match_face(frame[y:y + height, x:x + width], templates)
        detection = {
            "bbox": [int(x), int(y), int(x + width), int(y + height)],
            "nama": person["nama"] if person else "Tidak Dikenal",
            "nip": person["nip"] if person else None,
            "pegawai_id": person["id"] if person else None,
            "sim_score": max(0.0, score),
            "is_live": True,
            "jam": now_time(),
        }
        if person:
            apply_attendance_rules(person, detection)
        detections.append(detection)
    return jsonify({"detections": detections})


@app.post("/api/face/register")
def face_register():
    pegawai_id = request.form.get("pegawai_id")
    if not pegawai_id or "image" not in request.files:
        return jsonify({"error": "pegawai_id and image required"}), 400
    image = cv2.imdecode(np.frombuffer(request.files["image"].read(), np.uint8), cv2.IMREAD_COLOR)
    template = extract_face_template(image)
    if template is None:
        return jsonify({"error": "Wajah tidak ditemukan pada foto"}), 400
    with get_db() as connection:
        connection.execute("UPDATE pegawai SET face_template=? WHERE id=?", (template, int(pegawai_id)))
    return jsonify({"success": True, "message": "Foto wajah berhasil didaftarkan"})


@app.get("/api/face/status")
def face_status():
    with get_db() as connection:
        count = connection.execute("SELECT COUNT(*) FROM pegawai WHERE aktif=1").fetchone()[0]
    return jsonify({"engine_ready": True, "yolo_loaded": False, "facenet_loaded": False, "yolo_backend": "haar", "facenet_backend": "none", "pegawai_count": count, "encoding_count": 0})


init_db()

if __name__ == "__main__":
    print("Sistem Presensi Pegawai - Flask API Server")
    print("Backend: http://localhost:5000")
    app.run(host="0.0.0.0", port=5000, debug=True)
