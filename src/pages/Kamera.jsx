import React, { useRef, useState, useEffect, useCallback } from 'react'
import { Camera as CameraIcon, Play, Square, RefreshCw, UserPlus, Upload, ShieldAlert } from 'lucide-react'
import { useToast } from '../services/ToastContext'
import { detectFace, getCameraStatus, startCamera, stopCamera } from '../services/api'

export default function Kamera() {
  const videoRef = useRef(null)
  const canvasRef = useRef(null)
  const streamRef = useRef(null)
  const animFrameRef = useRef(null)
  const cooldownRef = useRef({})
  const fileInputRef = useRef(null)

  const [isActive, setIsActive] = useState(false)
  const [loading, setLoading] = useState(false)
  const [detections, setDetections] = useState([])
  const [faceCount, setFaceCount] = useState(0)
  const [serverStatus, setServerStatus] = useState('unknown')
  const [lastResult, setLastResult] = useState(null)
  const toast = useToast()

  // Check server status on mount
  useEffect(() => {
    checkServer()
    return () => stopStream()
  }, [])

  async function checkServer() {
    try {
      const res = await getCameraStatus()
      setServerStatus(res.engine_ready ? 'ready' : 'no_model')
    } catch {
      setServerStatus('offline')
    }
  }

  async function startStream() {
    setLoading(true)
    try {
      // Cek apakah browser mendukung akses kamera
      if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
        const isSecure = window.isSecureContext
        const isLocalhost = location.hostname === 'localhost' || location.hostname === '127.0.0.1'
        if (!isSecure && !isLocalhost) {
          throw new Error('Koneksi tidak aman (HTTP). Kamera memerlukan HTTPS atau akses via localhost.')
        }
        throw new Error('Browser tidak mendukung akses kamera (getUserMedia). Gunakan browser modern (Chrome/Firefox/Safari).')
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } }
      })
      streamRef.current = stream
      if (videoRef.current) {
        videoRef.current.srcObject = stream
        await videoRef.current.play()
      }
      setIsActive(true)
      toast.success('▶  Kamera aktif — Mulai deteksi wajah', 3000)
      startDetectionLoop()
    } catch (e) {
      let msg = e.message || ''
      if (e.name === 'NotAllowedError') {
        msg = 'Akses kamera ditolak. Berikan izin kamera di browser (klik ikon 🔒 di address bar).'
      } else if (e.name === 'NotFoundError') {
        msg = 'Tidak ada kamera yang terdeteksi pada perangkat ini. Hubungkan kamera lalu coba lagi.'
      } else if (e.name === 'NotReadableError') {
        msg = 'Kamera sedang digunakan oleh aplikasi lain. Tutup aplikasi lain yang menggunakan kamera.'
      } else if (e.name === 'OverconstrainedError') {
        msg = 'Kamera tidak mendukung resolusi yang diminta.'
      } else if (msg.includes('HTTP') || msg.includes('HTTPS') || msg.includes('aman')) {
        msg = 'Koneksi tidak aman (HTTP). Kamera memerlukan HTTPS atau akses via localhost.'
      }
      toast.error('❌  Kamera tidak tersedia:\n' + msg, 8000)
    } finally {
      setLoading(false)
    }
  }

  const detectionLoopActiveRef = useRef(null)

  function stopStream() {
    // Stop detection loop
    if (detectionLoopActiveRef.current) {
      detectionLoopActiveRef.current.current = false
      detectionLoopActiveRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (animFrameRef.current) {
      cancelAnimationFrame(animFrameRef.current)
      animFrameRef.current = null
    }
    setIsActive(false)
    setDetections([])
    setFaceCount(0)
  }

  async function startDetectionLoop() {
    const isActiveRef = { current: true }
    detectionLoopActiveRef.current = isActiveRef

    const loop = async () => {
      if (!isActiveRef.current) return
      if (!videoRef.current || !streamRef.current) return
      
      const video = videoRef.current
      if (video.readyState < 2) {
        animFrameRef.current = requestAnimationFrame(loop)
        return
      }

      try {
        const canvas = document.createElement('canvas')
        canvas.width = video.videoWidth
        canvas.height = video.videoHeight
        const ctx = canvas.getContext('2d')
        ctx.drawImage(video, 0, 0)
        
        const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/jpeg', 0.7))
        if (!blob) {
          animFrameRef.current = requestAnimationFrame(loop)
          return
        }

        const result = await detectFace(blob)
        
        if (result.detections && result.detections.length > 0) {
          setDetections(result.detections)
          setFaceCount(result.detections.length)
          
          // Process auto attendance
          for (const det of result.detections) {
            if (det.pegawai_id && det.nama !== 'Tidak Dikenal') {
              const nip = det.nip || det.pegawai_id
              const now = Date.now()
              // Cooldown: 10s for success, 5s for blocked/already (don't spam)
              const cooldownMs = (det.time_status && det.time_status.startsWith('BLOCKED.')) ||
                                 (det.time_status && det.time_status.startsWith('ALREADY.')) ? 5000 : 10000
              if (!cooldownRef.current[nip] || now - cooldownRef.current[nip] > cooldownMs) {
                cooldownRef.current[nip] = now
                handleAttendanceResult(det)
              }
            }
          }
        } else {
          setFaceCount(0)
        }

        // Draw on canvas
        if (canvasRef.current && videoRef.current) {
          const displayCanvas = canvasRef.current
          displayCanvas.width = video.videoWidth
          displayCanvas.height = video.videoHeight
          const displayCtx = displayCanvas.getContext('2d')
          displayCtx.drawImage(video, 0, 0)
          drawDetections(displayCtx, result.detections || [], video.videoWidth, video.videoHeight)
        }
      } catch (e) {
        // Silently continue on detection errors
      }
      
      if (isActiveRef.current) {
        animFrameRef.current = requestAnimationFrame(loop)
      }
    }

    loop()
  }

  function handleAttendanceResult(det) {
    const isSpoof = det.is_live === false
    const accuracy = det.sim_score ? ((det.sim_score) * 100).toFixed(1) : null
    const timeStatus = det.time_status || null
    const timeMessage = det.time_message || ''

    // --- Spoof detected ---
    if (isSpoof) {
      toast.error(`🔴  ${det.nama}\nDETEKSI SPOOF! Wajah tidak asli.`, 5000)
      setLastResult({ type: 'error', name: det.nama, message: 'Spoof detected', accuracy })
      return
    }

    // --- Attendance blocked due to time ---
    if (timeStatus && timeStatus.startsWith('BLOCKED.')) {
      toast.warning(`⛔  ${det.nama}\nPresensi ditolak:\n${timeMessage}`, 6000)
      setLastResult({ type: 'blocked', name: det.nama, message: timeMessage, accuracy })
      return
    }

    // --- Already attended ---
    if (timeStatus && timeStatus.startsWith('ALREADY.')) {
      toast.info(`ℹ️  ${det.nama}\n${timeMessage}`, 4000)
      setLastResult({ type: 'info', name: det.nama, message: timeMessage, accuracy })
      return
    }

    // --- Attendance success ---
    if (det.status === 'PULANG VALID') {
      toast.pulang(`🏠  ${det.nama}\nPULANG VALID\n🕐 ${det.jam || ''}\n🎯 Akurasi: ${accuracy || '-'}%`, 5500)
      setLastResult({ type: 'pulang', name: det.nama, accuracy })
    } else if (det.status === 'TERLAMBAT') {
      toast.warning(`⚠️  ${det.nama}\nMASUK — TERLAMBAT\n🕐 ${det.jam || ''}\n🎯 Akurasi: ${accuracy || '-'}%`, 5500)
      setLastResult({ type: 'warning', name: det.nama, accuracy })
    } else if (det.status === 'TEPAT WAKTU') {
      toast.success(`✅  ${det.nama}\nMASUK — TEPAT WAKTU\n🕐 ${det.jam || ''}\n🎯 Akurasi: ${accuracy || '-'}%`, 5500)
      setLastResult({ type: 'success', name: det.nama, accuracy })
    }
  }

  function drawDetections(ctx, dets, w, h) {
    // Scale factor if canvas display size differs from internal resolution
    const dpr = 1

    for (const det of dets) {
      if (!det.bbox) continue
      const [x1, y1, x2, y2] = det.bbox
      const isKnown = det.nama && det.nama !== 'Tidak Dikenal'
      const accuracy = det.sim_score ? (det.sim_score * 100).toFixed(0) : null

      // --- Bounding box (rounded) ---
      const radius = 8
      const bw = x2 - x1
      const bh = y2 - y1
      ctx.beginPath()
      ctx.moveTo(x1 + radius, y1)
      ctx.lineTo(x1 + bw - radius, y1)
      ctx.quadraticCurveTo(x1 + bw, y1, x1 + bw, y1 + radius)
      ctx.lineTo(x1 + bw, y1 + bh - radius)
      ctx.quadraticCurveTo(x1 + bw, y1 + bh, x1 + bw - radius, y1 + bh)
      ctx.lineTo(x1 + radius, y1 + bh)
      ctx.quadraticCurveTo(x1, y1 + bh, x1, y1 + bh - radius)
      ctx.lineTo(x1, y1 + radius)
      ctx.quadraticCurveTo(x1, y1, x1 + radius, y1)
      ctx.closePath()

      // Glow effect
      ctx.shadowColor = isKnown ? '#3fb950' : '#f85149'
      ctx.shadowBlur = 8
      ctx.strokeStyle = isKnown ? '#3fb950' : '#f85149'
      ctx.lineWidth = 3
      ctx.stroke()
      ctx.shadowBlur = 0

      // --- Label background ---
      const displayName = isKnown ? det.nama : 'Unknown'
      const accText = accuracy ? `  ${accuracy}%` : ''
      const labelText = displayName + accText

      ctx.font = 'bold 14px "Segoe UI", sans-serif'
      const textW = ctx.measureText(labelText).width
      const labelW = Math.max(textW + 16, 80)
      const labelH = 26
      const labelY = y1 - labelH - 4

      // Rounded label background
      const lr = 6
      ctx.beginPath()
      ctx.moveTo(x1 + lr, labelY)
      ctx.lineTo(x1 + labelW - lr, labelY)
      ctx.quadraticCurveTo(x1 + labelW, labelY, x1 + labelW, labelY + lr)
      ctx.lineTo(x1 + labelW, labelY + labelH - lr)
      ctx.quadraticCurveTo(x1 + labelW, labelY + labelH, x1 + labelW - lr, labelY + labelH)
      ctx.lineTo(x1 + lr, labelY + labelH)
      ctx.quadraticCurveTo(x1, labelY + labelH, x1, labelY + labelH - lr)
      ctx.lineTo(x1, labelY + lr)
      ctx.quadraticCurveTo(x1, labelY, x1 + lr, labelY)
      ctx.closePath()
      ctx.fillStyle = isKnown ? 'rgba(46, 160, 67, 0.92)' : 'rgba(248, 81, 73, 0.92)'
      ctx.fill()

      // --- Label text ---
      ctx.fillStyle = '#fff'
      ctx.font = 'bold 13px "Segoe UI", sans-serif'
      ctx.fillText(labelText, x1 + 8, labelY + 18)

      // --- Accuracy bar under bounding box ---
      if (accuracy) {
        const barY = y2 + 6
        const barW = bw
        const barH = 6

        // Background bar
        ctx.fillStyle = 'rgba(255,255,255,0.15)'
        ctx.beginPath()
        ctx.roundRect(x1, barY, barW, barH, 3)
        ctx.fill()

        // Filled bar
        const fillW = (det.sim_score || 0) * barW
        const barColor = det.sim_score >= 0.7 ? '#3fb950' : det.sim_score >= 0.5 ? '#d29922' : '#f85149'
        ctx.fillStyle = barColor
        ctx.beginPath()
        ctx.roundRect(x1, barY, Math.max(fillW, 2), barH, 3)
        ctx.fill()
      }
    }
  }

  // Fallback: upload foto jika kamera tidak tersedia
  async function handleFileUpload(e) {
    const file = e.target.files?.[0]
    if (!file) return

    setLoading(true)
    try {
      const result = await detectFace(file)
      if (result.detections && result.detections.length > 0) {
        setDetections(result.detections)
        setFaceCount(result.detections.length)
        // Process auto attendance
        for (const det of result.detections) {
          if (det.pegawai_id && det.nama !== 'Tidak Dikenal') {
            const nip = det.nip || det.pegawai_id
            const now = Date.now()
            const cooldownMs = (det.time_status && det.time_status.startsWith('BLOCKED.')) ||
                               (det.time_status && det.time_status.startsWith('ALREADY.')) ? 5000 : 10000
            if (!cooldownRef.current[nip] || now - cooldownRef.current[nip] > cooldownMs) {
              cooldownRef.current[nip] = now
              handleAttendanceResult(det)
            }
          }
        }
        // Draw on canvas
        if (canvasRef.current) {
          const img = new Image()
          img.onload = () => {
            canvasRef.current.width = img.width
            canvasRef.current.height = img.height
            const ctx = canvasRef.current.getContext('2d')
            ctx.drawImage(img, 0, 0)
            drawDetections(ctx, result.detections || [], img.width, img.height)
          }
          img.src = URL.createObjectURL(file)
        }
        toast.success('✅  Foto berhasil diproses — ' + result.detections.length + ' wajah terdeteksi', 3000)
      } else {
        toast.warning('⚠️  Tidak ada wajah terdeteksi dari foto yang diupload', 3000)
      }
    } catch (err) {
      toast.error('❌  Gagal memproses foto: ' + err.message, 5000)
    } finally {
      setLoading(false)
      if (fileInputRef.current) fileInputRef.current.value = ''
    }
  }

  // Cek apakah kamera tersedia di browser ini
  const cameraSupported = typeof navigator !== 'undefined' && navigator.mediaDevices && navigator.mediaDevices.getUserMedia
  const isSecureContext = typeof window !== 'undefined' && window.isSecureContext
  const isLocalhost = typeof location !== 'undefined' && (location.hostname === 'localhost' || location.hostname === '127.0.0.1')
  const canAccessCamera = cameraSupported && (isSecureContext || isLocalhost)

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">📷 Deteksi Wajah</h2>
          <p className="page-subtitle">
            {serverStatus === 'ready' ? '✅ Server deteksi siap' :
             serverStatus === 'no_model' ? '⚠️ Model belum dimuat' :
             '❌ Server offline'}
          </p>
        </div>
      </div>

      {/* Camera Feed */}
      <div className="camera-container" style={{ marginBottom: 16 }}>
        <video
          ref={videoRef}
          className="camera-video"
          style={{ display: isActive ? 'block' : 'none' }}
          playsInline
          muted
        />
        <canvas
          ref={canvasRef}
          className="camera-video"
          style={{ display: isActive ? 'block' : 'none', position: 'absolute', inset: 0 }}
        />
        {!isActive && (
          <div className="camera-placeholder">
            <CameraIcon size={48} style={{ marginBottom: 12, opacity: 0.3 }} />
            <div>📷 Klik "Mulai" untuk mengaktifkan kamera</div>
          </div>
        )}
        <span className={`camera-badge ${isActive ? 'active' : 'inactive'}`}>
          {isActive ? '🟢 AKTIF' : '● SIAP'}
        </span>
        {isActive && faceCount > 0 && (
          <div className="camera-info">
            🎯 {faceCount} wajah terdeteksi
            {detections.filter(d => d.nama && d.nama !== 'Tidak Dikenal').length > 0 && 
              ' • ✅ ' + detections.filter(d => d.nama && d.nama !== 'Tidak Dikenal')
                .map(d => `${d.nama} (${((d.sim_score || 0) * 100).toFixed(0)}%)`)
                .slice(0, 3).join(', ')
            }
            {detections.filter(d => !d.nama || d.nama === 'Tidak Dikenal').length > 0 && 
              ' • ❓ ' + detections.filter(d => !d.nama || d.nama === 'Tidak Dikenal').length + ' Unknown'
            }
          </div>
        )}
      </div>

      {/* Controls */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
        <button
          className={`btn btn-lg ${isActive ? 'btn-danger' : 'btn-success'}`}
          style={{ flex: 1 }}
          onClick={isActive ? stopStream : startStream}
          disabled={loading || (!isActive && !canAccessCamera)}
        >
          {loading ? (
            <><div className="spinner" style={{ width: 18, height: 18 }} /> Memuat...</>
          ) : isActive ? (
            <><Square size={18} /> STOP</>
          ) : (
            <><Play size={18} /> MULAI PRESENSI</>
          )}
        </button>
      </div>

      {/* Fallback upload jika kamera tidak tersedia */}
      {!isActive && !canAccessCamera && (
        <div className="card" style={{ marginBottom: 16, borderColor: 'var(--accent-yellow, #f0ad4e)' }}>
          <div style={{ display: 'flex', alignItems: 'flex-start', gap: 12 }}>
            <ShieldAlert size={20} style={{ color: 'var(--accent-yellow, #f0ad4e)', marginTop: 2, flexShrink: 0 }} />
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 600, marginBottom: 4 }}>⚠️ Kamera tidak tersedia</div>
              <div style={{ fontSize: 13, color: 'var(--text-secondary)', marginBottom: 8, lineHeight: 1.5 }}>
                {!cameraSupported && 'Browser tidak mendukung akses kamera.'}
                {cameraSupported && !isSecureContext && !isLocalhost &&
                  'Koneksi harus HTTPS untuk mengakses kamera. Saat ini menggunakan HTTP.'}
                {' Gunakan foto sebagai alternatif untuk absensi:'}
              </div>
              <button
                className="btn btn-primary"
                onClick={() => fileInputRef.current?.click()}
                disabled={loading}
              >
                <Upload size={16} /> Upload Foto Wajah
              </button>
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                capture="user"
                style={{ display: 'none' }}
                onChange={handleFileUpload}
              />
            </div>
          </div>
        </div>
      )}

      {/* Detection Results */}
      {lastResult && (
        <div className="card">
          <div className="card-title">📋 Hasil Terakhir</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '8px 0' }}>
            <div className={`badge ${
              lastResult.type === 'success' ? 'badge-success' : 
              lastResult.type === 'warning' ? 'badge-warning' : 
              lastResult.type === 'pulang' ? 'badge-info' : 
              lastResult.type === 'blocked' ? 'badge-danger' :
              lastResult.type === 'info' ? 'badge-info' :
              'badge-danger'}`}>
              {lastResult.type === 'success' ? '✅ TEPAT WAKTU' :
               lastResult.type === 'warning' ? '⚠️ TERLAMBAT' :
               lastResult.type === 'pulang' ? '🏠 PULANG VALID' :
               lastResult.type === 'blocked' ? '⛔ DITOLAK' :
               lastResult.type === 'info' ? 'ℹ️ SUDAH' :
               '🔴 SPOOF'}
            </div>
            <span style={{ fontWeight: 600 }}>{lastResult.name}</span>
            {lastResult.accuracy != null && (
              <span style={{ fontSize: 12, color: 'var(--text-secondary)' }}>
                • 🎯 {lastResult.accuracy}%
              </span>
            )}
          </div>
          {lastResult.message && (
            <div style={{ fontSize: 12, color: 'var(--text-secondary)', marginTop: 4 }}>
              {lastResult.message}
            </div>
          )}
        </div>
      )}

      {/* Tips */}
      <div className="card" style={{ marginTop: 16 }}>
        <div className="card-title">💡 Tips</div>
        <ul style={{ paddingLeft: 20, color: 'var(--text-secondary)', fontSize: 13, lineHeight: 1.8 }}>
          <li>Pastikan wajah terlihat jelas di kamera</li>
          <li>Pencahayaan yang cukup membantu deteksi lebih akurat</li>
          <li>Wajah harus asli (bukan foto atau video)</li>
          <li>Presensi otomatis tercatat saat wajah terdeteksi</li>
        </ul>
      </div>
    </div>
  )
}
