const API_BASE = import.meta.env.VITE_API_BASE || '/api'

async function request(path, options = {}) {
  const url = `${API_BASE}${path}`
  const config = {
    headers: { 'Content-Type': 'application/json' },
    ...options
  }
  
  try {
    const res = await fetch(url, config)
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Network error' }))
      throw new Error(err.error || `HTTP ${res.status}`)
    }
    return await res.json()
  } catch (e) {
    if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
      throw new Error('Server tidak tersedia. Pastikan backend berjalan.')
    }
    throw e
  }
}

// ═══════════════════════════════════════════════════════════════════════
//  PEGAWAI
// ═══════════════════════════════════════════════════════════════════════

export async function getSemuaPegawai() {
  return request('/pegawai')
}

export async function getPegawaiById(id) {
  return request(`/pegawai/${id}`)
}

export async function tambahPegawai(data) {
  const formData = new FormData()
  formData.append('nip', data.nip)
  formData.append('nama', data.nama)
  formData.append('departemen', data.departemen)
  if (data.jabatan) formData.append('jabatan', data.jabatan)
  if (data.foto) formData.append('foto', data.foto)
  
  try {
    const res = await fetch(`${API_BASE}/pegawai`, {
      method: 'POST',
      body: formData
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Upload error' }))
      throw new Error(err.error)
    }
    return await res.json()
  } catch (e) {
    if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
      throw new Error('Server tidak tersedia. Pastikan backend berjalan.')
    }
    throw e
  }
}

export async function updatePegawai(id, data) {
  const formData = new FormData()
  if (data.nip) formData.append('nip', data.nip)
  if (data.nama) formData.append('nama', data.nama)
  if (data.departemen !== undefined) formData.append('departemen', data.departemen)
  if (data.jabatan !== undefined) formData.append('jabatan', data.jabatan)
  if (data.foto) formData.append('foto', data.foto)
  
  try {
    const res = await fetch(`${API_BASE}/pegawai/${id}`, {
      method: 'PUT',
      body: formData
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Update error' }))
      throw new Error(err.error)
    }
    return await res.json()
  } catch (e) {
    if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
      throw new Error('Server tidak tersedia. Pastikan backend berjalan.')
    }
    throw e
  }
}

export async function hapusPegawai(id) {
  return request(`/pegawai/${id}`, { method: 'DELETE' })
}

// ═══════════════════════════════════════════════════════════════════════
//  PRESENSI
// ═══════════════════════════════════════════════════════════════════════

export async function getPresensiHariIni() {
  return request('/presensi/hari-ini')
}

export async function getRiwayatPresensi(params = {}) {
  const query = new URLSearchParams(params).toString()
  return request(`/presensi/riwayat${query ? '?' + query : ''}`)
}

export async function catatPresensiManual(data) {
  return request('/presensi/manual', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

// ═══════════════════════════════════════════════════════════════════════
//  STATISTIK
// ═══════════════════════════════════════════════════════════════════════

export async function getStatistik() {
  return request('/statistik')
}

// ═══════════════════════════════════════════════════════════════════════
//  SETTINGS
// ═══════════════════════════════════════════════════════════════════════

export async function getSettings() {
  return request('/settings')
}

export async function updateSettings(data) {
  return request('/settings', {
    method: 'POST',
    body: JSON.stringify(data)
  })
}

// ═══════════════════════════════════════════════════════════════════════
//  FACE DETECTION
// ═══════════════════════════════════════════════════════════════════════

export async function detectFace(imageBlob) {
  const formData = new FormData()
  formData.append('image', imageBlob, 'frame.jpg')
  
  try {
    const res = await fetch(`${API_BASE}/face/detect`, {
      method: 'POST',
      body: formData
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Detection error' }))
      throw new Error(err.error)
    }
    return await res.json()
  } catch (e) {
    if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
      throw new Error('Server tidak tersedia. Pastikan backend berjalan.')
    }
    throw e
  }
}

export async function registerFace(pegawaiId, imageBlob) {
  const formData = new FormData()
  formData.append('pegawai_id', pegawaiId)
  formData.append('image', imageBlob, 'capture.jpg')
  
  try {
    const res = await fetch(`${API_BASE}/face/register`, {
      method: 'POST',
      body: formData
    })
    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Registration error' }))
      throw new Error(err.error)
    }
    return await res.json()
  } catch (e) {
    if (e.name === 'TypeError' && e.message === 'Failed to fetch') {
      throw new Error('Server tidak tersedia. Pastikan backend berjalan.')
    }
    throw e
  }
}

export async function getCameraStatus() {
  return request('/face/status')
}

export async function startCamera() {
  return request('/face/start', { method: 'POST' })
}

export async function stopCamera() {
  return request('/face/stop', { method: 'POST' })
}

// ═══════════════════════════════════════════════════════════════════════
//  EXPORT
// ═══════════════════════════════════════════════════════════════════════

export async function exportPresensi(tanggal) {
  const res = await fetch(`${API_BASE}/presensi/export?tanggal=${tanggal || ''}`)
  if (!res.ok) throw new Error('Export gagal')
  const blob = await res.blob()
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `presensi_${tanggal || 'all'}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
