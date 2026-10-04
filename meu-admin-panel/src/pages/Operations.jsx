import React, { useMemo, useState, useCallback, useEffect, useRef } from 'react';
import { GoogleMap, Marker, DirectionsRenderer, Polyline } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import { useNavigate } from 'react-router-dom';
import { CheckCircle2, AlertOctagon, WifiOff, RouteOff, Bus as BusIcon, ChevronDown, ChevronUp, PanelRightClose, PanelRightOpen } from 'lucide-react';

import PageHeader from '../components/PageHeader';
import { useData } from '../context/DataContext';
import { deriveBusStatus, sanitizeCoord, relativeTime, loadLevel } from '../utils/busStatus';
import { AMMAN_CENTER, MEU_CAMPUS_LATLNG } from '../constants/campus';
import { Button, StatusBadge, EmptyState, Drawer, ProgressBar, Spinner } from '../components/ui';
import './ops.css';

const SEGMENTS = ['on_route', 'idle', 'no_signal', 'offline'];
const STATUS_FILL = {
  on_route: '#067647', idle: '#1E73BE', no_signal: '#B54708',
  offline: '#475467', out_of_service: '#475467',
};

// Module-level counter — increments every time Operations mounts.
// This gives GoogleMap a unique key on each visit, forcing it to
// remount cleanly (same effect as a full page refresh for the map).
let mountCount = 0;

export default function Operations() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { buses, routes, reports, loading, now } = useData();

  const [filter, setFilter] = useState(null);
  const [selectedId, setSelectedId] = useState(null);
  const [showAllRoutes, setShowAllRoutes] = useState(false);
  const [isAttentionOpen, setIsAttentionOpen] = useState(true);
  const [isRailOpen, setIsRailOpen] = useState(true);
  const [mapReady, setMapReady] = useState(false);
  // Each time the page is visited, give GoogleMap a new key so it remounts fresh.
  const [mapKey] = useState(() => ++mountCount);
  const [directions, setDirections] = useState(null);
  const dirCache = React.useRef(new Map());

  /* ---- derive status once, share everywhere ---- */
  const enriched = useMemo(
    () => buses.map((b) => ({ ...b, state: deriveBusStatus(b, now) })),
    [buses, now]
  );

  const counts = useMemo(() => {
    const c = { on_route: 0, idle: 0, no_signal: 0, offline: 0, out_of_service: 0 };
    enriched.forEach((b) => { c[b.state] = (c[b.state] || 0) + 1; });
    return c;
  }, [enriched]);

  const openIncidents = useMemo(() => reports.filter((r) => !r.resolved), [reports]);

  const uncoveredRoutes = useMemo(() => {
    const covered = new Set(enriched.filter((b) => b.state === 'on_route').map((b) => b.route));
    return routes.filter((r) => !covered.has(r.name));
  }, [routes, enriched]);

  const visible = useMemo(() => {
    const list = enriched.filter((b) => b.state !== 'out_of_service');
    return filter ? list.filter((b) => b.state === filter) : list;
  }, [enriched, filter]);

  const selected = enriched.find((b) => b.id === selectedId) || null;

  /* ---- attention queue ---- */
  const attention = useMemo(() => {
    const rows = [];
    openIncidents.forEach((r) => rows.push({
      key: `i-${r.id}`, tone: 'critical', Icon: AlertOctagon,
      title: `${t('bus')} ${r.busNo ?? '—'} — ${r.issue || t('incident')}`,
      sub: r.driverName || '', onClick: () => navigate('/incidents'),
    }));
    enriched.filter((b) => b.state === 'offline').forEach((b) => rows.push({
      key: `o-${b.id}`, tone: 'critical', Icon: WifiOff,
      title: `${t('bus')} ${b.busNumber} — ${t('offline')}`,
      sub: `${t('last_seen')} ${relativeTime(b.lastUpdateTime, t)}`,
      onClick: () => setSelectedId(b.id),
    }));
    enriched.filter((b) => b.state === 'no_signal').forEach((b) => rows.push({
      key: `n-${b.id}`, tone: 'warn', Icon: WifiOff,
      title: `${t('bus')} ${b.busNumber} — ${t('no_signal')}`,
      sub: `${t('last_seen')} ${relativeTime(b.lastUpdateTime, t)}`,
      onClick: () => setSelectedId(b.id),
    }));
    uncoveredRoutes.slice(0, 6).forEach((r) => rows.push({
      key: `r-${r.id}`, tone: 'warn', Icon: RouteOff,
      title: r.name, sub: t('no_bus_assigned'),
      onClick: () => navigate(`/network/routes/${r.id}`),
    }));
    return rows;
  }, [openIncidents, enriched, uncoveredRoutes, t, navigate]);

  /* ---- directions, cached per route ---- */
  const selectBus = useCallback((bus) => {
    setSelectedId(bus.id);
    const route = routes.find((r) => r.name === bus.route);
    if (!route || !window.google) { setDirections(null); return; }

    if (dirCache.current.has(route.id)) { setDirections(dirCache.current.get(route.id)); return; }

    const waypoints = (route.stops || [])
      .map((s) => sanitizeCoord(s)).filter(Boolean)
      .map((location) => ({ location, stopover: true }));
    const origin = sanitizeCoord(route.startLocation) || bus.location;
    if (!origin) { setDirections(null); return; }

    new window.google.maps.DirectionsService().route(
      { origin, destination: MEU_CAMPUS_LATLNG, waypoints, travelMode: window.google.maps.TravelMode.DRIVING },
      (result, status) => {
        if (status === 'OK') { dirCache.current.set(route.id, result); setDirections(result); }
        else setDirections(null);
      }
    );
  }, [routes]);

  const closeDrawer = () => { setSelectedId(null); setDirections(null); };
  const total = SEGMENTS.reduce((s, k) => s + counts[k], 0) || 1;
  const busy = loading.buses || loading.routes;

  return (
    <>
      <PageHeader title={t('operations')} />
      <div className="ops">
        {/* ---------- FLEET STATUS BAR ---------- */}
        <div className="fsb">
          <div className="fsb__track" role="img"
               aria-label={t('fleet_status_label', { on_route: counts.on_route, idle: counts.idle, no_signal: counts.no_signal, offline: counts.offline })}>
            {SEGMENTS.map((k) => counts[k] > 0 && (
              <button key={k} type="button" className={`fsb__seg fsb__seg--${k}`}
                      style={{ width: `${(counts[k] / total) * 100}%` }}
                      aria-label={`${counts[k]} ${t(k)}`}
                      onClick={() => setFilter(filter === k ? null : k)} />
            ))}
          </div>

          <div className="fsb__legend">
            {SEGMENTS.map((k) => (
              <button key={k} type="button" className="fsb__item"
                      aria-pressed={filter === k} onClick={() => setFilter(filter === k ? null : k)}>
                <span className={`fsb__dot fsb__seg--${k}`} aria-hidden="true" />
                <span className="fsb__n tabular">{counts[k]}</span>
                <span>{t(`buses_${k === 'on_route' ? 'on_route' : k}`, t(k))}</span>
              </button>
            ))}
            <div className="fsb__alerts">
              <button type="button" className="fsb__item" onClick={() => navigate('/incidents')}>
                <AlertOctagon size={14} style={{ color: 'var(--color-status-critical)' }} aria-hidden="true" />
                <span className="fsb__n tabular">{openIncidents.length}</span>
                <span>{t('open_incidents')}</span>
              </button>
              <button type="button" className="fsb__item" onClick={() => navigate('/network/routes')}>
                <RouteOff size={14} style={{ color: 'var(--color-status-warn)' }} aria-hidden="true" />
                <span className="fsb__n tabular">{uncoveredRoutes.length}</span>
                <span>{t('routes_uncovered')}</span>
              </button>
            </div>
          </div>
        </div>

        {/* ---------- MAP + RAIL ---------- */}
        <div className="ops__body">
          <div className="ops__map">
            <div className="map-ctl">
              <Button size="sm" variant={showAllRoutes ? "primary" : "secondary"} aria-pressed={showAllRoutes}
                      onClick={() => {
                        if (showAllRoutes) {
                          // Reload the page to get a clean map with bus markers intact
                          window.location.href = '/operations';
                        } else {
                          setShowAllRoutes(true);
                        }
                      }}>
                {showAllRoutes ? t('hide_all_routes') : t('show_all_routes')}
              </Button>
            </div>

            <button 
              type="button" 
              className="rail-toggle-btn"
              onClick={() => setIsRailOpen((v) => !v)}
              title={isRailOpen ? t('collapse_panel') : t('expand_panel')}
            >
              {isRailOpen ? <PanelRightClose size={18} /> : <PanelRightOpen size={18} />}
            </button>

            {!window.google ? (
              <div className="map-fallback">
                <EmptyState icon={BusIcon} title={t('error_map')} body={t('error_map_hint')} />
              </div>
            ) : (
              <GoogleMap
                key={mapKey}
                mapContainerStyle={{ width: '100%', height: '100%' }}
                center={AMMAN_CENTER} zoom={12}
                onLoad={() => setMapReady(true)}
                onUnmount={() => setMapReady(false)}
                options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false,
                           styles: [{ featureType: 'poi', stylers: [{ visibility: 'off' }] },
                                    { featureType: 'transit', stylers: [{ visibility: 'off' }] }] }}
              >
                {mapReady && showAllRoutes && routes.map((r) => {
                  const path = [sanitizeCoord(r.startLocation), ...(r.stops || []).map(sanitizeCoord),
                                MEU_CAMPUS_LATLNG].filter(Boolean);
                  return path.length > 1 && (
                    <Polyline key={r.id} path={path}
                              options={{ strokeColor: '#475467', strokeOpacity: 0.25, strokeWeight: 3 }} />
                  );
                })}

                {mapReady && directions && selected && (
                  <DirectionsRenderer directions={directions} options={{
                    routeIndex: 0,
                    polylineOptions: { strokeColor: '#921A1D', strokeWeight: 5, strokeOpacity: 0.7 },
                    suppressMarkers: true, preserveViewport: true,
                  }} />
                )}

                {/* Keep ALL located buses in the React tree at all times.
                    Use the native Maps `visible` prop to show/hide instead of
                    filtering — this prevents markers disappearing after navigation
                    because React never unmounts/remounts them mid-session. */}
                {mapReady && visible.filter((b) => b.location).map((b) => {
                  const isLive = b.state === 'on_route' || b.state === 'idle';
                  return (
                    <Marker
                      key={b.id}
                      position={b.location}
                      visible={isLive}
                      onClick={() => selectBus(b)}
                      title={`${t('bus')} ${b.busNumber} — ${t(b.state)}`}
                      label={{ text: String(b.busNumber ?? ''), color: '#fff', fontWeight: '700', fontSize: '12px' }}
                      opacity={1}
                      icon={{
                        path: window.google.maps.SymbolPath.CIRCLE,
                        scale: b.id === selectedId ? 20 : 16,
                        fillColor: STATUS_FILL[b.state],
                        fillOpacity: 1,
                        strokeColor: b.id === selectedId ? '#921A1D' : '#fff',
                        strokeWeight: b.id === selectedId ? 4 : 2,
                      }}
                    />
                  );
                })}
              </GoogleMap>
            )}
          </div>

          {/* ---------- RIGHT RAIL ---------- */}
          <aside className={`ops__rail ${!isRailOpen ? 'ops__rail--collapsed' : ''}`}>
            <div className="rail__section">
              <div 
                className="rail__title" 
                onClick={() => setIsAttentionOpen(!isAttentionOpen)}
                style={{ cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'space-between', userSelect: 'none' }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <span>{t('needs_attention')}</span>
                  <span className="tabular">{attention.length}</span>
                </div>
                {isAttentionOpen ? <ChevronUp size={18} /> : <ChevronDown size={18} />}
              </div>
              {isAttentionOpen && (
                busy ? <Spinner /> : attention.length === 0 ? (
                  <EmptyState icon={CheckCircle2} tone="ok" title={t('all_clear')} body={t('all_clear_body')} />
                ) : (
                  <div className="att">
                    {attention.map(({ key, tone, Icon, title, sub, onClick }) => (
                      <button key={key} type="button" className={`att__row att__row--${tone}`} onClick={onClick}>
                        <Icon size={16} aria-hidden="true"
                              style={{ flex: 'none', marginTop: 2, color: `var(--color-status-${tone})` }} />
                        <span>
                          <span className="att__ttl">{title}</span>
                          {sub && <span className="att__sub" style={{ display: 'block' }}>{sub}</span>}
                        </span>
                      </button>
                    ))}
                  </div>
                )
              )}
            </div>

            <div className="rail__section" style={{ borderTop: '1px solid var(--color-border)' }}>
              <div className="rail__title">
                <span>{t('all_buses')}</span>
                <span className="tabular">{visible.length}</span>
              </div>
              <div className="buslist">
                {visible.map((b) => (
                  <button key={b.id} type="button" className="buslist__row" onClick={() => selectBus(b)}>
                    <span className={`dot dot--${b.state}`} aria-hidden="true" />
                    <span style={{ minWidth: 0 }}>
                      <span className="buslist__num tabular">{b.busNumber}</span>
                      <span className="buslist__route" style={{ display: 'block' }}>{b.route || t('unassigned')}</span>
                    </span>
                    <span className="tabular" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      {b.passengerCount ?? 0}/{b.capacity ?? '—'}
                    </span>
                  </button>
                ))}
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* ---------- DETAIL DRAWER ---------- */}
      {selected && (
        <Drawer title={`${t('bus')} ${selected.busNumber}`} subtitle={selected.driverName || t('unassigned')}
                onClose={closeDrawer}>
          <div style={{ marginBottom: 'var(--space-5)' }}>
            <StatusBadge status={selected.state} />
          </div>

          <div style={{ background: 'var(--color-surface-alt)', padding: 'var(--space-4)',
                        borderRadius: 'var(--radius-md)', marginBottom: 'var(--space-5)' }}>
            <div style={{ fontSize: 'var(--text-micro)', textTransform: 'uppercase',
                          letterSpacing: '.06em', color: 'var(--color-text-muted)' }}>
              {t('live_passengers')}
            </div>
            <div className="tabular" style={{ fontSize: 28, fontWeight: 700, margin: '4px 0 8px' }}>
              {selected.passengerCount ?? 0}
              <span style={{ fontSize: 16, color: 'var(--color-text-muted)', fontWeight: 400 }}>
                {' / '}{selected.capacity ?? '—'}
              </span>
            </div>
            <ProgressBar value={selected.passengerCount ?? 0} max={Number(selected.capacity) || 0}
                         level={loadLevel(selected.passengerCount, selected.capacity)} label={t('load')} />
          </div>

          <Row label={t('route')} value={selected.route || t('unassigned')} />
          <Row label={t('destination')} value={t('meu_campus')} />
          <Row label={t('speed')} value={`${selected.speed ?? 0} ${t('kmh')}`} />
          <Row label={t('last_seen')} value={relativeTime(selected.lastUpdateTime, t)} />

          <div style={{ marginTop: 'var(--space-5)' }}>
            <Button variant="secondary" block onClick={() => navigate('/fleet/buses')}>
              {t('bus_management')}
            </Button>
          </div>
        </Drawer>
      )}
    </>
  );
}

function Row({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', gap: 'var(--space-4)',
                  padding: '10px 0', borderBottom: '1px solid var(--color-border)', fontSize: 'var(--text-sm)' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span style={{ fontWeight: 500, textAlign: 'end' }}>{value}</span>
    </div>
  );
}
