import React, { useEffect, useRef } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, ExternalLink, Move } from 'lucide-react'

// Custom high-contrast SVG pin anchored precisely at the bottom tip
const createPinIcon = () =>
  L.divIcon({
    className: 'bystander-map-pin',
    html: `
      <div style="position: relative; width: 36px; height: 44px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 3px 5px rgba(0,0,0,0.35)); cursor: grab;">
        <svg width="36" height="44" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
          <path d="M12 0C5.37258 0 0 5.37258 0 12C0 19.5 10.5 28.5 11.5 29.5C11.7761 29.7414 12.2239 29.7414 12.5 29.5C13.5 28.5 24 19.5 24 12C24 5.37258 18.6274 0 12 0Z" fill="#0F766E"/>
          <circle cx="12" cy="11" r="5" fill="#FFFFFF"/>
          <circle cx="12" cy="11" r="2.5" fill="#0F766E"/>
        </svg>
      </div>
    `,
    iconSize: [36, 44],
    iconAnchor: [18, 44],
  })

export default function InteractiveLocationPicker({
  lat,
  lng,
  accuracy,
  onLocationChange,
  className = '',
}) {
  const mapContainerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const isInternalMove = useRef(false)

  useEffect(() => {
    if (!mapContainerRef.current) return

    const initialLat = typeof lat === 'number' && !Number.isNaN(lat) ? lat : 11.25085
    const initialLng = typeof lng === 'number' && !Number.isNaN(lng) ? lng : 75.79804

    const map = L.map(mapContainerRef.current, {
      center: [initialLat, initialLng],
      zoom: 17,
      scrollWheelZoom: true,
      zoomControl: true,
    })

    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; OpenStreetMap',
    }).addTo(map)

    const marker = L.marker([initialLat, initialLng], {
      icon: createPinIcon(),
      draggable: true,
      autoPan: true,
    }).addTo(map)

    marker.on('dragend', () => {
      const pos = marker.getLatLng()
      const newLat = Number(pos.lat.toFixed(6))
      const newLng = Number(pos.lng.toFixed(6))
      isInternalMove.current = true
      onLocationChange?.(newLat, newLng)
    })

    map.on('click', (e) => {
      marker.setLatLng(e.latlng)
      const newLat = Number(e.latlng.lat.toFixed(6))
      const newLng = Number(e.latlng.lng.toFixed(6))
      isInternalMove.current = true
      onLocationChange?.(newLat, newLng)
    })

    mapRef.current = map
    markerRef.current = marker

    // Invalidate size after layout settles to ensure correct tile alignment
    const timer = setTimeout(() => {
      map.invalidateSize()
    }, 200)

    return () => {
      clearTimeout(timer)
      map.remove()
      mapRef.current = null
      markerRef.current = null
    }
  }, [])

  // Sync external lat/lng changes (e.g. from GPS button) without triggering re-renders loop
  useEffect(() => {
    if (isInternalMove.current) {
      isInternalMove.current = false
      return
    }

    if (
      mapRef.current &&
      markerRef.current &&
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !Number.isNaN(lat) &&
      !Number.isNaN(lng)
    ) {
      markerRef.current.setLatLng([lat, lng])
      mapRef.current.setView([lat, lng], 17, { animate: true })
    }
  }, [lat, lng])

  return (
    <div className={`overflow-hidden rounded-xl border border-line bg-slate-50 p-2.5 text-xs ${className}`}>
      <div className="mb-2 flex flex-wrap items-center justify-between gap-1 px-1 text-slate-700">
        <span className="flex items-center gap-1.5 font-medium text-[11px]">
          <MapPin className="h-3.5 w-3.5 text-primary-700" />
          Pin GPS: {lat?.toFixed ? lat.toFixed(5) : lat}, {lng?.toFixed ? lng.toFixed(5) : lng}
          {accuracy && (
            <span className="text-[10px] text-muted font-normal">(±{accuracy}m)</span>
          )}
        </span>
        <a
          href={`https://www.google.com/maps?q=${lat},${lng}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 hover:text-primary-800 hover:underline"
        >
          <span>Verify in Google Maps</span>
          <ExternalLink className="h-3 w-3" />
        </a>
      </div>

      <div className="relative">
        <div
          ref={mapContainerRef}
          className="relative h-52 w-full rounded-lg bg-slate-200 shadow-inner z-0"
        />
        <div className="pointer-events-none absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-primary-900 shadow-sm border border-slate-200">
          <Move className="h-3 w-3 text-primary-700 animate-pulse" />
          Drag the pin or click on map to pinpoint your exact gate/building
        </div>
      </div>

      <p className="mt-2 px-1 text-[11px] text-slate-500">
        📍 The caretaker's map will navigate directly to this pin. Confirm or refine your house / flat number below.
      </p>
    </div>
  )
}

