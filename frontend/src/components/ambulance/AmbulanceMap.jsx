import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Phone, Navigation, ShieldCheck } from 'lucide-react'

// Custom Leaflet DivIcon for Patient / User Location
const createUserPin = () =>
  L.divIcon({
    className: 'bystander-user-beacon',
    html: `
      <div style="position: relative; width: 28px; height: 28px; display: flex; align-items: center; justify-content: center;">
        <span style="position: absolute; width: 28px; height: 28px; border-radius: 9999px; background: rgba(15, 118, 110, 0.35); animation: ping 1.5s cubic-bezier(0, 0, 0.2, 1) infinite;"></span>
        <span style="position: relative; width: 14px; height: 14px; border-radius: 9999px; background: #0F766E; border: 2.5px solid #FFFFFF; box-shadow: 0 2px 6px rgba(0,0,0,0.35);"></span>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
  })

// Custom Leaflet DivIcon for Active Ambulance
const createAmbulancePin = (isAvailable, vehicleNumber) =>
  L.divIcon({
    className: 'bystander-ambulance-pin',
    html: `
      <div style="position: relative; display: flex; flex-direction: column; align-items: center; cursor: pointer; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.35));">
        <div style="background: ${isAvailable ? '#DC2626' : '#64748B'}; color: #FFFFFF; font-weight: 800; font-size: 11px; padding: 4px 7px; border-radius: 8px; border: 2px solid #FFFFFF; display: flex; align-items: center; gap: 4px; box-shadow: 0 2px 4px rgba(0,0,0,0.2);">
          <span>🚑</span>
          <span style="font-family: monospace; font-size: 9px; letter-spacing: 0.5px;">${vehicleNumber || ''}</span>
        </div>
        <div style="width: 0; height: 0; border-left: 5px solid transparent; border-right: 5px solid transparent; border-top: 6px solid ${isAvailable ? '#DC2626' : '#64748B'};"></div>
      </div>
    `,
    iconSize: [60, 36],
    iconAnchor: [30, 36],
    popupAnchor: [0, -36],
  })

export function AmbulanceMap({
  userCoords,
  ambulances = [],
  radiusKm = 30,
  onCallAmbulance,
  className = '',
}) {
  const mapContainerRef = useRef(null)
  const mapInstanceRef = useRef(null)
  const circleRef = useRef(null)
  const markersLayerRef = useRef(null)
  const userMarkerRef = useRef(null)

  // Initialize Map
  useEffect(() => {
    if (!mapContainerRef.current) return

    // Default center: userCoords or Kozhikode / Kerala center (11.2588, 75.7804)
    const initialLat = userCoords?.latitude || 11.2588
    const initialLng = userCoords?.longitude || 75.7804

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 12,
      zoomControl: true,
      attributionControl: false,
    })

    // OpenStreetMap high-speed clean vector tile layer
    L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap contributors',
    }).addTo(map)

    const markersLayer = L.layerGroup().addTo(map)
    markersLayerRef.current = markersLayer
    mapInstanceRef.current = map

    return () => {
      map.remove()
      mapInstanceRef.current = null
    }
  }, [])

  // Update User Beacon & Radius Circle
  useEffect(() => {
    const map = mapInstanceRef.current
    if (!map) return

    if (userCoords?.latitude && userCoords?.longitude) {
      const latLng = [userCoords.latitude, userCoords.longitude]

      // Update or create user marker
      if (!userMarkerRef.current) {
        userMarkerRef.current = L.marker(latLng, { icon: createUserPin() })
          .bindTooltip('<b>Your Location</b>', { permanent: false, direction: 'top' })
          .addTo(map)
      } else {
        userMarkerRef.current.setLatLng(latLng)
      }

      // 10 / 20 / 30 km radius circle
      const effectiveRadiusMeters = Number(radiusKm || 30) * 1000
      if (!circleRef.current) {
        circleRef.current = L.circle(latLng, {
          radius: effectiveRadiusMeters,
          color: '#0F766E',
          weight: 1.5,
          fillColor: '#0F766E',
          fillOpacity: 0.08,
          dashArray: '4, 6',
        }).addTo(map)
      } else {
        circleRef.current.setLatLng(latLng)
        circleRef.current.setRadius(effectiveRadiusMeters)
      }
    }
  }, [userCoords, radiusKm])

  // Update Ambulance Pins
  useEffect(() => {
    const map = mapInstanceRef.current
    const markersLayer = markersLayerRef.current
    if (!map || !markersLayer) return

    markersLayer.clearLayers()

    const bounds = []
    if (userCoords?.latitude && userCoords?.longitude) {
      bounds.push([userCoords.latitude, userCoords.longitude])
    }

    ambulances.forEach((amb) => {
      const lat = amb.latitude || amb.location?.latitude
      const lng = amb.longitude || amb.location?.longitude
      if (!lat || !lng) return

      bounds.push([lat, lng])
      const isAvail = amb.isAvailable !== false
      const marker = L.marker([lat, lng], {
        icon: createAmbulancePin(isAvail, amb.vehicleNumber),
      })

      // Popup with driver details & call button
      const popupDiv = document.createElement('div')
      popupDiv.style.fontFamily = 'inherit'
      popupDiv.style.padding = '4px 2px'
      popupDiv.innerHTML = `
        <div style="min-width: 190px;">
          <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
            <span style="font-weight: 800; font-size: 13px; color: #0F172A;">${amb.driverName || 'Driver'}</span>
            <span style="font-family: monospace; font-size: 10px; font-weight: 700; background: #F1F5F9; padding: 2px 5px; border-radius: 4px;">${amb.vehicleNumber}</span>
          </div>
          <div style="font-size: 11px; font-weight: 700; color: #0F766E; margin-top: 2px;">
            ${amb.ambulanceType}
          </div>
          <div style="font-size: 11px; color: #64748B; margin-top: 4px;">
            📍 ${amb.baseHospital || amb.city || ''}
          </div>
          ${
            amb.distanceKm !== null && amb.distanceKm !== undefined
              ? `<div style="display: flex; align-items: center; justify-content: space-between; margin-top: 6px; padding: 4px 6px; background: #F0FDF4; border: 1px solid #BBF7D0; border-radius: 6px; font-size: 11px; font-weight: 700; color: #166534;">
                  <span>⚡ ${amb.distanceKm} km away</span>
                  <span>~${amb.etaMinutes || 5} min ETA</span>
                </div>`
              : ''
          }
          <div style="margin-top: 8px; border-top: 1px solid #E2E8F0; padding-top: 6px; text-align: center;">
            <a href="tel:${(amb.phone || '').replace(/\s+/g, '')}"
               style="display: inline-flex; align-items: center; justify-content: center; gap: 4px; width: 100%; background: #DC2626; color: #FFFFFF; font-weight: 800; font-size: 12px; padding: 6px 12px; border-radius: 8px; text-decoration: none;">
              📞 Call ${amb.phone || 'Driver'}
            </a>
          </div>
        </div>
      `

      marker.bindPopup(popupDiv)
      markersLayer.addLayer(marker)
    })

    // Fit map bounds if multiple pins exist
    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 13)
    }
  }, [ambulances, userCoords])

  const handleRecenter = () => {
    const map = mapInstanceRef.current
    if (!map) return
    if (userCoords?.latitude && userCoords?.longitude) {
      map.setView([userCoords.latitude, userCoords.longitude], 13, { animate: true })
    }
  }

  return (
    <div className={`relative overflow-hidden rounded-2xl border border-line bg-slate-100 ${className}`}>
      <div ref={mapContainerRef} className="h-full w-full min-h-[300px] z-0" />

      {/* Recenter to User Button */}
      {userCoords?.latitude && userCoords?.longitude && (
        <button
          type="button"
          onClick={handleRecenter}
          className="absolute right-3 bottom-3 z-[1000] flex items-center gap-1.5 rounded-xl border border-line bg-white/95 px-3 py-2 text-xs font-bold text-ink shadow-md backdrop-blur transition hover:bg-slate-50"
          title="Recenter to my location"
        >
          <Navigation className="h-3.5 w-3.5 text-primary-700" />
          <span>My Location</span>
        </button>
      )}

      {/* Map Legend Overlay */}
      <div className="absolute left-3 top-3 z-[1000] flex items-center gap-2 rounded-xl border border-line bg-white/95 px-3 py-1.5 text-[11px] font-bold text-ink shadow-sm backdrop-blur">
        <span className="flex h-2.5 w-2.5 rounded-full bg-emerald-500 animate-ping" />
        <span>Live {radiusKm || 30} km Ambulance Radar</span>
      </div>
    </div>
  )
}

export default AmbulanceMap

