import { useState, useEffect, useRef, useMemo, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import './index.css'

// Leaflet's default icons don't load correctly with Vite, so building custom ones
const makeIcon = (color, label) =>
  new L.DivIcon({
    className: 'pin-icon',
    html: `<div class="pin" style="background:${color}">${label}</div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 11],
  })

// SVG instead of an emoji so it looks the same on every browser
const VEHICLE_ICON = new L.DivIcon({
  className: 'vehicle-icon',
  html: `<div class="vehicle">
      <span class="vehicle-pulse"></span>
      <svg viewBox="0 0 24 24" width="20" height="20" fill="#fff" aria-hidden="true">
        <path d="M3 7a1 1 0 0 1 1-1h9a1 1 0 0 1 1 1v7h2.6l2.4 2.6V17h-1.1a2.4 2.4 0 0 0-4.8 0H9.9a2.4 2.4 0 0 0-4.8 0H3V7z"/>
      </svg>
    </div>`,
  iconSize: [34, 34],
  iconAnchor: [17, 17],
})

const DAMASCUS = [33.5138, 36.2765]
const TICK_MS = 60
const OSRM_URL = 'https://router.project-osrm.org/route/v1/driving'

// Asks the OSRM routing service for a real driving route that follows the streets
async function fetchRoute(points) {
  const coords = points.map((p) => `${p.lng},${p.lat}`).join(';')
  const res = await fetch(`${OSRM_URL}/${coords}?overview=full&geometries=geojson`)

  if (!res.ok) throw new Error('Routing service is not responding')

  const data = await res.json()
  if (data.code !== 'Ok' || !data.routes?.length) throw new Error('No driving route between these points')

  const route = data.routes[0]
  return {
    // OSRM returns [lng, lat] but Leaflet expects [lat, lng]
    path: route.geometry.coordinates.map(([lng, lat]) => [lat, lng]),
    distance: route.distance, // metres
    duration: route.duration, // seconds
  }
}

// Turns metres and seconds into something readable
const formatKm = (m) => `${(m / 1000).toFixed(1)} km`
const formatMins = (s) => `${Math.max(1, Math.round(s / 60))} min`

// Listens for map clicks and passes the coordinates up
function ClickHandler({ onAdd }) {
  useMapEvents({
    click(e) {
      onAdd({ id: Date.now(), lat: e.latlng.lat, lng: e.latlng.lng })
    },
  })
  return null
}

// Moves the map when a saved point is selected
function FlyTo({ target }) {
  const map = useMap()

  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], 15, { duration: 0.8 })
  }, [target, map])

  return null
}

export default function App() {
  const [markers, setMarkers] = useState([])
  const [flyTarget, setFlyTarget] = useState(null)
  const [isTracking, setIsTracking] = useState(false)
  const [pathIndex, setPathIndex] = useState(0)
  const intervalRef = useRef(null)

  const [route, setRoute] = useState(null)
  const [isLoadingRoute, setIsLoadingRoute] = useState(false)
  const [routeError, setRouteError] = useState('')

  const path = route?.path ?? []
  const canTrack = path.length > 1
  const hasArrived = path.length > 0 && pathIndex >= path.length - 1

  // Loads a street route whenever the chosen points change
  useEffect(() => {
    if (markers.length < 2) {
      setRoute(null)
      setRouteError('')
      return
    }

    let cancelled = false
    setIsLoadingRoute(true)
    setRouteError('')

    fetchRoute(markers)
      .then((result) => {
        if (!cancelled) setRoute(result)
      })
      .catch((err) => {
        if (!cancelled) {
          setRoute(null)
          setRouteError(err.message)
        }
      })
      .finally(() => {
        if (!cancelled) setIsLoadingRoute(false)
      })

    // Ignore the response if the points changed again before it arrived
    return () => {
      cancelled = true
    }
  }, [markers])

  // Steps the vehicle along the path to simulate live position updates
  useEffect(() => {
    if (!isTracking || path.length === 0) return

    intervalRef.current = setInterval(() => {
      setPathIndex((i) => {
        if (i >= path.length - 1) {
          setIsTracking(false)
          return i
        }
        return i + 1
      })
    }, TICK_MS)

    // Clear the timer when tracking stops or the component unmounts
    return () => clearInterval(intervalRef.current)
  }, [isTracking, path])

  const vehiclePos = path[pathIndex]
  const travelled = path.slice(0, pathIndex + 1)
  const progress = path.length > 1 ? Math.round((pathIndex / (path.length - 1)) * 100) : 0

  // Any change to the route means the trip starts over
  const addMarker = useCallback((point) => {
    setMarkers((prev) => [...prev, point])
    setIsTracking(false)
    setPathIndex(0)
  }, [])

  const removeMarker = (id) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id))
    setIsTracking(false)
    setPathIndex(0)
  }

  const clearAll = () => {
    setMarkers([])
    setIsTracking(false)
    setPathIndex(0)
  }

  const handleStart = () => {
    if (hasArrived) setPathIndex(0) // Restart if the last trip already finished
    setIsTracking(true)
  }

  const labelFor = (i) => (i === 0 ? 'Start' : i === markers.length - 1 ? 'Destination' : `Stop ${i}`)

  // Reads the device position from the browser and drops a pin there
  const locateMe = () => {
    if (!navigator.geolocation) {
      alert('Geolocation is not supported by this browser')
      return
    }

    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const point = { id: Date.now(), lat: pos.coords.latitude, lng: pos.coords.longitude }
        addMarker(point)
        setFlyTarget(point)
      },
      () => alert('Could not get your location, permission may be denied'),
    )
  }

  return (
    <div className="app">
      <aside className="sidebar">
        <header>
          <h1>TrackerAid</h1>
          <p className="tagline">Interactive maps and live vehicle tracking, built with React and Leaflet</p>
        </header>

        {/* Route points the user picked */}
        <section className="panel">
          <h2>Route points</h2>
          <p className="hint">Click the map to set a start and a destination, then run the trip</p>

          <button className="btn btn-ghost" onClick={locateMe}>
            Use my location
          </button>

          {markers.length === 0 ? (
            <p className="empty">No points yet</p>
          ) : (
            <ul className="marker-list">
              {markers.map((m, i) => (
                <li key={m.id}>
                  <button className="marker-go" onClick={() => setFlyTarget(m)}>
                    <strong>{labelFor(i)}</strong>
                    <code>
                      {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                    </code>
                  </button>
                  <button
                    className="marker-del"
                    onClick={() => removeMarker(m.id)}
                    aria-label={`Remove ${labelFor(i)}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {markers.length > 0 && (
            <button className="btn btn-ghost" onClick={clearAll}>
              Clear all
            </button>
          )}
        </section>

        {/* Tracking controls */}
        <section className="panel">
          <h2>Live tracking</h2>

          {markers.length < 2 ? (
            <p className="hint">Pick at least two points on the map to start a trip</p>
          ) : routeError ? (
            <p className="error">{routeError}</p>
          ) : isLoadingRoute || !route ? (
            <p className="hint">Finding a route along the streets…</p>
          ) : (
            <>
              <p className="route-info">
                {formatKm(route.distance)} · about {formatMins(route.duration)} by car
              </p>

              <button
                className={isTracking ? 'btn btn-stop' : 'btn btn-start'}
                onClick={() => (isTracking ? setIsTracking(false) : handleStart())}
              >
                {isTracking ? 'Pause' : hasArrived ? 'Run again' : 'Start trip'}
              </button>

              <div className="progress">
                <div className="progress-bar" style={{ width: `${progress}%` }} />
              </div>

              <div className="coords">
                <span>{hasArrived ? 'Arrived' : `On the way — ${progress}%`}</span>
                {vehiclePos && (
                  <code>
                    {vehiclePos[0].toFixed(5)}, {vehiclePos[1].toFixed(5)}
                  </code>
                )}
              </div>
            </>
          )}
        </section>

        <footer className="credit">
          Built by Mohammad Amer Khalil ·{' '}
          <a href="https://github.com/Moham-Amer" target="_blank" rel="noreferrer">
            github.com/Moham-Amer
          </a>
        </footer>
      </aside>

      <main className="map-wrap">
        <MapContainer center={DAMASCUS} zoom={13} className="map" scrollWheelZoom>
          {/* OpenStreetMap tiles, attribution is required by their licence */}
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <ClickHandler onAdd={addMarker} />
          <FlyTo target={flyTarget} />

          {/* Green for the start, red for the destination, grey for stops in between */}
          {markers.map((m, i) => (
            <Marker
              key={m.id}
              position={[m.lat, m.lng]}
              icon={makeIcon(i === 0 ? '#16A34A' : i === markers.length - 1 ? '#DB4444' : '#6B7280', i + 1)}
            >
              <Popup>
                <strong>{labelFor(i)}</strong>
                <br />
                {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
              </Popup>
            </Marker>
          ))}

          {/* The planned route, dashed */}
          {path.length > 1 && (
            <Polyline positions={path} pathOptions={{ color: '#94A3B8', weight: 3, dashArray: '6 8' }} />
          )}

          {/* The part the vehicle already covered */}
          {travelled.length > 1 && (
            <Polyline positions={travelled} pathOptions={{ color: '#2563EB', weight: 5 }} />
          )}

          {/* The tracked vehicle */}
          {vehiclePos && (
            <Marker position={vehiclePos} icon={VEHICLE_ICON}>
              <Popup>
                Vehicle #1
                <br />
                {vehiclePos[0].toFixed(5)}, {vehiclePos[1].toFixed(5)}
              </Popup>
            </Marker>
          )}
        </MapContainer>
      </main>
    </div>
  )
}
