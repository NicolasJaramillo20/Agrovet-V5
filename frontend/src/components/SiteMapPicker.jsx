import { useEffect, useRef, useState } from 'react'
import { MapPin } from 'lucide-react'

let mapsApiPromise

function loadGoogleMaps(apiKey) {
  if (window.google?.maps) return Promise.resolve(window.google.maps)
  if (mapsApiPromise) return mapsApiPromise

  mapsApiPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.src = `https://maps.googleapis.com/maps/api/js?key=${encodeURIComponent(apiKey)}&v=weekly`
    script.async = true
    script.dataset.agrovetMaps = 'true'
    script.onload = () => {
      if (window.google?.maps) resolve(window.google.maps)
      else {
        mapsApiPromise = null
        reject(new Error('Google Maps no pudo inicializarse.'))
      }
    }
    script.onerror = () => {
      script.remove()
      mapsApiPromise = null
      reject(new Error('No fue posible cargar Google Maps.'))
    }
    document.head.appendChild(script)
  })

  return mapsApiPromise
}

function validCoordinates(latitude, longitude) {
  if (latitude === '' || longitude === '') return false
  const lat = Number(latitude)
  const lng = Number(longitude)
  return Number.isFinite(lat) && lat >= -90 && lat <= 90
    && Number.isFinite(lng) && lng >= -180 && lng <= 180
}

export default function SiteMapPicker({ apiKey, latitude, longitude, onChange }) {
  const containerRef = useRef(null)
  const mapRef = useRef(null)
  const markerRef = useRef(null)
  const onChangeRef = useRef(onChange)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')

  useEffect(() => {
    onChangeRef.current = onChange
  }, [onChange])

  useEffect(() => {
    if (!apiKey || !containerRef.current) return undefined
    let active = true

    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (!active || !containerRef.current) return
        const map = new maps.Map(containerRef.current, {
          center: { lat: 4.5709, lng: -74.2973 },
          zoom: 5,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: true,
          gestureHandling: 'cooperative',
        })
        map.addListener('click', (event) => {
          if (!event.latLng) return
          onChangeRef.current({
            latitude: event.latLng.lat().toFixed(6),
            longitude: event.latLng.lng().toFixed(6),
          })
        })
        mapRef.current = map
        setReady(true)
      })
      .catch(() => {
        if (active) setLoadError('Google Maps no pudo cargarse. Verifica la clave, la API habilitada y sus restricciones.')
      })

    return () => {
      active = false
      markerRef.current?.setMap(null)
      markerRef.current = null
      mapRef.current = null
    }
  }, [apiKey])

  useEffect(() => {
    if (!ready || !mapRef.current) return
    const maps = window.google.maps
    if (!validCoordinates(latitude, longitude)) {
      markerRef.current?.setMap(null)
      return
    }
    const position = { lat: Number(latitude), lng: Number(longitude) }
    if (!markerRef.current) markerRef.current = new maps.Marker({ map: mapRef.current, position })
    else {
      markerRef.current.setMap(mapRef.current)
      markerRef.current.setPosition(position)
    }
    mapRef.current.panTo(position)
    mapRef.current.setZoom(14)
  }, [latitude, longitude, ready])

  return <div>
    <div className="mb-2 flex items-center justify-between gap-2">
      <span className="label mb-0">Ubicación en Google Maps</span>
      {validCoordinates(latitude, longitude) && <span className="inline-flex items-center gap-1 text-[10px] font-medium text-[#477852]"><MapPin size={12} /> Punto seleccionado</span>}
    </div>
    {apiKey
      ? <div className="relative">
        <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-xl border border-[#e1e9e2] bg-[#f1f5ef]" />
        {!ready && !loadError && <p className="absolute inset-0 flex items-center justify-center rounded-xl bg-[#f1f5ef] px-4 text-center text-xs text-[#728176]">Cargando Google Maps…</p>}
        {loadError && <p role="status" className="mt-2 text-xs text-[#ad766e]">{loadError}</p>}
      </div>
      : <div className="rounded-xl border border-dashed border-[#d7e2d6] bg-[#f7f9f6] p-4 text-xs leading-5 text-[#728176]">
        Para activar el mapa interactivo, configura <code className="rounded bg-white px-1 py-0.5">VITE_GOOGLE_MAPS_API_KEY</code> en <code className="rounded bg-white px-1 py-0.5">frontend/.env</code> y reinicia Vite. También puedes registrar el punto ingresando las coordenadas manualmente.
      </div>}
    <p className="mt-2 text-[10px] text-[#87938a]">Haz clic en el mapa para fijar el punto; las coordenadas también se pueden editar abajo.</p>
  </div>
}
