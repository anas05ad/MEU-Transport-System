# MEU Transport — Admin Panel

Admin web panel for the Middle East University shuttle system.
React 18 + Vite + Firebase (Firestore + Auth) + Google Maps.

## Running it

```bash
npm install
npm run dev
```

`.env` is included with the existing Firebase config.

**Rotate the Google Maps key before deploying.** The old key was committed in
`App.jsx` and has been shared; restricting it does not undo the exposure.
Create a new key, restrict it by HTTP referrer, enable only Maps JavaScript API
and Directions API, then put it in `.env` as `VITE_GOOGLE_MAPS_API_KEY`.

## Structure

```
src/
  main.jsx                 entry
  App.jsx                  routing, auth gate, sidebar, shell
  firebase.js              single Firebase init (db + auth)
  i18n.js                  en/ar, 225 keys each
  constants/campus.js      the one MEU coordinate
  utils/busStatus.js       shared status derivation
  context/
    AuthContext.jsx        onAuthStateChanged, loading state
    DataContext.jsx        all Firestore subscriptions, shared tick
  components/
    PageHeader.jsx
    ErrorBoundary.jsx
    ui/                    Button, Modal, Drawer, Toast, Table bits, states
  pages/
    Login.jsx
    Operations.jsx         live map + fleet status bar + attention queue
    Buses.jsx              data table
    Drivers.jsx
    RoutesPage.jsx         route list with coverage warnings
    RouteEditor.jsx        stops + timetable editing
    Stops.jsx              index across routes
    Timetables.jsx         departure matrix
    Incidents.jsx          open → acknowledged → resolved
    Settings.jsx           preferences, system info, danger zone, logs
  data/meuRoutes.js        the 24 official routes (reseed source)
  styles/tokens.css        design tokens
```

## Firestore

Document shapes are unchanged. The driver mobile app owns
`bus.location`, `bus.lastUpdated`, `bus.passengerCount`, `bus.status`,
and creates `reports`. The panel never writes those from a form.

Two additive fields are new and safe:
- `buses.serviceState` — `'out_of_service'` or absent
- `reports.resolved` / `resolvedAt` / `resolvedBy` / `resolutionNote` /
  `acknowledgedAt` / `acknowledgedBy`

Add a Firestore index on `reports` for `resolved` + `timestamp desc`.

## Known follow-ups

- Driver Auth accounts are created by a Cloud Function, not the panel.
  New drivers are saved with `accountStatus: 'pending'` until that exists.
- Buses still reference routes by name. Renaming a route batch-updates its
  buses; moving to `routeId` needs a coordinated driver-app release.
