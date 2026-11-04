import React, { useEffect, useRef, useState } from 'react'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { MapPin, ExternalLink, Move } from 'lucide-react'
import { loadGoogleMaps, isGoogleMapsConfigured } from '@/utils/googleMapsLoader'

// Custom high-contrast SVG pin anchored precisely at the bottom tip for Leaflet fallback
const createLeafletPinIcon = () =>
  L.divIcon({
    className: 'bystander-map-pin',
    html: `
      <div style="position: relative; width: 36px; height: 44px; display: flex; align-items: center; justify-content: center; filter: drop-shadow(0 4px 6px rgba(0,0,0,0.45)); cursor: grab;">
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

const LEAFLET_TILE_LAYERS = {
  hybrid: {
    id: 'hybrid',
    label: 'Satellite',
    url: 'https://{s}.google.com/vt/lyrs=y&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps Satellite',
  },
  roadmap: {
    id: 'roadmap',
    label: 'Streets',
    url: 'https://{s}.google.com/vt/lyrs=m&x={x}&y={y}&z={z}',
    subdomains: ['mt0', 'mt1', 'mt2', 'mt3'],
    maxZoom: 20,
    attribution: '&copy; Google Maps',
  },
}

export default function InteractiveLocationPicker({
  lat,
  lng,
  accuracy,
  onLocationChange,
  className = '',
}) {
  const mapContainerRef = useRef(null)
  const isInternalMove = useRef(false)
  const [mapEngine, setMapEngine] = useState('loading') // 'google' | 'leaflet' | 'loading'
  const [mapMode, setMapMode] = useState('hybrid') // 'hybrid' | 'roadmap'

  // Google Maps references
  const googleMapRef = useRef(null)
  const googleMarkerRef = useRef(null)

  // Leaflet references (fallback)
  const leafletMapRef = useRef(null)
  const leafletMarkerRef = useRef(null)
  const leafletTileLayerRef = useRef(null)

  const initialLat = typeof lat === 'number' && !Number.isNaN(lat) ? lat : 11.25085
  const initialLng = typeof lng === 'number' && !Number.isNaN(lng) ? lng : 75.79804

  // Initialize Map: Tries Google Maps first; falls back to Leaflet gracefully
  useEffect(() => {
    let isCancelled = false

    const initMap = async () => {
      if (!mapContainerRef.current) return

      if (isGoogleMapsConfigured()) {
        try {
          const googleMaps = await loadGoogleMaps()
          if (isCancelled || !mapContainerRef.current) return

          // Initialize official Google Map
          const gMap = new googleMaps.Map(mapContainerRef.current, {
            center: { lat: initialLat, lng: initialLng },
            zoom: 18,
            mapTypeId: mapMode === 'hybrid' ? googleMaps.MapTypeId.HYBRID : googleMaps.MapTypeId.ROADMAP,
            zoomControl: true,
            mapTypeControl: false,
            streetViewControl: false,
            fullscreenControl: false,
            gestureHandling: 'greedy',
          })

          const pinSvg = `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(`
            <svg width="36" height="44" viewBox="0 0 24 30" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M12 0C5.37258 0 0 5.37258 0 12C0 19.5 10.5 28.5 11.5 29.5C11.7761 29.7414 12.2239 29.7414 12.5 29.5C13.5 28.5 24 19.5 24 12C24 5.37258 18.6274 0 12 0Z" fill="#0F766E"/>
              <circle cx="12" cy="11" r="5" fill="#FFFFFF"/>
              <circle cx="12" cy="11" r="2.5" fill="#0F766E"/>
            </svg>
          `)}`

          const gMarker = new googleMaps.Marker({
            position: { lat: initialLat, lng: initialLng },
            map: gMap,
            draggable: true,
            animation: googleMaps.Animation?.DROP,
            icon: {
              url: pinSvg,
              scaledSize: new googleMaps.Size(36, 44),
              anchor: new googleMaps.Point(18, 44),
            },
          })

          gMarker.addListener('dragend', () => {
            const pos = gMarker.getPosition()
            if (!pos) return
            const newLat = Number(pos.lat().toFixed(6))
            const newLng = Number(pos.lng().toFixed(6))
            isInternalMove.current = true
            onLocationChange?.(newLat, newLng)
          })

          gMap.addListener('click', (e) => {
            if (!e.latLng) return
            gMarker.setPosition(e.latLng)
            const newLat = Number(e.latLng.lat().toFixed(6))
            const newLng = Number(e.latLng.lng().toFixed(6))
            isInternalMove.current = true
            onLocationChange?.(newLat, newLng)
          })

          googleMapRef.current = gMap
          googleMarkerRef.current = gMarker
          setMapEngine('google')
          return
        } catch (err) {
          console.warn('[MapPicker] Google Maps initialization failed, using Leaflet fallback:', err.message)
        }
      }

      // Fallback: Leaflet
      if (isCancelled || !mapContainerRef.current) return
      initLeafletFallback()
    }

    const initLeafletFallback = () => {
      const map = L.map(mapContainerRef.current, {
        center: [initialLat, initialLng],
        zoom: 18,
        scrollWheelZoom: true,
        zoomControl: true,
      })

      const cfg = LEAFLET_TILE_LAYERS[mapMode] || LEAFLET_TILE_LAYERS.hybrid
      const tileLayer = L.tileLayer(cfg.url, {
        subdomains: cfg.subdomains,
        maxZoom: cfg.maxZoom,
        attribution: cfg.attribution,
      }).addTo(map)

      const marker = L.marker([initialLat, initialLng], {
        icon: createLeafletPinIcon(),
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

      leafletMapRef.current = map
      leafletMarkerRef.current = marker
      leafletTileLayerRef.current = tileLayer
      setMapEngine('leaflet')

      setTimeout(() => {
        map.invalidateSize()
      }, 200)
    }

    initMap()

    return () => {
      isCancelled = true
      if (leafletMapRef.current) {
        leafletMapRef.current.remove()
        leafletMapRef.current = null
        leafletMarkerRef.current = null
        leafletTileLayerRef.current = null
      }
      googleMapRef.current = null
      googleMarkerRef.current = null
    }
  }, [])

  // Sync mode changes (Satellite vs Streets)
  const handleModeChange = (mode) => {
    setMapMode(mode)

    if (mapEngine === 'google' && googleMapRef.current && window.google?.maps) {
      googleMapRef.current.setMapTypeId(
        mode === 'hybrid' ? window.google.maps.MapTypeId.HYBRID : window.google.maps.MapTypeId.ROADMAP
      )
    } else if (mapEngine === 'leaflet' && leafletMapRef.current) {
      if (leafletTileLayerRef.current) {
        leafletMapRef.current.removeLayer(leafletTileLayerRef.current)
      }
      const cfg = LEAFLET_TILE_LAYERS[mode] || LEAFLET_TILE_LAYERS.hybrid
      leafletTileLayerRef.current = L.tileLayer(cfg.url, {
        subdomains: cfg.subdomains,
        maxZoom: cfg.maxZoom,
        attribution: cfg.attribution,
      }).addTo(leafletMapRef.current)
    }
  }

  // Sync external coordinates changes (e.g. from GPS button)
  useEffect(() => {
    if (isInternalMove.current) {
      isInternalMove.current = false
      return
    }

    if (
      typeof lat === 'number' &&
      typeof lng === 'number' &&
      !Number.isNaN(lat) &&
      !Number.isNaN(lng)
    ) {
      if (mapEngine === 'google' && googleMapRef.current && googleMarkerRef.current) {
        const newPos = { lat, lng }
        googleMarkerRef.current.setPosition(newPos)
        googleMapRef.current.panTo(newPos)
      } else if (mapEngine === 'leaflet' && leafletMapRef.current && leafletMarkerRef.current) {
        leafletMarkerRef.current.setLatLng([lat, lng])
        leafletMapRef.current.setView([lat, lng], 18, { animate: true })
      }
    }
  }, [lat, lng, mapEngine])

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
        <div className="flex items-center gap-2">
          {mapEngine === 'google' && (
            <span className="inline-flex items-center gap-1 rounded bg-emerald-50 px-1.5 py-0.5 text-[9px] font-bold text-emerald-700 border border-emerald-200">
              Google Maps
            </span>
          )}
          <a
            href={`https://www.google.com/maps?q=${lat},${lng}`}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center gap-1 text-[11px] font-semibold text-primary-700 hover:text-primary-800 hover:underline"
          >
            <span>Open in Maps</span>
            <ExternalLink className="h-3 w-3" />
          </a>
        </div>
      </div>

      <div className="relative">
        <div
          ref={mapContainerRef}
          className="relative h-60 w-full rounded-lg bg-slate-200 shadow-inner z-0"
        />

        {/* Top-Left: Drag instruction pill */}
        <div className="pointer-events-none absolute top-2 left-2 z-10 flex items-center gap-1.5 rounded-lg bg-white/95 px-2.5 py-1 text-[10px] font-semibold text-primary-900 shadow-sm border border-slate-200 backdrop-blur-xs">
          <Move className="h-3 w-3 text-primary-700 animate-pulse" />
          Drag pin onto your roof / building gate
        </div>

        {/* Top-Right: Satellite vs Streets layer switcher */}
        <div className="absolute top-2 right-2 z-10 flex items-center overflow-hidden rounded-lg bg-white/95 p-0.5 shadow-md border border-slate-200 backdrop-blur-xs">
          <button
            type="button"
            onClick={() => handleModeChange('hybrid')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
              mapMode === 'hybrid'
                ? 'bg-primary-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            🛰️ Satellite
          </button>
          <button
            type="button"
            onClick={() => handleModeChange('roadmap')}
            className={`px-2.5 py-1 text-[10px] font-bold rounded-md transition cursor-pointer ${
              mapMode === 'roadmap'
                ? 'bg-primary-700 text-white shadow-xs'
                : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
            }`}
          >
            🗺️ Streets
          </button>
        </div>
      </div>

      <p className="mt-2 px-1 text-[11px] text-slate-500">
        📍 The caretaker's navigation will drive directly to this pin. Confirm or refine your house / flat number below.
      </p>
    </div>
  )
}
