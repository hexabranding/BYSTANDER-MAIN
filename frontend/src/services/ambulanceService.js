import apiClient, { ApiError } from './apiClient.js'

export const DEFAULT_AMBULANCES = [
  {
    id: 'amb-1',
    _id: 'amb-1',
    driverName: 'Rajesh Patil',
    phone: '+91 98201 12233',
    vehicleNumber: 'MH 02 CZ 4421',
    ambulanceType: 'ICU on Wheels',
    baseHospital: 'Lilavati Hospital & Research Centre',
    city: 'Mumbai',
    area: 'Bandra West',
    isAvailable: true,
    oxygenFitted: true,
    ventilatorFitted: true,
    stretcherAvailable: true,
    emergencyCallCount: 18,
    notes: 'Equipped with transport ventilator & cardiac defibrillator.',
  },
  {
    id: 'amb-2',
    _id: 'amb-2',
    driverName: 'Mohd. Imran Khan',
    phone: '+91 98205 56677',
    vehicleNumber: 'MH 01 AB 8890',
    ambulanceType: 'Advanced Life Support (ALS)',
    baseHospital: 'KEM Hospital & Medical College',
    city: 'Mumbai',
    area: 'Parel',
    isAvailable: true,
    oxygenFitted: true,
    ventilatorFitted: false,
    stretcherAvailable: true,
    emergencyCallCount: 34,
    notes: '24x7 trauma ready with EMT paramedic onboard.',
  },
  {
    id: 'amb-3',
    _id: 'amb-3',
    driverName: 'Gurpreet Singh',
    phone: '+91 98112 23344',
    vehicleNumber: 'DL 01 EA 3201',
    ambulanceType: 'ICU on Wheels',
    baseHospital: 'AIIMS Trauma Center',
    city: 'Delhi',
    area: 'Safdarjung Enclave',
    isAvailable: true,
    oxygenFitted: true,
    ventilatorFitted: true,
    stretcherAvailable: true,
    emergencyCallCount: 42,
    notes: 'High-risk critical transport with dual oxygen cylinders.',
  },
  {
    id: 'amb-4',
    _id: 'amb-4',
    driverName: 'Suresh Kumar',
    phone: '+91 98451 12233',
    vehicleNumber: 'KA 03 MB 9901',
    ambulanceType: 'Basic Life Support (BLS)',
    baseHospital: 'Manipal Hospital',
    city: 'Bangalore',
    area: 'Old Airport Road',
    isAvailable: true,
    oxygenFitted: true,
    ventilatorFitted: false,
    stretcherAvailable: true,
    emergencyCallCount: 15,
    notes: 'Rapid bedside oxygen support & patient transfer.',
  },
  {
    id: 'amb-5',
    _id: 'amb-5',
    driverName: 'Venkatesh Rao',
    phone: '+91 98492 23344',
    vehicleNumber: 'TS 09 ER 1099',
    ambulanceType: 'Advanced Life Support (ALS)',
    baseHospital: 'Apollo Hospitals',
    city: 'Hyderabad',
    area: 'Jubilee Hills',
    isAvailable: true,
    oxygenFitted: true,
    ventilatorFitted: false,
    stretcherAvailable: true,
    emergencyCallCount: 22,
    notes: 'Equipped with syringe pumps & multi-para monitor.',
  },
  {
    id: 'amb-6',
    _id: 'amb-6',
    driverName: 'Karthik Raja',
    phone: '+91 98403 34455',
    vehicleNumber: 'TN 02 AX 7712',
    ambulanceType: 'Patient Transport',
    baseHospital: 'Fortis Malar Hospital',
    city: 'Chennai',
    area: 'Adyar',
    isAvailable: true,
    oxygenFitted: true,
    ventilatorFitted: false,
    stretcherAvailable: true,
    emergencyCallCount: 11,
    notes: 'Wheelchair ramp & folding stretcher for post-discharge non-critical transfers.',
  },
]

export async function fetchAmbulances(params = {}) {
  try {
    const res = await apiClient.get('/api/ambulances', { params })
    const list = res.data?.data?.ambulances || res.data?.ambulances
    if (Array.isArray(list) && list.length > 0) {
      return list
    }
  } catch (_) {}

  // Fallback filtering
  const { city, ambulanceType, search } = params
  return DEFAULT_AMBULANCES.filter((a) => {
    if (city && city !== 'All' && a.city.toLowerCase() !== city.toLowerCase()) return false
    if (ambulanceType && ambulanceType !== 'All' && a.ambulanceType !== ambulanceType) return false
    if (search && search.trim()) {
      const q = search.toLowerCase()
      const match =
        a.driverName.toLowerCase().includes(q) ||
        a.vehicleNumber.toLowerCase().includes(q) ||
        a.baseHospital.toLowerCase().includes(q) ||
        a.area.toLowerCase().includes(q)
      if (!match) return false
    }
    return true
  })
}

export async function recordEmergencyCall(ambulanceId) {
  try {
    const res = await apiClient.post(`/api/ambulances/${ambulanceId}/call`)
    return res.data?.data?.ambulance
  } catch (_) {
    return null
  }
}

export async function registerAmbulance(payload) {
  const res = await apiClient.post('/api/ambulances/register', payload)
  return res.data
}

export async function getAmbulanceProfile() {
  const res = await apiClient.get('/api/ambulances/me')
  return res.data?.data?.ambulance
}

export async function updateAmbulanceProfile(payload) {
  const res = await apiClient.patch('/api/ambulances/me', payload)
  return res.data?.data?.ambulance
}

export async function toggleAmbulanceAvailability(isAvailable) {
  const res = await apiClient.patch('/api/ambulances/me/availability', { isAvailable })
  return res.data?.data?.ambulance
}

export async function fetchAdminAmbulances(params = {}) {
  const res = await apiClient.get('/api/ambulances/admin', { params })
  return res.data?.data || { ambulances: [], pagination: {} }
}

export async function updateAdminAmbulanceStatus(ambulanceId, status, notes = '') {
  const res = await apiClient.patch(`/api/ambulances/admin/${ambulanceId}/verify`, { status, notes })
  return res.data?.data?.ambulance
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
