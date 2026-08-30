import React, { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  UserPlus,
  Search,
  Edit3,
  Trash2,
  X,
  Camera,
  CheckCircle,
  Upload,
  ScanFace,
  RefreshCw,
} from "lucide-react";
import { useToast } from "../services/ToastContext";
import {
  getSemuaPegawai,
  tambahPegawai,
  updatePegawai,
  hapusPegawai,
} from "../services/api";

export default function Pegawai() {
  const [pegawais, setPegawais] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editData, setEditData] = useState(null);
  const [formData, setFormData] = useState({
    nip: "",
    nama: "",
    departemen: "",
    jabatan: "",
  });
  const [foto, setFoto] = useState(null);
  const [fotoPreview, setFotoPreview] = useState(null);
  const [saving, setSaving] = useState(false);
  const [cameraMode, setCameraMode] = useState(false);
  const [cameraReady, setCameraReady] = useState(false);
  const videoRef = useRef(null);
  const streamRef = useRef(null);
  const fileInputRef = useRef(null);
  const toast = useToast();

  useEffect(() => {
    loadPegawai();
    return () => stopCamera();
  }, []);

  // Cleanup camera when modal closes
  useEffect(() => {
    if (!showModal) {
      stopCamera();
      setCameraMode(false);
    }
  }, [showModal]);

  function stopCamera() {
    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    setCameraReady(false);
  }

  async function startCamera() {
    stopCamera();
    setCameraMode(true);
    try {
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        throw new Error("Browser tidak mendukung akses kamera");
      }
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
      });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }
      setCameraReady(true);
    } catch (e) {
      let msg = e.message || "";
      if (e.name === "NotAllowedError") msg = "Akses kamera ditolak.";
      else if (e.name === "NotFoundError") msg = "Tidak ada kamera yang terdeteksi.";
      toast.error("❌ Kamera tidak tersedia: " + msg, 5000);
      setCameraMode(false);
    }
  }

  function captureFromCamera() {
    if (!videoRef.current || !streamRef.current) return;
    const video = videoRef.current;
    const canvas = document.createElement("canvas");
    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0);
    canvas.toBlob(
      (blob) => {
        if (blob) {
          const file = new File([blob], "capture.jpg", { type: "image/jpeg" });
          setFoto(file);
          const url = URL.createObjectURL(blob);
          setFotoPreview(url);
          stopCamera();
          setCameraMode(false);
        }
      },
      "image/jpeg",
      0.9
    );
  }

  function closeCameraMode() {
    stopCamera();
    setCameraMode(false);
  }

  async function loadPegawai() {
    try {
      const res = await getSemuaPegawai();
      setPegawais(res.data || []);
    } catch (e) {
      toast.error("Gagal memuat data pegawai", 3000);
    } finally {
      setLoading(false);
    }
  }

  function openAdd() {
    setEditData(null);
    setFormData({ nip: "", nama: "", departemen: "", jabatan: "" });
    setFoto(null);
    setFotoPreview(null);
    setCameraMode(false);
    setShowModal(true);
  }

  function openEdit(peg) {
    setEditData(peg);
    setFormData({
      nip: peg.nip || "",
      nama: peg.nama || "",
      departemen: peg.departemen || "",
      jabatan: peg.jabatan || "",
    });
    setFoto(null);
    setFotoPreview(peg.foto_path ? `/api/pegawai/${peg.id}/foto` : null);
    setCameraMode(false);
    setShowModal(true);
  }

  function handleFotoChange(e) {
    const file = e.target.files[0];
    if (file) {
      setFoto(file);
      const reader = new FileReader();
      reader.onload = (ev) => setFotoPreview(ev.target.result);
      reader.readAsDataURL(file);
    }
  }

  async function handleSave() {
    if (!formData.nip || !formData.nama) {
      toast.warning("NIP dan Nama harus diisi", 3000);
      return;
    }
    setSaving(true);
    try {
      if (editData) {
        await updatePegawai(editData.id, { ...formData, foto });
        toast.success(`✅  ${formData.nama} berhasil diupdate`, 3000);
      } else {
        await tambahPegawai({ ...formData, foto });
        toast.success(`✅  ${formData.nama} berhasil ditambahkan`, 3000);
      }
      setShowModal(false);
      loadPegawai();
    } catch (e) {
      toast.error("❌  " + e.message, 5000);
    } finally {
      setSaving(false);
    }
  }

  async function handleDelete(peg) {
    if (!confirm(`Hapus pegawai "${peg.nama}"?`)) return;
    try {
      await hapusPegawai(peg.id);
      toast.success(`🗑️  ${peg.nama} berhasil dihapus`, 3000);
      loadPegawai();
    } catch (e) {
      toast.error("Gagal menghapus: " + e.message, 3000);
    }
  }

  const filtered = pegawais.filter(
    (p) =>
      p.nama?.toLowerCase().includes(search.toLowerCase()) ||
      p.nip?.includes(search) ||
      p.departemen?.toLowerCase().includes(search.toLowerCase()),
  );

  return (
    <div>
      <style>{pegawaiStyles}</style>

      <motion.div
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="page-header"
      >
        <div>
          <h2 className="page-title">👥 Manajemen Pegawai</h2>
          <p className="page-subtitle">
            <AnimatedCount value={pegawais.length} /> pegawai terdaftar
          </p>
        </div>
        <motion.button
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.96 }}
          className="btn btn-primary"
          onClick={openAdd}
        >
          <UserPlus size={16} /> Tambah Pegawai
        </motion.button>
      </motion.div>

      {/* Search */}
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.1 }}
        className="search-box pgw-search"
        style={{ marginBottom: 16 }}
      >
        <Search size={16} className="search-icon" />
        <input
          type="text"
          className="input"
          placeholder="Cari nama, NIP, atau departemen..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </motion.div>

      {/* Employee Grid */}
      <AnimatePresence mode="wait">
        {loading ? (
          <motion.div
            key="loading"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="loading-overlay"
          >
            <div className="spinner" />
            <span>Memuat data...</span>
          </motion.div>
        ) : filtered.length === 0 ? (
          <motion.div
            key="empty"
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0 }}
            className="empty-state"
          >
            <div className="empty-state-icon">👤</div>
            <div className="empty-state-title">
              {search ? "Tidak ditemukan" : "Belum ada pegawai"}
            </div>
            <div className="empty-state-desc">
              {search ? "Coba kata kunci lain" : "Tambahkan pegawai pertama"}
            </div>
            {!search && (
              <button className="btn btn-primary" onClick={openAdd}>
                <UserPlus size={16} /> Tambah Pegawai
              </button>
            )}
          </motion.div>
        ) : (
          <motion.div key="grid" className="emp-grid" layout>
            <AnimatePresence>
              {filtered.map((peg, i) => (
                <motion.div
                  key={peg.id}
                  layout
                  initial={{ opacity: 0, y: 14, scale: 0.97 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  transition={{ delay: Math.min(i * 0.04, 0.4), duration: 0.3 }}
                  whileHover={{ y: -3 }}
                  className="emp-card pgw-card"
                >
                  <div className="emp-avatar pgw-avatar">
                    {peg.foto_path ? (
                      <img src={`/api/pegawai/${peg.id}/foto`} alt={peg.nama} />
                    ) : (
                      peg.nama?.charAt(0)?.toUpperCase() || "?"
                    )}
                    <span className="pgw-avatar-ring" />
                  </div>
                  <div className="emp-info">
                    <div className="emp-name">{peg.nama}</div>
                    <div className="emp-detail">NIP: {peg.nip}</div>
                    <div className="emp-detail">
                      {peg.departemen || "—"}{" "}
                      {peg.jabatan ? `• ${peg.jabatan}` : ""}
                    </div>
                    <div className="emp-actions">
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        className="btn btn-primary"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        onClick={() => openEdit(peg)}
                      >
                        <Edit3 size={14} /> Edit
                      </motion.button>
                      <motion.button
                        whileTap={{ scale: 0.94 }}
                        className="btn btn-danger"
                        style={{ padding: "4px 10px", fontSize: 12 }}
                        onClick={() => handleDelete(peg)}
                      >
                        <Trash2 size={14} /> Hapus
                      </motion.button>
                    </div>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Modal */}
      <AnimatePresence>
        {showModal && (
          <motion.div
            className="modal-overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setShowModal(false)}
          >
            <motion.div
              className="modal"
              initial={{ opacity: 0, y: 24, scale: 0.96 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: 16, scale: 0.97 }}
              transition={{ type: "spring", stiffness: 320, damping: 28 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="modal-title">
                {editData ? "✏️ Edit Pegawai" : "➕ Tambah Pegawai"}
              </div>

              {/* Foto Wajah Section */}
              <div style={{ marginBottom: 16 }}>
                <label className="input-label" style={{ marginBottom: 8, display: "block" }}>
                  📸 Foto Wajah
                </label>

                {/* Preview area */}
                <div className="pgw-foto-preview">
                  {cameraMode ? (
                    /* Camera Live Preview */
                    <div className="pgw-camera-wrap">
                      <video
                        ref={videoRef}
                        className="pgw-camera-video"
                        playsInline
                        muted
                        style={{ display: cameraReady ? "block" : "none" }}
                      />
                      {!cameraReady && (
                        <div className="pgw-camera-placeholder">
                          <div className="spinner" style={{ width: 24, height: 24 }} />
                          <span>Menyiapkan kamera...</span>
                        </div>
                      )}
                      {cameraReady && (
                        <div className="pgw-camera-guide">
                          <div className="pgw-camera-guide-box" />
                        </div>
                      )}
                    </div>
                  ) : fotoPreview ? (
                    /* Show uploaded/captured photo */
                    <div className="pgw-foto-result">
                      <motion.img
                        src={fotoPreview}
                        alt="Preview"
                        className="pgw-foto-img"
                        initial={{ scale: 0.9, opacity: 0 }}
                        animate={{ scale: 1, opacity: 1 }}
                        transition={{ duration: 0.3 }}
                      />
                      <button
                        className="pgw-foto-remove"
                        onClick={() => {
                          setFoto(null);
                          setFotoPreview(null);
                        }}
                        title="Hapus foto"
                      >
                        <X size={14} />
                      </button>
                    </div>
                  ) : (
                    /* Placeholder */
                    <div className="pgw-foto-placeholder">
                      <ScanFace size={40} style={{ opacity: 0.25 }} />
                      <span>Belum ada foto</span>
                    </div>
                  )}
                </div>

                {/* Action buttons */}
                <div className="pgw-foto-actions">
                  {cameraMode ? (
                    <>
                      <motion.button
                        whileTap={{ scale: 0.95 }}
                        className="btn btn-success pgw-foto-btn"
                        onClick={captureFromCamera}
                        disabled={!cameraReady}
                      >
                        <Camera size={14} /> Ambil Foto
                      </motion.button>
                      <button
                        className="btn pgw-foto-btn"
                        onClick={closeCameraMode}
                      >
                        <X size={14} /> Batal
                      </button>
                    </>
                  ) : (
                    <>
                      <label className="btn btn-primary pgw-foto-btn">
                        <Upload size={14} /> Upload Foto
                        <input
                          ref={fileInputRef}
                          type="file"
                          accept="image/*"
                          onChange={handleFotoChange}
                          style={{ display: "none" }}
                        />
                      </label>
                      <button
                        className="btn btn-success pgw-foto-btn"
                        onClick={startCamera}
                      >
                        <Camera size={14} /> Ambil dari Kamera
                      </button>
                    </>
                  )}
                </div>
              </div>

              <div className="input-group" style={{ marginBottom: 12 }}>
                <label className="input-label">NIP *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Nomor Induk Pegawai"
                  value={formData.nip}
                  onChange={(e) =>
                    setFormData({ ...formData, nip: e.target.value })
                  }
                />
              </div>

              <div className="input-group" style={{ marginBottom: 12 }}>
                <label className="input-label">Nama Lengkap *</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Nama lengkap"
                  value={formData.nama}
                  onChange={(e) =>
                    setFormData({ ...formData, nama: e.target.value })
                  }
                />
              </div>

              <div className="input-group" style={{ marginBottom: 12 }}>
                <label className="input-label">Departemen</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Contoh: IT, HRD, Marketing"
                  value={formData.departemen}
                  onChange={(e) =>
                    setFormData({ ...formData, departemen: e.target.value })
                  }
                />
              </div>

              <div className="input-group" style={{ marginBottom: 16 }}>
                <label className="input-label">Jabatan</label>
                <input
                  type="text"
                  className="input"
                  placeholder="Contoh: Staff, Manager"
                  value={formData.jabatan}
                  onChange={(e) =>
                    setFormData({ ...formData, jabatan: e.target.value })
                  }
                />
              </div>

              <div className="modal-actions">
                <button className="btn" onClick={() => setShowModal(false)}>
                  Batal
                </button>
                <motion.button
                  whileTap={{ scale: 0.96 }}
                  className="btn btn-primary"
                  onClick={handleSave}
                  disabled={saving}
                >
                  {saving
                    ? "Menyimpan..."
                    : editData
                      ? "Simpan Perubahan"
                      : "Tambah Pegawai"}
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AnimatedCount({ value }) {
  const [display, setDisplay] = React.useState(0);
  React.useEffect(() => {
    const start = display;
    const end = value || 0;
    const startTime = performance.now();
    function tick(now) {
      const progress = Math.min((now - startTime) / 500, 1);
      setDisplay(Math.round(start + (end - start) * progress));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value]);
  return <>{display}</>;
}

const pegawaiStyles = `
.pgw-card {
  transition: box-shadow 0.2s ease, border-color 0.2s ease;
}
.pgw-card:hover {
  border-color: rgba(59,130,246,0.4);
  box-shadow: 0 10px 24px -10px rgba(59,130,246,0.25);
}
.pgw-avatar { position: relative; }
.pgw-avatar-ring {
  position: absolute;
  inset: -3px;
  border-radius: 50%;
  border: 2px solid rgba(34,197,94,0.35);
  pointer-events: none;
}
.pgw-search { transition: box-shadow 0.2s ease; border-radius: 10px; }
.pgw-search:focus-within { box-shadow: 0 0 0 3px rgba(59,130,246,0.15); }

/* Foto Wajah Section */
.pgw-foto-preview {
  width: 100%;
  max-width: 320px;
  margin: 0 auto 12px;
  aspect-ratio: 4/3;
  background: rgba(0,0,0,0.3);
  border-radius: 12px;
  overflow: hidden;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 2px dashed rgba(255,255,255,0.12);
}
.pgw-foto-placeholder {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 8px;
  color: var(--text-secondary, #94a3b8);
  font-size: 13px;
}
.pgw-foto-result {
  position: relative;
  width: 100%;
  height: 100%;
}
.pgw-foto-img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}
.pgw-foto-remove {
  position: absolute;
  top: 8px;
  right: 8px;
  width: 28px;
  height: 28px;
  border-radius: 50%;
  background: rgba(239,68,68,0.9);
  color: white;
  border: none;
  cursor: pointer;
  display: flex;
  align-items: center;
  justify-content: center;
  transition: transform 0.2s;
}
.pgw-foto-remove:hover {
  transform: scale(1.1);
}
.pgw-foto-actions {
  display: flex;
  gap: 8px;
  justify-content: center;
}
.pgw-foto-btn {
  font-size: 12px !important;
  padding: 6px 14px !important;
}

/* Camera */
.pgw-camera-wrap {
  position: relative;
  width: 100%;
  height: 100%;
  background: #000;
}
.pgw-camera-video {
  width: 100%;
  height: 100%;
  object-fit: cover;
  transform: scaleX(-1);
}
.pgw-camera-placeholder {
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  color: var(--text-secondary, #94a3b8);
  font-size: 13px;
}
.pgw-camera-guide {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}
.pgw-camera-guide-box {
  width: 120px;
  height: 150px;
  border: 3px dashed rgba(34,197,94,0.6);
  border-radius: 50%;
  animation: pgw-pulse 2s ease-in-out infinite;
}
@keyframes pgw-pulse {
  0%, 100% { border-color: rgba(34,197,94,0.4); }
  50% { border-color: rgba(34,197,94,0.8); }
}
`;
