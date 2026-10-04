import { useMemo, useState } from 'react';
import { updateDoc, doc, serverTimestamp, deleteField } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { ShieldCheck, AlertOctagon } from 'lucide-react';

import PageHeader from '../components/PageHeader';
import { db, auth } from '../firebase';
import { useData } from '../context/DataContext';
import {
  Button, StatusBadge, EmptyState, useToast, SkeletonRows, Modal, Field, Input,
} from '../components/ui';

const FILTERS = ['open_status', 'acknowledged', 'resolved'];

const statusOf = (r) => (r.resolved ? 'resolved' : r.acknowledgedAt ? 'acknowledged' : 'open_status');

const fmt = (ts) => {
  if (!ts) return '—';
  const d = typeof ts.toDate === 'function' ? ts.toDate() : new Date(ts);
  return Number.isNaN(d.getTime()) ? '—' : d.toLocaleString();
};

export default function Incidents() {
  const { t } = useTranslation();
  const toast = useToast();
  const { reports, loading } = useData();

  const [active, setActive] = useState(['open_status', 'acknowledged']);
  const [resolving, setResolving] = useState(null);
  const [note, setNote] = useState('');
  const [busy, setBusy] = useState(false);

  const rows = useMemo(
    () => reports.filter((r) => active.includes(statusOf(r))),
    [reports, active]
  );

  const toggle = (f) => setActive((a) => (a.includes(f) ? a.filter((x) => x !== f) : [...a, f]));

  const acknowledge = async (r) => {
    try {
      await updateDoc(doc(db, 'reports', r.id), {
        acknowledgedAt: serverTimestamp(),
        acknowledgedBy: auth.currentUser?.uid ?? null,
      });
      toast(t('incident_acknowledged'));
    } catch (err) { console.error(err); toast(t('error_generic'), 'error'); }
  };

  // Previously this called deleteDoc — the incident was destroyed, so the
  // system could never answer "which bus keeps breaking down?".
  const resolve = async () => {
    setBusy(true);
    try {
      await updateDoc(doc(db, 'reports', resolving.id), {
        resolved: true,
        resolvedAt: serverTimestamp(),
        resolvedBy: auth.currentUser?.uid ?? null,
        resolutionNote: note.trim() || null,
      });
      toast(t('incident_resolved'));
      setResolving(null); setNote('');
    } catch (err) { console.error(err); toast(t('error_generic'), 'error'); }
    finally { setBusy(false); }
  };

  const reopen = async (r) => {
    try {
      await updateDoc(doc(db, 'reports', r.id), {
        resolved: false, resolvedAt: deleteField(),
        resolvedBy: deleteField(), resolutionNote: deleteField(),
      });
      toast(t('incident_reopened'));
    } catch (err) { console.error(err); toast(t('error_generic'), 'error'); }
  };

  return (
    <>
      <PageHeader title={t('incidents')} />
      <div className="page-content">
        <div className="chips">
          {FILTERS.map((f) => (
            <button key={f} type="button" className="chip" aria-pressed={active.includes(f)}
                    onClick={() => toggle(f)}>{t(f)}</button>
          ))}
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <th>{t('status')}</th>
                <th>{t('bus')}</th>
                <th>{t('driver')}</th>
                <th>{t('issue')}</th>
                <th>{t('reported_at')}</th>
                <th style={{ width: 190 }}>{t('actions')}</th>
              </tr>
            </thead>
            {loading.reports ? <SkeletonRows rows={5} cols={6} /> : (
              <tbody>
                {rows.map((r) => {
                  const s = statusOf(r);
                  return (
                    <tr key={r.id}>
                      <td><StatusBadge status={s} /></td>
                      <td className="tabular" style={{ fontWeight: 600 }}>{r.busNo ?? '—'}</td>
                      <td>{r.driverName || <span className="muted">—</span>}</td>
                      <td style={{ maxWidth: 340 }}>{r.issue || '—'}</td>
                      <td className="muted tabular">{fmt(r.timestamp)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          {s === 'open_status' && (
                            <Button size="sm" variant="secondary" onClick={() => acknowledge(r)}>{t('acknowledge')}</Button>
                          )}
                          {s !== 'resolved' && (
                            <Button size="sm" variant="primary" onClick={() => setResolving(r)}>{t('resolve')}</Button>
                          )}
                          {s === 'resolved' && (
                            <Button size="sm" variant="ghost" onClick={() => reopen(r)}>{t('reopen')}</Button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>

          {!loading.reports && rows.length === 0 && (
            <EmptyState icon={ShieldCheck} tone="ok" title={t('empty_incidents')} body={t('empty_incidents_hint')} />
          )}
        </div>
      </div>

      {resolving && (
        <Modal size="sm" title={t('resolve')} onClose={() => { setResolving(null); setNote(''); }}
               footer={
                 <>
                   <Button variant="secondary" onClick={() => { setResolving(null); setNote(''); }}>{t('cancel')}</Button>
                   <Button variant="primary" loading={busy} onClick={resolve}>{t('resolve')}</Button>
                 </>
               }>
          <p style={{ marginTop: 0, fontSize: 'var(--text-sm)', color: 'var(--color-text-secondary)' }}>
            <AlertOctagon size={14} style={{ verticalAlign: -2, marginInlineEnd: 6 }} aria-hidden="true" />
            {t('bus')} {resolving.busNo} — {resolving.issue}
          </p>
          <Field label={t('resolution_note')} htmlFor="res-note">
            <Input id="res-note" value={note} onChange={(e) => setNote(e.target.value)} />
          </Field>
        </Modal>
      )}
    </>
  );
}
