import React, { useState, useEffect } from 'react'
import { Settings as SettingsIcon, Clock, Save, RotateCcw, CheckCircle } from 'lucide-react'
import { useToast } from '../services/ToastContext'
import { getSettings, updateSettings } from '../services/api'

const DEFAULTS = {
  masuk_mulai: '08:00',
  masuk_batas: '08:15',
  masuk_tutup: '09:00',
  pulang_mulai: '17:00',
  pulang_akhir: '22:00'
}

export default function Pengaturan() {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [now, setNow] = useState(new Date())
  const toast = useToast()

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  useEffect(() => {
    loadSettings()
  }, [])

  async function loadSettings() {
    try {
      const res = await getSettings()
      setSettings({ ...DEFAULTS, ...res })
    } catch (e) {
      console.error('Load settings error:', e)
    } finally {
      setLoading(false)
    }
  }

  async function handleSave() {
    // Validate times
    for (const [key, val] of Object.entries(settings)) {
      if (!/^\d{2}:\d{2}$/.test(val)) {
        toast.warning(`Format waktu salah: ${key} = "${val}"`, 3000)
        return
      }
    }

    setSaving(true)
    try {
      await updateSettings(settings)
      toast.success('✅  Pengaturan jam berhasil disimpan!', 3000)
    } catch (e) {
      toast.error('❌  Gagal menyimpan: ' + e.message, 3000)
    } finally {
      setSaving(false)
    }
  }

  function handleReset() {
    setSettings(DEFAULTS)
    toast.info('↺  Dikembalikan ke default (klik Simpan untuk menerapkan)', 3000)
  }

  const t = now.toLocaleTimeString('sv-SE', { hour12: false }).slice(0, 5)

  function getTimeStatus(key) {
    const val = settings[key]
    // Tepat Waktu: masuk_mulai – masuk_batas
    if (key === 'masuk_mulai') {
      if (t < settings.masuk_mulai) return { text: 'Belum dibuka', class: 'info' }
      if (t <= settings.masuk_batas) return { text: 'Aktif ✅', class: 'ok' }
      return { text: 'Selesai', class: 'err' }
    }
    // Batas tepat waktu
    if (key === 'masuk_batas') {
      if (t < settings.masuk_mulai) return { text: 'Belum dibuka', class: 'info' }
      if (t <= val) return { text: 'Aktif ✅', class: 'ok' }
      return { text: 'Selesai', class: 'err' }
    }
    // Terlambat: masuk_batas – masuk_tutup
    if (key === 'masuk_tutup') {
      if (t < settings.masuk_batas) return { text: 'Belum dibuka', class: 'info' }
      if (t <= val) return { text: 'Terlambat ⚠️', class: 'warn' }
      return { text: 'Selesai', class: 'err' }
    }
    // Pulang: pulang_mulai – pulang_akhir
    if (key === 'pulang_mulai') {
      if (t < settings.pulang_mulai) return { text: 'Belum dibuka', class: 'info' }
      if (t <= settings.pulang_akhir) return { text: 'Aktif 🏠', class: 'ok' }
      return { text: 'Selesai', class: 'err' }
    }
    if (key === 'pulang_akhir') {
      if (t < settings.pulang_mulai) return { text: 'Belum dibuka', class: 'info' }
      if (t <= val) return { text: 'Aktif 🏠', class: 'ok' }
      return { text: 'Selesai', class: 'err' }
    }
    return { text: '', class: 'info' }
  }

  if (loading) {
    return (
      <div className="loading-overlay" style={{ height: '60vh' }}>
        <div className="spinner" />
        <span>Memuat pengaturan...</span>
      </div>
    )
  }

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">⚙️ Pengaturan Jam</h2>
          <p className="page-subtitle">Atur batas waktu presensi masuk dan pulang</p>
        </div>
      </div>

      {/* Current Time */}
      <div className="card" style={{ textAlign: 'center', marginBottom: 16 }}>
        <div style={{ fontSize: 36, fontWeight: 700, fontVariantNumeric: 'tabular-nums', color: 'var(--accent-blue)' }}>
          {now.toLocaleTimeString('id-ID', { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
        </div>
        <div style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
          {now.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>
      </div>

      {/* Preview */}
      <div className="card" style={{ marginBottom: 16, padding: '12px 16px' }}>
        <div className="schedule-row">
          <div className="schedule-icon">✅</div>
          <div className="schedule-info">
            <div className="schedule-label">Tepat Waktu</div>
            <div className="schedule-time">{settings.masuk_mulai} – {settings.masuk_batas}</div>
          </div>
          <span className={`schedule-status status-${getTimeStatus('masuk_mulai').class}`}>
            {getTimeStatus('masuk_mulai').text}
          </span>
        </div>
        <div className="schedule-row">
          <div className="schedule-icon">⚠️</div>
          <div className="schedule-info">
            <div className="schedule-label">Terlambat</div>
            <div className="schedule-time">{settings.masuk_batas} – {settings.masuk_tutup}</div>
          </div>
          <span className={`schedule-status status-${getTimeStatus('masuk_tutup').class}`}>
            {getTimeStatus('masuk_tutup').text}
          </span>
        </div>
        <div className="schedule-row">
          <div className="schedule-icon">🏠</div>
          <div className="schedule-info">
            <div className="schedule-label">Pulang Valid</div>
            <div className="schedule-time">{settings.pulang_mulai} – {settings.pulang_akhir}</div>
          </div>
          <span className={`schedule-status status-${getTimeStatus('pulang_mulai').class}`}>
            {getTimeStatus('pulang_mulai').text}
          </span>
        </div>
      </div>

      {/* Time Settings */}
      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"><Clock size={16} /> Jam Masuk</div>
        
        <div className="input-group" style={{ marginBottom: 12 }}>
          <label className="input-label">Mulai absen masuk</label>
          <input
            type="time"
            className="input"
            value={settings.masuk_mulai}
            onChange={e => setSettings({ ...settings, masuk_mulai: e.target.value })}
          />
        </div>

        <div className="input-group" style={{ marginBottom: 12 }}>
          <label className="input-label">Batas tepat waktu ✅</label>
          <input
            type="time"
            className="input"
            value={settings.masuk_batas}
            onChange={e => setSettings({ ...settings, masuk_batas: e.target.value })}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Tutup absen masuk (terlambat) ⚠️</label>
          <input
            type="time"
            className="input"
            value={settings.masuk_tutup}
            onChange={e => setSettings({ ...settings, masuk_tutup: e.target.value })}
          />
        </div>
      </div>

      <div className="card" style={{ marginBottom: 16 }}>
        <div className="card-title"><Clock size={16} /> Jam Pulang</div>
        
        <div className="input-group" style={{ marginBottom: 12 }}>
          <label className="input-label">Mulai absen pulang 🏠</label>
          <input
            type="time"
            className="input"
            value={settings.pulang_mulai}
            onChange={e => setSettings({ ...settings, pulang_mulai: e.target.value })}
          />
        </div>

        <div className="input-group">
          <label className="input-label">Batas absen pulang</label>
          <input
            type="time"
            className="input"
            value={settings.pulang_akhir}
            onChange={e => setSettings({ ...settings, pulang_akhir: e.target.value })}
          />
        </div>
      </div>

      {/* Action Buttons */}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" onClick={handleReset} style={{ flex: 1 }}>
          <RotateCcw size={16} /> Reset Default
        </button>
        <button className="btn btn-primary" onClick={handleSave} disabled={saving} style={{ flex: 2 }}>
          {saving ? 'Menyimpan...' : <><Save size={16} /> Simpan Pengaturan</>}
        </button>
      </div>

      {/* Info */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">💡 Informasi</div>
        <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8 }}>
          <li>Perubahan jam langsung aktif tanpa restart</li>
          <li>Pegawai yang hadir dalam rentang "Tepat Waktu" tidak akan dikenai penalty</li>
          <li>Pegawai yang hadir dalam rentang "Terlambat" akan ditandai sebagai terlambat</li>
          <li>Pegawai harus sudah absen masuk sebelum bisa absen pulang</li>
        </ul>
      </div>
    </div>
  )
}
