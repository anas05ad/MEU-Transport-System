import { useEffect, useMemo, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { addDoc, updateDoc, doc, collection, getDocs, query, where, writeBatch } from 'firebase/firestore';
import { GoogleMap, Marker, Polyline, DirectionsRenderer } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import { Plus, X, ArrowUp, ArrowDown, MapPin } from 'lucide-react';

import PageHeader from '../components/PageHeader';
import { db } from '../firebase';
import { useData } from '../context/DataContext';
import { sanitizeCoord } from '../utils/busStatus';
import { MEU_CAMPUS, MEU_CAMPUS_LATLNG, AMMAN_CENTER } from '../constants/campus';
import { Button, Field, Input, EmptyState, useToast, ConfirmDialog } from '../components/ui';

const EMPTY = {
  name: '',
  startLocation: { latitude: '', longitude: '' },
  endLocation: MEU_CAMPUS,
  stops: [],
  pickupTimes: [],
  returnTimes: [],
};

export default function RouteEditor() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { routeId } = useParams();
  const { routes, buses } = useData();

  const isNew = routeId === 'new';
  const existing = useMemo(() => routes.find((r) => r.id === routeId), [routes, routeId]);

  const [form, setForm] = useState(EMPTY);
  const [clickMode, setClickMode] = useState('start'); // 'start' | 'waypoint' | 'stop'
  const [activeTab, setActiveTab] = useState('pickup'); // 'pickup' | 'return'
  const [routeWaypoints, setRouteWaypoints] = useState([]); // Pickup road guide points
  const [returnRouteWaypoints, setReturnRouteWaypoints] = useState([]); // Return road guide points
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmLeave, setConfirmLeave] = useState(false);

  useEffect(() => {
    if (isNew) { setForm(EMPTY); setRouteWaypoints([]); setReturnRouteWaypoints([]); return; }
    if (existing) {
      setForm({
        name: existing.name || '',
        startLocation: existing.startLocation || { latitude: '', longitude: '' },
        endLocation: MEU_CAMPUS,
        stops: existing.stops || [],
        pickupTimes: existing.pickupTimes || [],
        returnTimes: existing.returnTimes || [],
      });
      setRouteWaypoints(existing.routeWaypoints || []);
      setReturnRouteWaypoints(existing.returnRouteWaypoints || []);
      setDirty(false);
    }
  }, [existing, isNew]);

  const patch = (next) => { setForm((f) => ({ ...f, ...next })); setDirty(true); };

  // Pickup Route: Exactly user-drawn points in order (Start -> Route Points -> Stop Stations)
  const pickupPath = useMemo(() => {
    const pts = [
      sanitizeCoord(form.startLocation),
      ...routeWaypoints.map(sanitizeCoord),
      ...form.stops.map(sanitizeCoord),
    ].filter(Boolean);
    // Append MEU campus only if user has added points leading towards it
    if (pts.length >= 2) pts.push(MEU_CAMPUS_LATLNG);
    return pts;
  }, [form, routeWaypoints]);

  // Return Route: Exactly user-drawn points in order (MEU Campus -> Stop Stations -> Return Points -> Start Location)
  const returnPath = useMemo(() => {
    const pts = [
      MEU_CAMPUS_LATLNG,
      ...[...form.stops].reverse().map(sanitizeCoord),
      ...returnRouteWaypoints.map(sanitizeCoord),
    ].filter(Boolean);
    if (sanitizeCoord(form.startLocation) && pts.length >= 2) {
      pts.push(sanitizeCoord(form.startLocation));
    }
    return pts;
  }, [form, returnRouteWaypoints]);

  const activePath = activeTab === 'pickup' ? pickupPath : returnPath;

  const [pickupDirections, setPickupDirections] = useState(null);
  const [returnDirections, setReturnDirections] = useState(null);
  const [isGenerating, setIsGenerating] = useState(false);

  const generateRoute = () => {
    if (!window.google?.maps) return;
    const isPickup = activeTab === 'pickup';
    const targetPath = isPickup ? pickupPath : returnPath;

    if (targetPath.length < 2) {
      toast('Please add a Start Location and points/stops first', 'error');
      return;
    }

    setIsGenerating(true);
    const ds = new window.google.maps.DirectionsService();
    ds.route(
      {
        origin: targetPath[0],
        destination: targetPath[targetPath.length - 1],
        waypoints: targetPath.slice(1, -1).map((loc) => ({ location: loc, stopover: true })),
        travelMode: window.google.maps.TravelMode.DRIVING,
        optimizeWaypoints: false,
        provideRouteAlternatives: false,
      },
      (res, status) => {
        setIsGenerating(false);
        if (status === 'OK') {
          if (isPickup) setPickupDirections(res);
          else setReturnDirections(res);
          toast(`Calculated ${isPickup ? 'Pickup' : 'Return'} street route successfully!`);
        } else {
          toast('Could not calculate route for selected points: ' + status, 'error');
        }
      }
    );
  };

  /* ---- stops ---- */
  const addStop = () => patch({ stops: [...form.stops, { name: '', latitude: '', longitude: '' }] });
  const setStop = (i, key, val) => {
    const stops = [...form.stops];
    stops[i] = { ...stops[i], [key]: val };
    patch({ stops });
  };
  const removeStop = (i) => patch({ stops: form.stops.filter((_, x) => x !== i) });
  const moveStop = (i, delta) => {
    const j = i + delta;
    if (j < 0 || j >= form.stops.length) return;
    const stops = [...form.stops];
    [stops[i], stops[j]] = [stops[j], stops[i]];
    patch({ stops });
  };

  /* ---- times ---- */
  const addTime = (key) => patch({ [key]: [...form[key], ''] });
  const setTime = (key, i, val) => {
    const arr = [...form[key]]; arr[i] = val; patch({ [key]: arr });
  };
  const removeTime = (key, i) => patch({ [key]: form[key].filter((_, x) => x !== i) });

  const save = async () => {
    if (!form.name.trim()) { toast(t('required_field'), 'error'); return; }
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(),
        startLocation: {
          latitude: Number(form.startLocation.latitude) || 0,
          longitude: Number(form.startLocation.longitude) || 0,
        },
        endLocation: MEU_CAMPUS,
        stops: form.stops
          .filter((s) => s.name?.trim())
          .map((s) => ({ name: s.name.trim(), latitude: Number(s.latitude) || 0, longitude: Number(s.longitude) || 0 })),
        routeWaypoints: routeWaypoints.map((w) => ({ latitude: Number(w.latitude) || 0, longitude: Number(w.longitude) || 0 })),
        returnRouteWaypoints: returnRouteWaypoints.map((w) => ({ latitude: Number(w.latitude) || 0, longitude: Number(w.longitude) || 0 })),
        pickupTimes: form.pickupTimes.filter(Boolean).sort(),
        returnTimes: form.returnTimes.filter(Boolean).sort(),
      };

      if (isNew) {
        await addDoc(collection(db, 'routes'), payload);
      } else {
        const oldName = existing?.name;
        await updateDoc(doc(db, 'routes', routeId), payload);

        // Buses reference the route by NAME (see BC-3). Renaming without this
        // batch would silently orphan every bus on the route.
        if (oldName && oldName !== payload.name) {
          const snap = await getDocs(query(collection(db, 'buses'), where('route', '==', oldName)));
          if (!snap.empty) {
            const batch = writeBatch(db);
            snap.docs.forEach((d) => batch.update(d.ref, { route: payload.name }));
            await batch.commit();
          }
        }
      }
      setDirty(false);
      toast(t('route_saved'));
      navigate('/network/routes');
    } catch (err) {
      console.error('[routes] save', err);
      toast(t('save_failed'), 'error');
    } finally { setSaving(false); }
  };

  const leave = () => { if (dirty) setConfirmLeave(true); else navigate('/network/routes'); };
  const assignedCount = buses.filter((b) => b.route === form.name).length;

  if (!isNew && !existing) {
    return (
      <>
        <PageHeader title={t('routes')} />
        <div className="page-content"><EmptyState title={t('not_found')} /></div>
      </>
    );
  }

  return (
    <>
      <PageHeader title={isNew ? t('new_route') : t('edit_route')} actions={
        <>
          <Button variant="secondary" onClick={leave}>{t('cancel')}</Button>
          <Button variant="primary" onClick={save} loading={saving} disabled={!dirty && !isNew}>
            {t('save_changes')}
          </Button>
        </>
      } />

      <div className="page-content" style={{ display: 'grid', gridTemplateColumns: 'minmax(380px,440px) 1fr', gap: 'var(--space-5)', alignItems: 'start' }}>
        {/* ---- FORM ---- */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <div className="card"><div className="card__body">
            <Field label={t('route_name')} required htmlFor="r-name">
              <Input id="r-name" value={form.name} onChange={(e) => patch({ name: e.target.value })} placeholder="e.g. Sweifieh / 7th Circle" />
            </Field>
            {!isNew && (
              <div style={{ fontSize: 'var(--text-sm)', color: 'var(--color-text-muted)' }}>
                {assignedCount} {t('assigned_buses')}
              </div>
            )}
          </div></div>

          {/* ---- STOPS LIST ---- */}
          <div className="card">
            <div className="card__head">
              <h2 className="card__title">{t('stops')} ({form.stops.length})</h2>
            </div>
            <div className="card__body">
              {form.stops.length === 0 ? (
                <EmptyState icon={MapPin} title="No stops placed yet" body="Click '🚏 Add Stop Station' on the map to place stop stations." />
              ) : form.stops.map((s, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 'var(--space-3)' }}>
                  <span style={{ fontSize: 'var(--text-xs)', fontWeight: 700, minWidth: 24, textAlign: 'center', background: '#1E73BE', color: '#fff', borderRadius: '50%', width: 22, height: 22, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                    {i + 1}
                  </span>
                  <Field label={undefined} htmlFor={`s-n-${i}`} style={{ flex: 1, marginBottom: 0 }}>
                    <Input id={`s-n-${i}`} value={s.name || ''} placeholder={`Stop Station ${i + 1} Name`} onChange={(e) => setStop(i, 'name', e.target.value)} />
                  </Field>
                  <div style={{ display: 'flex', gap: 2 }}>
                    <button type="button" className="icon-btn" aria-label="up" onClick={() => moveStop(i, -1)}><ArrowUp size={14} /></button>
                    <button type="button" className="icon-btn" aria-label="down" onClick={() => moveStop(i, 1)}><ArrowDown size={14} /></button>
                    <button type="button" className="icon-btn" aria-label={t('remove_stop')} onClick={() => removeStop(i)}><X size={14} /></button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* ---- TIMETABLE ---- */}
          <div className="card">
            <div className="card__head"><h2 className="card__title">{t('timetables')}</h2></div>
            <div className="card__body">
              {['pickupTimes', 'returnTimes'].map((key) => (
                <div key={key} style={{ marginBottom: 'var(--space-5)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                                marginBottom: 'var(--space-2)' }}>
                    <span className="field__label">{t(key === 'pickupTimes' ? 'pickup_times' : 'return_times')}</span>
                    <Button size="sm" variant="ghost" onClick={() => addTime(key)}>
                      <Plus size={14} aria-hidden="true" />{t('add_time')}
                    </Button>
                  </div>
                  <div className="chips">
                    {form[key].map((time, i) => (
                      <span key={i} style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                        <input type="time" className="input" style={{ width: 118 }} dir="ltr" value={time}
                               aria-label={`${t(key === 'pickupTimes' ? 'pickup' : 'return')} ${i + 1}`}
                               onChange={(e) => setTime(key, i, e.target.value)} />
                        <button type="button" className="icon-btn" aria-label={t('delete')} onClick={() => removeTime(key, i)}>
                          <X size={14} />
                        </button>
                      </span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ---- MAP ---- */}
        <div className="card" style={{ position: 'sticky', top: 0, height: 'calc(100dvh - 190px)', overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
          {/* Tab Switcher: Pickup Route vs Return Route */}
          <div style={{ display: 'flex', borderBottom: '1px solid var(--color-border)', background: 'var(--color-surface)' }}>
            <button
              type="button"
              style={{
                flex: 1, padding: '10px', fontWeight: 600, fontSize: 'var(--text-sm)', border: 'none',
                background: activeTab === 'pickup' ? 'var(--color-surface)' : 'var(--color-surface-alt)',
                color: activeTab === 'pickup' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderBottom: activeTab === 'pickup' ? '3px solid var(--color-primary)' : '3px solid transparent',
                cursor: 'pointer'
              }}
              onClick={() => setActiveTab('pickup')}
            >
              🚌 Pickup Route (to MEU)
            </button>
            <button
              type="button"
              style={{
                flex: 1, padding: '10px', fontWeight: 600, fontSize: 'var(--text-sm)', border: 'none',
                background: activeTab === 'return' ? 'var(--color-surface)' : 'var(--color-surface-alt)',
                color: activeTab === 'return' ? 'var(--color-primary)' : 'var(--color-text-muted)',
                borderBottom: activeTab === 'return' ? '3px solid var(--color-primary)' : '3px solid transparent',
                cursor: 'pointer'
              }}
              onClick={() => setActiveTab('return')}
            >
              🔄 Return Route (from MEU)
            </button>
          </div>

          <div style={{ padding: '8px 12px', background: 'var(--color-surface-alt)', borderBottom: '1px solid var(--color-border)', display: 'flex', alignItems: 'center', gap: '8px', flexWrap: 'wrap' }}>
            <span style={{ fontSize: 'var(--text-xs)', fontWeight: 600 }}>Map Mode ({activeTab === 'pickup' ? 'Pickup' : 'Return'}):</span>
            <Button size="sm" variant={clickMode === 'start' ? 'primary' : 'secondary'} onClick={() => setClickMode('start')}>
              📍 Set Start Point
            </Button>
            <Button size="sm" variant={clickMode === 'waypoint' ? 'primary' : 'secondary'} onClick={() => setClickMode('waypoint')}>
              🛣️ Add Route Point
            </Button>
            <Button size="sm" variant={clickMode === 'stop' ? 'primary' : 'secondary'} onClick={() => setClickMode('stop')}>
              🚏 Add Stop Station
            </Button>

            <Button size="sm" variant="primary" loading={isGenerating} onClick={generateRoute} style={{ background: '#2e7d32', borderColor: '#2e7d32' }}>
              ✨ Confirm & Draw Route
            </Button>

            {activeTab === 'pickup' ? (
              <Button size="sm" variant="ghost" disabled={routeWaypoints.length === 0} onClick={() => {
                setRouteWaypoints([]);
                setPickupDirections(null);
                window.location.reload();
              }}>
                🗑️ Clear Pickup Points ({routeWaypoints.length})
              </Button>
            ) : (
              <Button size="sm" variant="ghost" disabled={returnRouteWaypoints.length === 0} onClick={() => {
                setReturnRouteWaypoints([]);
                setReturnDirections(null);
                window.location.reload();
              }}>
                🗑️ Clear Return Points ({returnRouteWaypoints.length})
              </Button>
            )}
            <Button size="sm" variant="ghost" disabled={form.stops.length === 0} onClick={() => {
              patch({ stops: [] });
              setPickupDirections(null);
              setReturnDirections(null);
              window.location.reload();
            }}>
              🗑️ Clear Stops ({form.stops.length})
            </Button>
          </div>
          <div style={{ flex: 1, position: 'relative' }}>
            {window.google ? (
              <GoogleMap mapContainerStyle={{ width: '100%', height: '100%' }}
                         center={AMMAN_CENTER} zoom={12}
                         options={{ streetViewControl: false, mapTypeControl: false, fullscreenControl: false, cursor: 'crosshair' }}
                         onClick={(e) => {
                           if (!e.latLng) return;
                           const lat = e.latLng.lat().toFixed(6);
                           const lng = e.latLng.lng().toFixed(6);
                           if (clickMode === 'start') {
                             patch({ startLocation: { latitude: lat, longitude: lng } });
                             toast(`Start Location set: ${lat}, ${lng}`);
                           } else if (clickMode === 'waypoint') {
                             if (activeTab === 'pickup') {
                               setRouteWaypoints([...routeWaypoints, { latitude: lat, longitude: lng }]);
                             } else {
                               setReturnRouteWaypoints([...returnRouteWaypoints, { latitude: lat, longitude: lng }]);
                             }
                             setDirty(true);
                             toast(`Added ${activeTab === 'pickup' ? 'Pickup' : 'Return'} Route Point`);
                           } else {
                             const newStop = { name: `Stop ${form.stops.length + 1}`, latitude: lat, longitude: lng };
                             patch({ stops: [...form.stops, newStop] });
                             toast(`Added Stop Station ${form.stops.length + 1}`);
                           }
                         }}>
                {(activeTab === 'pickup' ? pickupDirections : returnDirections) && (
                  <DirectionsRenderer directions={activeTab === 'pickup' ? pickupDirections : returnDirections} options={{
                    routeIndex: 0,
                    polylineOptions: {
                      strokeColor: activeTab === 'pickup' ? '#921A1D' : '#1E73BE',
                      strokeWeight: 5,
                      strokeOpacity: 0.8
                    },
                    suppressMarkers: true,
                    preserveViewport: true,
                  }} />
                )}
                {sanitizeCoord(form.startLocation) && (
                  <Marker position={sanitizeCoord(form.startLocation)} title={t('start_location')}
                          draggable={true}
                          onRightClick={() => {
                            patch({ startLocation: { latitude: '', longitude: '' } });
                            toast('Start Location cleared');
                          }}
                          onDragEnd={(e) => {
                            if (!e.latLng) return;
                            patch({ startLocation: { latitude: e.latLng.lat().toFixed(6), longitude: e.latLng.lng().toFixed(6) } });
                          }}
                          label={{ text: 'S', color: '#fff', fontSize: '11px', fontWeight: '700' }}
                          icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 12,
                                  fillColor: '#2e7d32', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }} />
                )}
                {/* Active Tab Route Waypoints */}
                {(activeTab === 'pickup' ? routeWaypoints : returnRouteWaypoints).map(sanitizeCoord).map((coord, i) => coord && (
                  <Marker key={`wp-${activeTab}-${i}`} position={coord}
                          draggable={true}
                          onRightClick={() => {
                            if (activeTab === 'pickup') {
                              setRouteWaypoints(routeWaypoints.filter((_, idx) => idx !== i));
                            } else {
                              setReturnRouteWaypoints(returnRouteWaypoints.filter((_, idx) => idx !== i));
                            }
                            setDirty(true);
                            toast(`Removed ${activeTab} Point ${i + 1}`);
                          }}
                          onDragEnd={(e) => {
                            if (!e.latLng) return;
                            const next = [...(activeTab === 'pickup' ? routeWaypoints : returnRouteWaypoints)];
                            next[i] = { latitude: e.latLng.lat().toFixed(6), longitude: e.latLng.lng().toFixed(6) };
                            if (activeTab === 'pickup') setRouteWaypoints(next);
                            else setReturnRouteWaypoints(next);
                            setDirty(true);
                          }}
                          title={`${activeTab === 'pickup' ? 'Pickup' : 'Return'} Route Point ${i + 1} (Right-click to remove)`}
                          icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 8,
                                  fillColor: activeTab === 'pickup' ? '#d97706' : '#9333ea', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }} />
                ))}
                {/* Stop Stations (Blue) */}
                {form.stops.map((s, i) => {
                  const coord = sanitizeCoord(s);
                  return coord && (
                    <Marker key={`stop-${i}`} position={coord}
                            draggable={true}
                            onRightClick={() => {
                              removeStop(i);
                              toast(`Removed Stop ${i + 1}`);
                            }}
                            onDragEnd={(e) => {
                              if (!e.latLng) return;
                              setStop(i, 'latitude', e.latLng.lat().toFixed(6));
                              setStop(i, 'longitude', e.latLng.lng().toFixed(6));
                            }}
                            label={{ text: String(i + 1), color: '#fff', fontSize: '11px', fontWeight: '700' }}
                            title={`Stop ${i + 1}: ${s.name || 'Unnamed'} (Right-click to remove)`}
                            icon={{ path: window.google.maps.SymbolPath.CIRCLE, scale: 11,
                                    fillColor: '#1E73BE', fillOpacity: 1, strokeColor: '#fff', strokeWeight: 2 }} />
                  );
                })}
                <Marker position={MEU_CAMPUS_LATLNG} title={t('meu_campus')} />
              </GoogleMap>
            ) : (
              <EmptyState icon={MapPin} title={t('error_map')} body={t('error_map_hint')} />
            )}
          </div>
        </div>
      </div>

      {confirmLeave && (
        <ConfirmDialog title={t('unsaved_changes')} body={t('unsaved_changes_body')}
          confirmLabel={t('discard')} danger
          onConfirm={() => navigate('/network/routes')} onClose={() => setConfirmLeave(false)} />
      )}
    </>
  );
}
