import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { Navigation } from 'lucide-react'
import { loadGoogleMaps, isGoogleMapsConfigured } from '@/utils/googleMapsLoader'

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

const buildAmbulancePopupHtml = (amb) => `
  <div style="font-family: system-ui, -apple-system, sans-serif; min-width: 200px; padding: 2px;">
    <div style="display: flex; align-items: center; justify-content: space-between; gap: 8px;">
      <span style="font-weight: 800; font-size: 13px; color: #0F172A;">${amb.driverName || 'Driver'}</span>
      <span style="font-family: monospace; font-size: 10px; font-weight: 700; background: #F1F5F9; padding: 2px 5px; border-radius: 4px;">${amb.vehicleNumber || ''}</span>
    </div>
    <div style="font-size: 11px; font-weight: 700; color: #0F766E; margin-top: 3px;">
      ${amb.ambulanceType || 'Basic Life Support (BLS)'}
    </div>
    <div style="font-size: 11px; color: #64748B; margin-top: 3px;">
      📍 ${amb.baseHospital || amb.city || 'Emergency Station'}
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

export function AmbulanceMap({
  userCoords,
  ambulances = [],
  radiusKm = 30,
  onCallAmbulance,
  className = '',
}) {
  const mapContainerRef = useRef(null)
  const [mapEngine, setMapEngine] = useState('loading') // 'google' | 'leaflet' | 'loading'

  // Google Maps state refs
  const googleMapRef = useRef(null)
  const googleUserMarkerRef = useRef(null)
  const googleCircleRef = useRef(null)
  const googleAmbulanceMarkersRef = useRef([])
  const googleInfoWindowRef = useRef(null)

  // Leaflet state refs
  const leafletMapRef = useRef(null)
  const leafletCircleRef = useRef(null)
  const leafletMarkersLayerRef = useRef(null)
  const leafletUserMarkerRef = useRef(null)

  const initialLat = userCoords?.latitude || 11.2588
  const initialLng = userCoords?.longitude || 75.7804

  useEffect(() => {
    let isCancelled = false

    const initMap = async () => {
      if (!mapContainerRef.current) return

      if (isGoogleMapsConfigured()) {
        try {
          const googleMaps = await loadGoogleMaps()
          if (isCancelled || !mapContainerRef.current) return

          const gMap = new googleMaps.Map(mapContainerRef.current, {
            center: { lat: initialLat, lng: initialLng },
            zoom: 12,
            mapTypeId: googleMaps.MapTypeId.ROADMAP,
            zoomControl: true,
            streetViewControl: false,
            mapTypeControl: false,
            fullscreenControl: false,
            gestureHandling: 'greedy',
          })

          googleInfoWindowRef.current = new googleMaps.InfoWindow()
          googleMapRef.current = gMap
          setMapEngine('google')
          return
        } catch (err) {
          console.warn('[AmbulanceMap] Google Maps initialization failed, using Leaflet fallback:', err.message)
        }
      }

      // Fallback: Leaflet Map
      if (isCancelled || !mapContainerRef.current) return
      initLeafletFallback()
    }

    const initLeafletFallback = () => {
      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 12,
        zoomControl: true,
        attributionControl: false,
      })

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        maxZoom: 19,
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map)

      const markersLayer = L.layerGroup().addTo(map)
      leafletMarkersLayerRef.current = markersLayer
      leafletMapRef.current = map
      setMapEngine('leaflet')
    }

    initMap()

    return () => {
      isCancelled = true
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
        leafletCircleRef.current = null
        leafletMarkersLayerRef.current = null
        leafletUserMarkerRef.current = null
      }
      if (googleCircleRef.current) {
        googleCircleRef.current.setMap(null)
        googleCircleRef.current = null
      }
      if (googleUserMarkerRef.current) {
        googleUserMarkerRef.current.setMap(null)
        googleUserMarkerRef.current = null
      }
      googleAmbulanceMarkersRef.current.forEach((m) => m.setMap(null))
      googleAmbulanceMarkersRef.current = []
      googleMapRef.current = null
    }
  }, [])

  // Sync User Location Beacon & Radius Circle (Google Maps)
  useEffect(() => {
    if (mapEngine !== 'google' || !googleMapRef.current || !window.google?.maps) return

    const googleMaps = window.google.maps
    const gMap = googleMapRef.current

    if (userCoords?.latitude && userCoords?.longitude) {
      const userPos = { lat: userCoords.latitude, lng: userCoords.longitude }

      // User location marker
      if (!googleUserMarkerRef.current) {
        const beaconSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
          <svg width="28" height="28" viewBox="0 0 28 28" fill="none" xmlns="http://www.w3.org/2000/svg">
            <circle cx="14" cy="14" r="12" fill="#0F766E" fill-opacity="0.25"/>
            <circle cx="14" cy="14" r="7" fill="#0F766E" stroke="#FFFFFF" stroke-width="2.5"/>
          </svg>
        `)}`

        googleUserMarkerRef.current = new googleMaps.Marker({
          position: userPos,
          map: gMap,
          title: 'Your Location',
          icon: {
            url: beaconSvg,
            scaledSize: new googleMaps.Size(28, 28),
            anchor: new googleMaps.Point(14, 14),
          },
        })
      } else {
        googleUserMarkerRef.current.setPosition(userPos)
      }

      // Radius circle
      const radiusMeters = Number(radiusKm || 30) * 1000
      if (!googleCircleRef.current) {
        googleCircleRef.current = new googleMaps.Circle({
          strokeColor: '#0F766E',
          strokeOpacity: 0.85,
          strokeWeight: 1.5,
          fillColor: '#0F766E',
          fillOpacity: 0.08,
          map: gMap,
          center: userPos,
          radius: radiusMeters,
        })
      } else {
        googleCircleRef.current.setCenter(userPos)
        googleCircleRef.current.setRadius(radiusMeters)
      }
    }
  }, [mapEngine, userCoords, radiusKm])

  // Sync Ambulance Pins (Google Maps)
  useEffect(() => {
    if (mapEngine !== 'google' || !googleMapRef.current || !window.google?.maps) return

    const googleMaps = window.google.maps
    const gMap = googleMapRef.current

    // Clear old ambulance markers
    googleAmbulanceMarkersRef.current.forEach((m) => m.setMap(null))
    googleAmbulanceMarkersRef.current = []

    const bounds = new googleMaps.LatLngBounds()
    let hasPins = false

    if (userCoords?.latitude && userCoords?.longitude) {
      bounds.extend({ lat: userCoords.latitude, lng: userCoords.longitude })
      hasPins = true
    }

    ambulances.forEach((amb) => {
      const lat = amb.latitude || amb.location?.latitude
      const lng = amb.longitude || amb.location?.longitude
      if (!lat || !lng) return

      const ambPos = { lat, lng }
      bounds.extend(ambPos)
      hasPins = true

      const isAvail = amb.isAvailable !== false
      const color = isAvail ? '#DC2626' : '#64748B'
      const labelText = amb.vehicleNumber ? amb.vehicleNumber.slice(-4) : 'AMB'

      const pinSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
        <svg width="48" height="32" viewBox="0 0 48 32" fill="none" xmlns="http://www.w3.org/2000/svg">
          <rect width="48" height="24" rx="6" fill="${color}" stroke="#FFFFFF" stroke-width="2"/>
          <text x="24" y="16" fill="#FFFFFF" font-size="10" font-weight="bold" font-family="monospace" text-anchor="middle">🚑 ${labelText}</text>
          <path d="M20 24L24 30L28 24H20Z" fill="${color}"/>
        </svg>
      `)}`

      const marker = new googleMaps.Marker({
        position: ambPos,
        map: gMap,
        title: `${amb.driverName || 'Ambulance'} (${amb.vehicleNumber || ''})`,
        icon: {
          url: pinSvg,
          scaledSize: new googleMaps.Size(48, 32),
          anchor: new googleMaps.Point(24, 32),
        },
      })

      marker.addListener('click', () => {
        if (googleInfoWindowRef.current) {
          googleInfoWindowRef.current.setContent(buildAmbulancePopupHtml(amb))
          googleInfoWindowRef.current.open(gMap, marker)
        }
      })

      googleAmbulanceMarkersRef.current.push(marker)
    })

    if (hasPins && ambulances.length > 0) {
      gMap.fitBounds(bounds, { top: 40, right: 40, bottom: 40, left: 40 })
    }
  }, [mapEngine, ambulances, userCoords])

  // Leaflet Fallback Sync
  useEffect(() => {
    if (mapEngine !== 'leaflet' || !leafletMapRef.current) return
    const map = leafletMapRef.current

    if (userCoords?.latitude && userCoords?.longitude) {
      const latLng = [userCoords.latitude, userCoords.longitude]
      if (!leafletUserMarkerRef.current) {
        leafletUserMarkerRef.current = L.marker(latLng, { icon: createUserPin() })
          .bindTooltip('<b>Your Location</b>', { permanent: false, direction: 'top' })
          .addTo(map)
      } else {
        leafletUserMarkerRef.current.setLatLng(latLng)
      }

      const effectiveRadiusMeters = Number(radiusKm || 30) * 1000
      if (!leafletCircleRef.current) {
        leafletCircleRef.current = L.circle(latLng, {
          radius: effectiveRadiusMeters,
          color: '#0F766E',
          weight: 1.5,
          fillColor: '#0F766E',
          fillOpacity: 0.08,
          dashArray: '4, 6',
        }).addTo(map)
      } else {
        leafletCircleRef.current.setLatLng(latLng)
        leafletCircleRef.current.setRadius(effectiveRadiusMeters)
      }
    }
  }, [mapEngine, userCoords, radiusKm])

  useEffect(() => {
    if (mapEngine !== 'leaflet' || !leafletMapRef.current || !leafletMarkersLayerRef.current) return
    const map = leafletMapRef.current
    const markersLayer = leafletMarkersLayerRef.current

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

      const popupDiv = document.createElement('div')
      popupDiv.innerHTML = buildAmbulancePopupHtml(amb)
      marker.bindPopup(popupDiv)
      markersLayer.addLayer(marker)
    })

    if (bounds.length > 1) {
      map.fitBounds(bounds, { padding: [50, 50], maxZoom: 14 })
    } else if (bounds.length === 1) {
      map.setView(bounds[0], 13)
    }
  }, [mapEngine, ambulances, userCoords])

  const handleRecenter = () => {
    if (userCoords?.latitude && userCoords?.longitude) {
      if (mapEngine === 'google' && googleMapRef.current) {
        googleMapRef.current.panTo({ lat: userCoords.latitude, lng: userCoords.longitude })
        googleMapRef.current.setZoom(13)
      } else if (mapEngine === 'leaflet' && leafletMapRef.current) {
        leafletMapRef.current.setView([userCoords.latitude, userCoords.longitude], 13, { animate: true })
      }
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
          className="absolute right-3 bottom-3 z-[1000] flex items-center gap-1.5 rounded-xl border border-line bg-white/95 px-3 py-2 text-xs font-bold text-ink shadow-md backdrop-blur transition hover:bg-slate-50 cursor-pointer"
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
        {mapEngine === 'google' && (
          <span className="rounded bg-emerald-50 px-1 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
            Google Maps
          </span>
        )}
      </div>
    </div>
  )
}

export default AmbulanceMap
