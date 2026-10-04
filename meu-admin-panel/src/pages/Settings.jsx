import { useMemo, useState } from 'react';
import { collection, getDocs, query, where, writeBatch, deleteDoc, doc, addDoc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { AlertOctagon, FileText } from 'lucide-react';

import PageHeader from '../components/PageHeader';
import { db } from '../firebase';
import { useData } from '../context/DataContext';
import { MEU_ROUTES } from '../data/meuRoutes';
import { readTickMs } from '../context/DataContext';
import { Button, Card, Select, Field, EmptyState, ConfirmDialog, useToast, Badge } from '../components/ui';

export default function Settings() {
  const { t, i18n } = useTranslation();
  const toast = useToast();
  const { buses, drivers, routes, reports, logs, loading } = useData();

  const [refresh, setRefresh] = useState(() => String(readTickMs()));
  const [confirm, setConfirm] = useState(null);
  const [busy, setBusy] = useState(false);
  const [logType, setLogType] = useState('all');

  const resolvedCount = useMemo(() => reports.filter((r) => r.resolved).length, [reports]);
  const openCount = reports.length - resolvedCount;

  const visibleLogs = useMemo(
    () => (logType === 'all' ? logs : logs.filter((l) => l.type === logType)).slice(0, 100),
    [logs, logType]
  );

  const setLang = (lng) => i18n.changeLanguage(lng);

  const changeRefresh = (v) => {
    setRefresh(v);
    localStorage.setItem('meu.mapRefresh', v);
    window.dispatchEvent(new Event('meu:refresh-changed'));
    toast(t('saved'));
  };

  // Previously this deleted EVERY report while the dialog claimed it only
  // removed resolved ones.
  const clearResolved = async () => {
    setBusy(true);
    try {
      const snap = await getDocs(query(collection(db, 'reports'), where('resolved', '==', true)));
      if (!snap.empty) {
        const batch = writeBatch(db);
        snap.docs.forEach((d) => batch.delete(d.ref));
        await batch.commit();
      }
      toast(t('reports_cleared_success'));
      setConfirm(null);
    } catch (err) { console.error(err); toast(t('error_generic'), 'error'); }
    finally { setBusy(false); }
  };

  const reseedRoutes = async () => {
    setBusy(true);
    try {
      const col = collection(db, 'routes');
      const snap = await getDocs(col);
      await Promise.all(snap.docs.map((d) => deleteDoc(doc(db, 'routes', d.id))));
      for (const r of MEU_ROUTES) await addDoc(col, r);
      toast(t('saved'));
      setConfirm(null);
    } catch (err) { console.error(err); toast(t('error_generic'), 'error'); }
    finally { setBusy(false); }
  };

  return (
    <>
      <PageHeader title={t('system_settings')} />
      <div className="page-content" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit,minmax(380px,1fr))', gap: 'var(--space-5)', alignItems: 'start' }}>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-5)' }}>
          <Card title={t('preferences')}>
            <Field label={t('language_options')}>
              <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                <Button variant={i18n.language.startsWith('ar') ? 'secondary' : 'primary'}
                        onClick={() => setLang('en')} block>English</Button>
                <Button variant={i18n.language.startsWith('ar') ? 'primary' : 'secondary'}
                        onClick={() => setLang('ar')} block>العربية</Button>
              </div>
            </Field>

            {/* This select previously had no value and no onChange — it did nothing. */}
            <Field label={t('tracking_interval')} htmlFor="s-refresh">
              <Select id="s-refresh" value={refresh} onChange={(e) => changeRefresh(e.target.value)}>
                <option value="2000">{t('freq_high')}</option>
                <option value="5000">{t('freq_std')}</option>
                <option value="10000">{t('freq_battery')}</option>
              </Select>
            </Field>
          </Card>

          <Card title={t('system_information')}>
            <InfoRow label={t('project_id')} value={import.meta.env.VITE_FIREBASE_PROJECT_ID || '—'} />
            <InfoRow label={t('buses')} value={buses.length} />
            <InfoRow label={t('drivers')} value={drivers.length} />
            <InfoRow label={t('routes')} value={routes.length} />
            <InfoRow label={t('open_incidents')} value={openCount} />
          </Card>

          {/* ---- DANGER ZONE ---- */}
          <section className="card" style={{ borderColor: 'var(--color-status-critical)',
                                             background: 'var(--color-status-critical-bg)' }}>
            <header className="card__head" style={{ borderColor: 'rgba(217,45,32,.25)' }}>
              <h2 className="card__title" style={{ display: 'flex', alignItems: 'center', gap: 8,
                                                   color: 'var(--color-status-critical)' }}>
                <AlertOctagon size={17} aria-hidden="true" />{t('danger_zone')}
              </h2>
            </header>
            <div className="card__body" style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
              <div>
                <div className="field__label">{t('clear_reports')}</div>
                <p className="field__hint" style={{ margin: '4px 0 8px' }}>
                  {resolvedCount} {t('resolved')}
                </p>
                <Button variant="danger" size="sm" disabled={resolvedCount === 0}
                        onClick={() => setConfirm('clear')}>{t('clear_reports')}</Button>
              </div>
              <div>
                <div className="field__label">{t('route_sync')}</div>
                <p className="field__hint" style={{ margin: '4px 0 8px' }}>{t('reseed_warning')}</p>
                <Button variant="danger" size="sm" onClick={() => setConfirm('reseed')}>
                  {t('reseed_routes')}
                </Button>
              </div>
            </div>
          </section>
        </div>

        <Card title={t('activity_logs')} actions={
          <Select value={logType} onChange={(e) => setLogType(e.target.value)} style={{ width: 140, height: 34 }}>
            <option value="all">{t('filter')}</option>
            <option value="error">error</option>
            <option value="info">info</option>
          </Select>
        }>
          {!loading.logs && visibleLogs.length === 0 ? (
            <EmptyState icon={FileText} title={t('no_logs')} />
          ) : (
            <div style={{ maxHeight: 460, overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 'var(--space-3)' }}>
              {visibleLogs.map((l) => (
                <div key={l.id} style={{ paddingBottom: 'var(--space-3)', borderBottom: '1px solid var(--color-border)' }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-2)', marginBottom: 4 }}>
                    <Badge tone={l.type === 'error' ? 'critical' : 'info'}>{(l.type || 'info').toUpperCase()}</Badge>
                    <span className="tabular" style={{ fontSize: 'var(--text-xs)', color: 'var(--color-text-muted)' }}>
                      {l.timestamp?.toDate ? l.timestamp.toDate().toLocaleString() : '—'}
                    </span>
                  </div>
                  <div style={{ fontSize: 'var(--text-sm)' }}>{l.message}</div>
                </div>
              ))}
            </div>
          )}
        </Card>
      </div>

      {confirm === 'clear' && (
        <ConfirmDialog danger loading={busy}
          title={t('clear_reports')}
          body={t('confirm_clear_reports', { count: resolvedCount })}
          confirmLabel={t('delete')} requireWord="DELETE"
          onConfirm={clearResolved} onClose={() => setConfirm(null)} />
      )}
      {confirm === 'reseed' && (
        <ConfirmDialog danger loading={busy}
          title={t('reseed_routes')} body={t('reseed_warning')}
          confirmLabel={t('reseed_routes')} requireWord="RESET"
          onConfirm={reseedRoutes} onClose={() => setConfirm(null)} />
      )}
    </>
  );
}

function InfoRow({ label, value }) {
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', padding: '8px 0',
                  borderBottom: '1px solid var(--color-border)', fontSize: 'var(--text-sm)' }}>
      <span style={{ color: 'var(--color-text-muted)' }}>{label}</span>
      <span className="tabular" style={{ fontWeight: 600 }}>{value}</span>
    </div>
  );
}
