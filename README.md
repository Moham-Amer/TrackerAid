# TrackerAid

An interactive map with live vehicle tracking, built with React and Leaflet.

**Live demo:** https://tracker-aid.vercel.app

![TrackerAid](./screenshot.png)

## Features

- Interactive map using OpenStreetMap tiles
- Click the map to set a start point and a destination (more stops can be added)
- Route list, click a point to fly to it or remove it
- "Use my location" using the browser Geolocation API
- Real driving routes: the route is fetched from the OSRM routing API so it follows actual streets instead of a straight line, and shows the distance and estimated driving time
- Live tracking: hit start and the vehicle drives along that route, drawing the path it covered with a live progress bar and updating coordinates

## Built with

- React 19 + Vite
- react-leaflet / Leaflet for the map (tile layer, markers, polyline, map events)
- `useMapEvents` for map clicks and `useMap` with `flyTo` for moving the map
- Custom `DivIcon` markers, since Leaflet's default image icons don't load properly under Vite
- The tracking loop runs in `setInterval` inside `useEffect`, cleared on unmount so it doesn't keep running

## About the tracking data

The route itself is real: it comes from the OSRM routing API, which returns the street-by-street path between the chosen points. The vehicle then steps through those coordinates on a timer to simulate live position updates. In a real fleet tracking system those positions would come from the vehicle over WebSocket or polling — the map and rendering side stays the same, only the data source changes.

## Running it

```bash
npm install
npm run dev
```

`npm run build` for a production build.
