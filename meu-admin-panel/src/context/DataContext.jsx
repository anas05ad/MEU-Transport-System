// One place that subscribes to Firestore, so every screen shares the same
// snapshot and the map / table / status bar can never disagree.
import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { collection, onSnapshot, query, orderBy } from 'firebase/firestore';
import { db } from '../firebase';
import { toMillis, sanitizeCoord } from '../utils/busStatus';

const DataCtx = createContext(null);
export const useData = () => useContext(DataCtx);

// Ticker drives relative times and status decay. 5s default, not 1s:
// a 1s tick re-rendered every marker 60x a minute for no gain.
// Configurable from Settings — the control there is genuinely wired.
export const TICK_MS = 5000;
export const readTickMs = () => Number(localStorage.getItem('meu.mapRefresh')) || TICK_MS;

export function DataProvider({ children }) {
  const [buses, setBuses] = useState([]);
  const [drivers, setDrivers] = useState([]);
  const [routes, setRoutes] = useState([]);
  const [reports, setReports] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState({ buses: true, drivers: true, routes: true, reports: true, logs: true });
  const [error, setError] = useState(null);
  const [now, setNow] = useState(Date.now());

  const [tickMs, setTickMs] = useState(readTickMs);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), tickMs);
    return () => clearInterval(id);
  }, [tickMs]);

  // Settings writes localStorage then fires this event, so the change
  // takes effect immediately instead of on next reload.
  useEffect(() => {
    const sync = () => setTickMs(readTickMs());
    window.addEventListener('meu:refresh-changed', sync);
    window.addEventListener('storage', sync);
    return () => {
      window.removeEventListener('meu:refresh-changed', sync);
      window.removeEventListener('storage', sync);
    };
  }, []);

  const fail = useCallback((k) => (e) => {
    console.error(`[firestore] ${k}`, e);
    setError(e);
    setLoading((p) => ({ ...p, [k]: false }));
  }, []);
  const done = useCallback((k) => setLoading((p) => ({ ...p, [k]: false })), []);

  useEffect(() => onSnapshot(collection(db, 'buses'), (snap) => {
    setBuses(snap.docs.map((d) => {
      const data = d.data();
      return { id: d.id, ...data, location: sanitizeCoord(data.location), lastUpdateTime: toMillis(data.lastUpdated) };
    }));
    done('buses');
  }, fail('buses')), [done, fail]);

  useEffect(() => onSnapshot(collection(db, 'drivers'), (snap) => {
    setDrivers(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    done('drivers');
  }, fail('drivers')), [done, fail]);

  useEffect(() => onSnapshot(collection(db, 'routes'), (snap) => {
    setRoutes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    done('routes');
  }, fail('routes')), [done, fail]);

  useEffect(() => onSnapshot(query(collection(db, 'reports'), orderBy('timestamp', 'desc')), (snap) => {
    setReports(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    done('reports');
  }, fail('reports')), [done, fail]);

  useEffect(() => onSnapshot(query(collection(db, 'system_logs'), orderBy('timestamp', 'desc')), (snap) => {
    setLogs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    done('logs');
  }, fail('logs')), [done, fail]);

  return (
    <DataCtx.Provider value={{ buses, drivers, routes, reports, logs, loading, error, now }}>
      {children}
    </DataCtx.Provider>
  );
}
