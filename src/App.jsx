import { useState, useEffect, useRef, useCallback } from 'react'
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMapEvents, useMap } from 'react-leaflet'
import L from 'leaflet'
import 'leaflet/dist/leaflet.css'
import { ROUTE } from './route'
import './index.css'

// Leaflet's default icons don't load correctly with Vite, so building custom ones
const makeIcon = (color) =>
  new L.DivIcon({
    className: 'pin-icon',
    html: `<div class="pin" style="background:${color}"></div>`,
    iconSize: [18, 18],
    iconAnchor: [9, 9],
  })

const PIN_ICON = makeIcon('#DB4444')

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
const UPDATE_MS = 700

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
  const [routeIndex, setRouteIndex] = useState(0)
  const intervalRef = useRef(null)

  // Steps through the route points on a timer to simulate live position updates
  useEffect(() => {
    if (!isTracking) return

    intervalRef.current = setInterval(() => {
      setRouteIndex((i) => (i + 1) % ROUTE.length)
    }, UPDATE_MS)

    // Clear the timer when tracking stops or the component unmounts
    return () => clearInterval(intervalRef.current)
  }, [isTracking])

  const vehiclePos = ROUTE[routeIndex]
  const travelled = ROUTE.slice(0, routeIndex + 1)

  const addMarker = useCallback((point) => {
    setMarkers((prev) => [...prev, point])
  }, [])

  const removeMarker = (id) => {
    setMarkers((prev) => prev.filter((m) => m.id !== id))
  }

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

        {/* Tracking controls */}
        <section className="panel">
          <h2>Live tracking</h2>
          <p className="hint">Simulates position updates coming in for a vehicle and draws its route as it moves</p>

          <button
            className={isTracking ? 'btn btn-stop' : 'btn btn-start'}
            onClick={() => setIsTracking((v) => !v)}
          >
            {isTracking ? 'Stop tracking' : 'Start tracking'}
          </button>

          <div className="coords">
            <span>Vehicle position</span>
            <code>
              {vehiclePos[0].toFixed(5)}, {vehiclePos[1].toFixed(5)}
            </code>
          </div>
        </section>

        {/* Pins the user dropped on the map */}
        <section className="panel">
          <h2>Saved locations</h2>
          <p className="hint">Click anywhere on the map to drop a pin</p>

          <button className="btn btn-ghost" onClick={locateMe}>
            Use my location
          </button>

          {markers.length === 0 ? (
            <p className="empty">No locations yet</p>
          ) : (
            <ul className="marker-list">
              {markers.map((m, i) => (
                <li key={m.id}>
                  <button className="marker-go" onClick={() => setFlyTarget(m)}>
                    <strong>Point {i + 1}</strong>
                    <code>
                      {m.lat.toFixed(4)}, {m.lng.toFixed(4)}
                    </code>
                  </button>
                  <button
                    className="marker-del"
                    onClick={() => removeMarker(m.id)}
                    aria-label={`Remove point ${i + 1}`}
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          {markers.length > 0 && (
            <button className="btn btn-ghost" onClick={() => setMarkers([])}>
              Clear all
            </button>
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

          {/* User pins */}
          {markers.map((m, i) => (
            <Marker key={m.id} position={[m.lat, m.lng]} icon={PIN_ICON}>
              <Popup>
                <strong>Point {i + 1}</strong>
                <br />
                {m.lat.toFixed(5)}, {m.lng.toFixed(5)}
              </Popup>
            </Marker>
          ))}

          {/* Path the vehicle already covered */}
          {travelled.length > 1 && (
            <Polyline positions={travelled} pathOptions={{ color: '#2563EB', weight: 4 }} />
          )}

          {/* The tracked vehicle */}
          <Marker position={vehiclePos} icon={VEHICLE_ICON}>
            <Popup>
              Vehicle #1
              <br />
              {vehiclePos[0].toFixed(5)}, {vehiclePos[1].toFixed(5)}
            </Popup>
          </Marker>
        </MapContainer>
      </main>
    </div>
  )
}
