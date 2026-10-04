// Shared bus status derivation. Used by every screen so the map,
// the table and the status bar can never disagree.

export const LIVE_MS  = 30_000;   // position considered fresh
export const STALE_MS = 120_000;  // beyond this the bus is offline
export const IDLE_MS  = 600_000;  // stationary this long while active

export const BUS_STATES = ['on_route', 'idle', 'no_signal', 'offline', 'out_of_service'];

export function deriveBusStatus(bus, now = Date.now()) {
  if (!bus) return 'offline';
  if (bus.serviceState === 'out_of_service') return 'out_of_service';

  const age = now - (bus.lastUpdateTime ?? 0);
  if (bus.status !== 'Active') return 'offline';
  if (age > STALE_MS) return 'offline';
  if (age > LIVE_MS) return 'no_signal';

  // speed / movingSince are written by the driver app (BC-4).
  // Until they exist this branch never fires, which is correct.
  if ((bus.speed ?? 0) === 0 && bus.movingSince && now - bus.movingSince > IDLE_MS) {
    return 'idle';
  }
  return 'on_route';
}

/** Normalise a Firestore timestamp / date / number into epoch millis. */
export function toMillis(value) {
  if (!value) return 0;
  if (typeof value.toMillis === 'function') return value.toMillis();
  const ms = new Date(value).getTime();
  return Number.isNaN(ms) ? 0 : ms;
}

/** Tolerates {lat,lng} and {latitude,longitude}; rejects 0/0 and NaN. */
export function sanitizeCoord(loc) {
  if (!loc) return null;
  const lat = parseFloat(loc.lat ?? loc.latitude);
  const lng = parseFloat(loc.lng ?? loc.longitude);
  if (Number.isNaN(lat) || Number.isNaN(lng) || lat === 0 || lng === 0) return null;
  return { lat, lng };
}

export function relativeTime(ms, t) {
  if (!ms) return '—';
  const s = Math.max(0, Math.floor((Date.now() - ms) / 1000));
  if (s < 60) return t('seconds_ago', { count: s });
  const m = Math.floor(s / 60);
  if (m < 60) return t('minutes_ago', { count: m });
  const h = Math.floor(m / 60);
  if (h < 24) return t('hours_ago', { count: h });
  return t('days_ago', { count: Math.floor(h / 24) });
}

export function loadLevel(count, capacity) {
  const cap = Number(capacity) || 0;
  if (!cap) return 'none';
  const pct = (Number(count) || 0) / cap;
  if (pct > 0.9) return 'critical';
  if (pct >= 0.7) return 'warn';
  return 'ok';
}
