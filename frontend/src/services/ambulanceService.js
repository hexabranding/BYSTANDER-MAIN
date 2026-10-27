import apiClient, { ApiError } from './apiClient.js'

export const DEFAULT_AMBULANCES = []

export async function fetchAmbulances(params = {}) {
  try {
    const res = await apiClient.get('/api/ambulances', { params })
    const list = res?.data?.ambulances || res?.ambulances || (Array.isArray(res?.data) ? res.data : null)
    if (Array.isArray(list)) {
      return list
    }
  } catch (_) {}

  return []
}

export async function recordEmergencyCall(ambulanceId) {
  try {
    const res = await apiClient.post(`/api/ambulances/${ambulanceId}/call`)
    return res?.data?.ambulance || res?.ambulance || res?.data || null
  } catch (_) {
    return null
  }
}

export async function registerAmbulance(payload) {
  const res = await apiClient.post('/api/ambulances/register', payload)
  return res?.data || res
}

export async function getAmbulanceProfile() {
  const res = await apiClient.get('/api/ambulances/me')
  return res?.data?.ambulance || res?.ambulance || res?.data || null
}

export async function updateAmbulanceProfile(payload) {
  const res = await apiClient.patch('/api/ambulances/me', payload)
  return res?.data?.ambulance || res?.ambulance || res?.data || null
}

export async function toggleAmbulanceAvailability(isAvailable) {
  const res = await apiClient.patch('/api/ambulances/me/availability', { isAvailable })
  return res?.data?.ambulance || res?.ambulance || res?.data || null
}

export async function fetchAdminAmbulances(params = {}) {
  const res = await apiClient.get('/api/ambulances/admin', { params })
  return res?.data || res || { ambulances: [], pagination: {} }
}

export async function updateAdminAmbulanceStatus(ambulanceId, status, notes = '') {
  const res = await apiClient.patch(`/api/ambulances/admin/${ambulanceId}/verify`, { status, notes })
  return res?.data?.ambulance || res?.ambulance || res?.data || null
}

export default {
  fetchAmbulances,
  recordEmergencyCall,
  registerAmbulance,
  getAmbulanceProfile,
  updateAmbulanceProfile,
  toggleAmbulanceAvailability,
  fetchAdminAmbulances,
  updateAdminAmbulanceStatus,
}
