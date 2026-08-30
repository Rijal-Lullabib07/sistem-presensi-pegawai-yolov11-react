import React from "react";
import { Routes, Route, NavLink, useLocation } from "react-router-dom";
import { motion, AnimatePresence, LayoutGroup } from "framer-motion";
import {
  Camera,
  Users,
  Clock,
  BarChart3,
  Settings,
  Menu,
  X,
  ScanFace,
} from "lucide-react";
import Dashboard from "./pages/Dashboard";
import Kamera from "./pages/Kamera";
import Pegawai from "./pages/Pegawai";
import Riwayat from "./pages/Riwayat";
import Pengaturan from "./pages/Pengaturan";

const navItems = [
  { path: "/", label: "Beranda", icon: BarChart3 },
  { path: "/kamera", label: "Kamera", icon: Camera },
  { path: "/pegawai", label: "Pegawai", icon: Users },
  { path: "/riwayat", label: "Riwayat", icon: Clock },
  { path: "/pengaturan", label: "Pengaturan", icon: Settings },
];

export default function App() {
  const [menuOpen, setMenuOpen] = React.useState(false);
  const location = useLocation();

  React.useEffect(() => {
    setMenuOpen(false);
  }, [location.pathname]);

  return (
    <div className="app">
      <style>{appStyles}</style>

      {/* ================= TOP HEADER ================= */}
      <header className="header app-header">
        <div className="app-header-scanline" />
        <div className="header-left">
          <motion.button
            whileTap={{ scale: 0.9 }}
            className="menu-btn"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Buka menu"
          >
            <AnimatePresence mode="wait" initial={false}>
              <motion.span
                key={menuOpen ? "close" : "open"}
                initial={{ opacity: 0, rotate: -90 }}
                animate={{ opacity: 1, rotate: 0 }}
                exit={{ opacity: 0, rotate: 90 }}
                transition={{ duration: 0.18 }}
                style={{ display: "flex" }}
              >
                {menuOpen ? <X size={22} /> : <Menu size={22} />}
              </motion.span>
            </AnimatePresence>
          </motion.button>
          <h1 className="header-title app-brand">
            <span className="app-brand-icon">
              <ScanFace size={20} />
            </span>
            Presensi
          </h1>
        </div>
        <div className="header-right app-clock-wrap">
          <span className="app-clock-dot" />
          <span className="header-clock">
            <LiveClock />
          </span>
        </div>
      </header>

      {/* ================= MOBILE OVERLAY ================= */}
      <AnimatePresence>
        {menuOpen && (
          <motion.div
            className="overlay"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            onClick={() => setMenuOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* ================= SIDEBAR ================= */}
      <motion.nav
        className={`sidebar app-sidebar ${menuOpen ? "open" : ""}`}
        animate={menuOpen ? { x: 0 } : undefined}
      >
        <div className="sidebar-brand app-sidebar-brand">
          <span className="sidebar-logo app-sidebar-logo">
            <ScanFace size={22} />
          </span>
          <div>
            <span className="sidebar-text">Presensi Pegawai</span>
            <div className="app-sidebar-sub">Face Recognition System</div>
          </div>
        </div>

        <LayoutGroup id="sidebar-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `nav-item app-nav-item ${isActive ? "active" : ""}`
              }
              end={item.path === "/"}
            >
              {({ isActive }) => (
                <>
                  {isActive && (
                    <motion.span
                      layoutId="sidebar-active-pill"
                      className="app-active-pill"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 32,
                      }}
                    />
                  )}
                  <span className="app-nav-content">
                    <item.icon size={20} />
                    <span>{item.label}</span>
                  </span>
                </>
              )}
            </NavLink>
          ))}
        </LayoutGroup>
      </motion.nav>

      {/* ================= MAIN CONTENT ================= */}
      <main className="main-content">
        <AnimatePresence mode="wait">
          <motion.div
            key={location.pathname}
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.25, ease: [0.22, 1, 0.36, 1] }}
          >
            <Routes location={location}>
              <Route path="/" element={<Dashboard />} />
              <Route path="/kamera" element={<Kamera />} />
              <Route path="/pegawai" element={<Pegawai />} />
              <Route path="/riwayat" element={<Riwayat />} />
              <Route path="/pengaturan" element={<Pengaturan />} />
            </Routes>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* ================= BOTTOM TAB BAR (MOBILE) ================= */}
      <nav className="bottom-nav app-bottom-nav">
        <LayoutGroup id="bottom-nav">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `bottom-nav-item app-bottom-item ${isActive ? "active" : ""}`
              }
              end={item.path === "/"}
            >
              {({ isActive }) => (
                <motion.span
                  className="app-bottom-inner"
                  animate={isActive ? { y: -2 } : { y: 0 }}
                  transition={{ type: "spring", stiffness: 400, damping: 25 }}
                >
                  <item.icon size={20} />
                  <span>{item.label}</span>
                  {isActive && (
                    <motion.span
                      layoutId="bottom-active-dot"
                      className="app-bottom-dot"
                      transition={{
                        type: "spring",
                        stiffness: 380,
                        damping: 32,
                      }}
                    />
                  )}
                </motion.span>
              )}
            </NavLink>
          ))}
        </LayoutGroup>
      </nav>
    </div>
  );
}

function LiveClock() {
  const [time, setTime] = React.useState(new Date());
  React.useEffect(() => {
    const timer = setInterval(() => setTime(new Date()), 1000);
    return () => clearInterval(timer);
  }, []);
  return (
    <>
      {time.toLocaleTimeString("id-ID", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
      })}
    </>
  );
}

// ============================================================
// Styles tambahan — konsisten dengan tema "scan/deteksi" Dashboard
// ============================================================
const appStyles = `
.app-header {
  position: relative;
  overflow: hidden;
  background: linear-gradient(135deg, #0f172a 0%, #1e293b 100%);
  border-bottom: 1px solid rgba(255,255,255,0.06);
  color: #f8fafc;
}
.app-header-scanline {
  position: absolute;
  top: 0; left: 0; right: 0; height: 2px;
  background: linear-gradient(90deg, transparent, #22c55e, transparent);
  animation: app-scan 4s linear infinite;
  opacity: 0.7;
}
@keyframes app-scan {
  0%, 100% { transform: translateX(-30%); }
  50% { transform: translateX(30%); }
}
.app-brand {
  display: flex;
  align-items: center;
  gap: 8px;
  color: #f8fafc;
}
.app-brand-icon {
  display: flex;
  align-items: center;
  justify-content: center;
  color: #22c55e;
}
.app-clock-wrap {
  display: flex;
  align-items: center;
  gap: 6px;
  color: #94a3b8;
  font-variant-numeric: tabular-nums;
}
.app-clock-dot {
  width: 7px; height: 7px;
  border-radius: 50%;
  background: #22c55e;
  box-shadow: 0 0 0 0 rgba(34,197,94,0.6);
  animation: app-dot-pulse 1.8s ease-out infinite;
}
@keyframes app-dot-pulse {
  0% { box-shadow: 0 0 0 0 rgba(34,197,94,0.5); }
  70% { box-shadow: 0 0 0 6px rgba(34,197,94,0); }
  100% { box-shadow: 0 0 0 0 rgba(34,197,94,0); }
}
.header-clock { color: #e2e8f0; font-weight: 600; }

.app-sidebar-brand { display: flex; align-items: center; gap: 10px; }
.app-sidebar-logo {
  display: flex; align-items: center; justify-content: center;
  width: 36px; height: 36px;
  border-radius: 10px;
  background: rgba(34,197,94,0.12);
  color: #22c55e;
}
.app-sidebar-sub {
  font-size: 11px;
  color: var(--text-secondary, #94a3b8);
  letter-spacing: 0.02em;
  margin-top: 1px;
}

.app-nav-item {
  position: relative;
  overflow: hidden;
  isolation: isolate;
}
.app-nav-content {
  position: relative;
  z-index: 1;
  display: flex;
  align-items: center;
  gap: 10px;
}
.app-active-pill {
  position: absolute;
  inset: 0;
  background: rgba(34,197,94,0.12);
  border-left: 3px solid #22c55e;
  border-radius: 8px;
  z-index: 0;
}

.app-bottom-item { position: relative; }
.app-bottom-inner {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  position: relative;
}
.app-bottom-dot {
  position: absolute;
  bottom: -8px;
  width: 4px; height: 4px;
  border-radius: 50%;
  background: #22c55e;
}

.menu-btn { transition: background 0.2s ease; }
.menu-btn:active { background: rgba(255,255,255,0.08); }

@media (prefers-reduced-motion: reduce) {
  .app-header-scanline, .app-clock-dot { animation: none; }
}
`;
