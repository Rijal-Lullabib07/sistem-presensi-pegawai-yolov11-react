import React, { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import {
  Users,
  CheckCircle,
  Clock,
  AlertTriangle,
  Camera,
  Calendar,
  ScanFace,
} from "lucide-react";
import { getStatistik, getPresensiHariIni, getSettings } from "../services/api";

// ============================================================
// Animated counter — angka "menghitung naik" saat data masuk
// ============================================================
function AnimatedNumber({ value = 0, duration = 0.8 }) {
  const [display, setDisplay] = useState(0);
  const prevValue = useRef(0);

  useEffect(() => {
    const start = prevValue.current;
    const end = value || 0;
    const startTime = performance.now();

    function tick(now) {
      const progress = Math.min((now - startTime) / (duration * 1000), 1);
      const eased = 1 - Math.pow(1 - progress, 3); // ease-out-cubic
      setDisplay(Math.round(start + (end - start) * eased));
      if (progress < 1) requestAnimationFrame(tick);
    }
    requestAnimationFrame(tick);
    prevValue.current = end;
  }, [value, duration]);

  return <>{display}</>;
}

const cardVariants = {
  hidden: { opacity: 0, y: 16 },
  show: (i) => ({
    opacity: 1,
    y: 0,
    transition: { delay: i * 0.08, duration: 0.45, ease: [0.22, 1, 0.36, 1] },
  }),
};

export default function Dashboard() {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [presensi, setPresensi] = useState([]);
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [now, setNow] = useState(new Date());

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    loadData();
    const timer = setInterval(loadData, 30000);
    return () => clearInterval(timer);
  }, []);

  async function loadData() {
    try {
      const [s, p, st] = await Promise.all([
        getStatistik().catch(() => null),
        getPresensiHariIni().catch(() => ({ data: [] })),
        getSettings().catch(() => null),
      ]);
      setStats(s);
      setPresensi(p?.data || []);
      setSettings(st);
    } catch (e) {
      console.error("Load error:", e);
    } finally {
      setLoading(false);
    }
  }

  const scheduleStatus = getScheduleStatus(now, settings);

  const statCards = [
    {
      label: "Total Pegawai",
      value: stats?.total_pegawai || 0,
      icon: Users,
      color: "#3b82f6",
      glow: "rgba(59,130,246,.35)",
    },
    {
      label: "Hadir Hari Ini",
      value: stats?.hadir_hari_ini || 0,
      icon: CheckCircle,
      color: "#22c55e",
      glow: "rgba(34,197,94,.35)",
    },
    {
      label: "Terlambat",
      value: stats?.terlambat_hari_ini || 0,
      icon: Clock,
      color: "#eab308",
      glow: "rgba(234,179,8,.35)",
    },
    {
      label: "Belum Absen",
      value: stats?.belum_absen || 0,
      icon: AlertTriangle,
      color: "#ef4444",
      glow: "rgba(239,68,68,.35)",
    },
  ];

  return (
    <div style={{ position: "relative" }}>
      <style>{dashboardStyles}</style>

      {/* ================= HEADER ================= */}
      <motion.div
        initial={{ opacity: 0, y: -10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="dbx-header"
      >
        <div className="dbx-header-scanline" />
        <div className="dbx-header-content">
          <div>
            <div className="dbx-eyebrow">
              <ScanFace size={14} />
              <span>SISTEM PRESENSI · FACE RECOGNITION</span>
            </div>
            <h2 className="page-title" style={{ margin: "4px 0 2px" }}>
              Dashboard
            </h2>
            <p className="page-subtitle" style={{ margin: 0 }}>
              {now.toLocaleDateString("id-ID", {
                weekday: "long",
                year: "numeric",
                month: "long",
                day: "numeric",
              })}
              <span className="dbx-clock">
                {" "}
                · {now.toLocaleTimeString("id-ID", { hour12: false })}
              </span>
            </p>
          </div>
          <motion.button
            whileHover={{ scale: 1.04 }}
            whileTap={{ scale: 0.97 }}
            className="btn btn-primary dbx-cta"
            onClick={() => navigate("/kamera")}
          >
            <Camera size={16} /> Mulai Presensi
          </motion.button>
        </div>
      </motion.div>

      {/* ================= STAT GRID ================= */}
      <div className="stat-grid" style={{ marginBottom: 16, marginTop: 16 }}>
        {statCards.map((c, i) => {
          const Icon = c.icon;
          return (
            <motion.div
              key={c.label}
              custom={i}
              variants={cardVariants}
              initial="hidden"
              animate="show"
              whileHover={{ y: -4, boxShadow: `0 12px 28px -8px ${c.glow}` }}
              className="dbx-stat-card"
              style={{ "--accent": c.color }}
            >
              <div
                className="dbx-stat-icon"
                style={{ background: `${c.color}1a`, color: c.color }}
              >
                <Icon size={18} />
              </div>
              <div className="stat-value" style={{ color: c.color }}>
                <AnimatedNumber value={c.value} />
              </div>
              <div className="stat-label">{c.label}</div>
            </motion.div>
          );
        })}
      </div>

      {/* ================= SCHEDULE STATUS ================= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.4 }}
        className="card"
        style={{ marginBottom: 16 }}
      >
        <div className="card-title">
          <Clock size={16} /> Status Jadwal
        </div>
        {scheduleStatus.map((item, i) => (
          <motion.div
            key={i}
            initial={{ opacity: 0, x: -8 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: 0.25 + i * 0.08 }}
            className="schedule-row dbx-schedule-row"
          >
            <div className="schedule-icon">
              {item.statusClass === "ok" ? (
                <span
                  className="dbx-pulse-dot"
                  style={{ background: "#22c55e" }}
                />
              ) : (
                <span className="dbx-static-icon">{item.icon}</span>
              )}
            </div>
            <div className="schedule-info">
              <div className="schedule-label">{item.label}</div>
              <div className="schedule-time">{item.time}</div>
            </div>
            <span
              className={`schedule-status status-${item.statusClass} dbx-badge-anim`}
            >
              {item.status}
            </span>
          </motion.div>
        ))}
      </motion.div>

      {/* ================= TODAY'S ATTENDANCE ================= */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="card"
      >
        <div className="card-title">
          <Calendar size={16} /> Presensi Hari Ini
        </div>

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
          ) : presensi.length === 0 ? (
            <motion.div
              key="empty"
              initial={{ opacity: 0, scale: 0.98 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0 }}
              className="empty-state"
            >
              <div className="empty-state-icon">📋</div>
              <div className="empty-state-title">Belum ada presensi</div>
              <div className="empty-state-desc">
                Mulai presensi dengan mengaktifkan kamera
              </div>
              <button
                className="btn btn-primary"
                onClick={() => navigate("/kamera")}
              >
                <Camera size={16} /> Mulai Sekarang
              </button>
            </motion.div>
          ) : (
            <motion.div
              key="table"
              className="table-container"
              initial="hidden"
              animate="show"
            >
              <table className="table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama</th>
                    <th>NIP</th>
                    <th>Jam Masuk</th>
                    <th>Status</th>
                    <th>Jam Pulang</th>
                  </tr>
                </thead>
                <tbody>
                  {presensi.map((p, i) => (
                    <motion.tr
                      key={p.id || i}
                      custom={i}
                      variants={{
                        hidden: { opacity: 0, x: -12 },
                        show: (idx) => ({
                          opacity: 1,
                          x: 0,
                          transition: { delay: idx * 0.04, duration: 0.3 },
                        }),
                      }}
                      initial="hidden"
                      animate="show"
                      className="dbx-table-row"
                    >
                      <td>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{p.nama}</td>
                      <td style={{ color: "var(--text-secondary)" }}>
                        {p.nip}
                      </td>
                      <td>{p.jam_masuk || "—"}</td>
                      <td>
                        <span
                          className={`badge ${getStatusBadge(p.status_masuk)}`}
                        >
                          {p.status_masuk || "—"}
                        </span>
                      </td>
                      <td>{p.jam_pulang || "—"}</td>
                    </motion.tr>
                  ))}
                </tbody>
              </table>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </div>
  );
}

function getStatusBadge(status) {
  if (!status) return "badge-info";
  if (status.includes("TEPAT")) return "badge-success";
  if (status.includes("TERLAMBAT")) return "badge-warning";
  if (status.includes("PULANG")) return "badge-info";
  return "badge-info";
}

function getScheduleStatus(now, settings) {
  const mm = settings?.masuk_mulai || "08:00";
  const mb = settings?.masuk_batas || "08:15";
  const mt = settings?.masuk_tutup || "09:00";
  const pm = settings?.pulang_mulai || "17:00";
  const pa = settings?.pulang_akhir || "22:00";

  const t = now.toLocaleTimeString("sv-SE", { hour12: false }).slice(0, 5);

  const masukStatus =
    t < mm
      ? {
          status: "Belum dibuka",
          statusClass: "info",
          icon: "⏳",
          label: "Masuk Mulai",
          time: `${mm} - ${mb}`,
        }
      : t <= mb
        ? {
            status: "Tepat Waktu",
            statusClass: "ok",
            icon: "✅",
            label: "Masuk (Tepat Waktu)",
            time: `${mm} - ${mb}`,
          }
        : t <= mt
          ? {
              status: "Terlambat",
              statusClass: "warn",
              icon: "⚠️",
              label: "Masuk (Terlambat)",
              time: `${mb} - ${mt}`,
            }
          : {
              status: "Selesai",
              statusClass: "err",
              icon: "❌",
              label: "Masuk (Ditutup)",
              time: `${mm} - ${mt}`,
            };

  const pulangStatus =
    t < pm
      ? {
          status: "Belum dibuka",
          statusClass: "info",
          icon: "⏳",
          label: "Pulang",
          time: `${pm} - ${pa}`,
        }
      : t <= pa
        ? {
            status: "Aktif",
            statusClass: "ok",
            icon: "🏠",
            label: "Pulang (Aktif)",
            time: `${pm} - ${pa}`,
          }
        : {
            status: "Selesai",
            statusClass: "err",
            icon: "❌",
            label: "Pulang (Ditutup)",
            time: `${pm} - ${pa}`,
          };

  return [masukStatus, pulangStatus];
}

// ============================================================
// Styles tambahan — tema "scan/deteksi", formal & modern
// ============================================================
const dashboardStyles = `
.dbx-header {
  position: relative;
  overflow: hidden;
  border-radius: 14px;
  padding: 18px 20px;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border: 1px solid rgba(255,255,255,0.06);
}
.dbx-header-scanline {
  position: absolute;
  top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, #22c55e, transparent);
  animation: dbx-scan 3.5s linear infinite;
  opacity: 0.8;
}
@keyframes dbx-scan {
  0% { transform: translateY(0); }
  50% { transform: translateY(90px); }
  100% { transform: translateY(0); }
}
.dbx-header-content {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
  flex-wrap: wrap;
  position: relative;
  z-index: 1;
}
.dbx-eyebrow {
  display: inline-flex;
  align-items: center;
  gap: 6px;
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #22c55e;
}
.dbx-header .page-title { color: #f8fafc; }
.dbx-header .page-subtitle { color: #94a3b8; }
.dbx-clock {
  font-variant-numeric: tabular-nums;
  color: #22c55e;
  font-weight: 600;
}
.dbx-cta { white-space: nowrap; }

.dbx-stat-card {
  background: var(--card-bg, #fff);
  border: 1px solid var(--border-color, rgba(0,0,0,0.06));
  border-radius: 12px;
  padding: 16px;
  position: relative;
  overflow: hidden;
  transition: border-color 0.2s ease;
}
.dbx-stat-card::before {
  content: '';
  position: absolute;
  top: 0; left: 0; right: 0; height: 3px;
  background: var(--accent);
  opacity: 0.85;
}
.dbx-stat-card:hover { border-color: var(--accent); }
.dbx-stat-icon {
  width: 34px; height: 34px;
  border-radius: 9px;
  display: flex; align-items: center; justify-content: center;
  margin-bottom: 10px;
}

.dbx-schedule-row { transition: background 0.2s ease; border-radius: 8px; }
.dbx-schedule-row:hover { background: rgba(59,130,246,0.05); }

.dbx-pulse-dot {
  display: inline-block;
  width: 10px; height: 10px;
  border-radius: 50%;
  position: relative;
}
.dbx-pulse-dot::after {
  content: '';
  position: absolute;
  inset: -6px;
  border-radius: 50%;
  background: inherit;
  opacity: 0.5;
  animation: dbx-pulse 1.6s ease-out infinite;
}
@keyframes dbx-pulse {
  0% { transform: scale(0.6); opacity: 0.6; }
  100% { transform: scale(1.8); opacity: 0; }
}
.dbx-static-icon { font-size: 16px; }

.dbx-badge-anim { transition: transform 0.2s ease; }
.dbx-badge-anim:hover { transform: scale(1.05); }

.dbx-table-row { transition: background 0.15s ease; }
.dbx-table-row:hover { background: rgba(59,130,246,0.06); }

@media (prefers-reduced-motion: reduce) {
  .dbx-header-scanline, .dbx-pulse-dot::after { animation: none; }
}
`;
