import React, { useState, useEffect } from 'react'
import { Clock, Download, Calendar, Filter } from 'lucide-react'
import { useToast } from '../services/ToastContext'
import { getRiwayatPresensi, exportPresensi } from '../services/api'

export default function Riwayat() {
  const [records, setRecords] = useState([])
  const [loading, setLoading] = useState(true)
  const [dateFilter, setDateFilter] = useState('')
  const [nameFilter, setNameFilter] = useState('')
  const toast = useToast()

  useEffect(() => {
    loadRiwayat()
  }, [dateFilter])

  async function loadRiwayat() {
    setLoading(true)
    try {
      const params = {}
      if (dateFilter) params.tanggal = dateFilter
      const res = await getRiwayatPresensi(params)
      setRecords(res.data || [])
    } catch (e) {
      toast.error('Gagal memuat riwayat', 3000)
    } finally {
      setLoading(false)
    }
  }

  async function handleExport() {
    try {
      await exportPresensi(dateFilter)
      toast.success('📥  File berhasil didownload', 3000)
    } catch (e) {
      toast.error('Export gagal: ' + e.message, 3000)
    }
  }

  const filtered = records.filter(r =>
    !nameFilter || r.nama?.toLowerCase().includes(nameFilter.toLowerCase())
  )

  // Group by date
  const grouped = {}
  filtered.forEach(r => {
    const tgl = r.tanggal || 'Tidak Diketahui'
    if (!grouped[tgl]) grouped[tgl] = []
    grouped[tgl].push(r)
  })

  return (
    <div>
      <div className="page-header">
        <div>
          <h2 className="page-title">📅 Riwayat Presensi</h2>
          <p className="page-subtitle">{records.length} total catatan</p>
        </div>
        <button className="btn btn-primary" onClick={handleExport}>
          <Download size={16} /> Export CSV
        </button>
      </div>

      {/* Filters */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        <div className="input-group" style={{ flex: '1 1 200px' }}>
          <label className="input-label"><Calendar size={12} /> Filter Tanggal</label>
          <input
            type="date"
            className="input"
            value={dateFilter}
            onChange={e => setDateFilter(e.target.value)}
          />
        </div>
        <div className="input-group" style={{ flex: '1 1 200px' }}>
          <label className="input-label"><Filter size={12} /> Filter Nama</label>
          <input
            type="text"
            className="input"
            placeholder="Cari nama..."
            value={nameFilter}
            onChange={e => setNameFilter(e.target.value)}
          />
        </div>
        {dateFilter && (
          <div style={{ display: 'flex', alignItems: 'flex-end' }}>
            <button className="btn" onClick={() => setDateFilter('')}>✕ Reset</button>
          </div>
        )}
      </div>

      {/* Records */}
      {loading ? (
        <div className="loading-overlay">
          <div className="spinner" />
          <span>Memuat riwayat...</span>
        </div>
      ) : Object.keys(grouped).length === 0 ? (
        <div className="empty-state">
          <div className="empty-state-icon">📅</div>
          <div className="empty-state-title">Tidak ada data</div>
          <div className="empty-state-desc">Riwayat presensi akan muncul di sini</div>
        </div>
      ) : (
        Object.entries(grouped).map(([tgl, items]) => (
          <div key={tgl} style={{ marginBottom: 16 }}>
            <div style={{ 
              padding: '8px 12px', 
              background: 'var(--bg-tertiary)', 
              borderRadius: 'var(--radius) var(--radius) 0 0',
              fontSize: 13,
              fontWeight: 600,
              color: 'var(--accent-blue)',
              borderBottom: '1px solid var(--border)'
            }}>
              📅 {formatDate(tgl)} — {items.length} catatan
            </div>
            <div className="table-container" style={{ borderRadius: '0 0 var(--radius) var(--radius)' }}>
              <table className="table">
                <thead>
                  <tr>
                    <th>No</th>
                    <th>Nama</th>
                    <th>NIP</th>
                    <th>Jam Masuk</th>
                    <th>Status Masuk</th>
                    <th>Jam Pulang</th>
                    <th>Status Pulang</th>
                  </tr>
                </thead>
                <tbody>
                  {items.map((r, i) => (
                    <tr key={r.id || i}>
                      <td>{i + 1}</td>
                      <td style={{ fontWeight: 600 }}>{r.nama}</td>
                      <td style={{ color: 'var(--text-secondary)' }}>{r.nip}</td>
                      <td>{r.jam_masuk || '—'}</td>
                      <td>
                        <span className={`badge ${getBadgeClass(r.status_masuk)}`}>
                          {r.status_masuk || '—'}
                        </span>
                      </td>
                      <td>{r.jam_pulang || '—'}</td>
                      <td>
                        <span className={`badge ${getBadgeClass(r.status_pulang)}`}>
                          {r.status_pulang || '—'}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        ))
      )}
    </div>
  )
}

function formatDate(dateStr) {
  try {
    const [y, m, d] = dateStr.split('-')
    const date = new Date(y, m - 1, d)
    return date.toLocaleDateString('id-ID', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })
  } catch {
    return dateStr
  }
}

function getBadgeClass(status) {
  if (!status) return 'badge-info'
  if (status.includes('TEPAT')) return 'badge-success'
  if (status.includes('TERLAMBAT')) return 'badge-warning'
  if (status.includes('PULANG')) return 'badge-info'
  if (status.includes('SPPOOF')) return 'badge-danger'
  return 'badge-info'
}
