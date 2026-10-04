import { useMemo, useState } from 'react';
import { addDoc, updateDoc, deleteDoc, doc, collection } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Bus as BusIcon, SearchX, Plus, MoreHorizontal, Wrench } from 'lucide-react';

import PageHeader from '../components/PageHeader';
import { db } from '../firebase';
import { useData } from '../context/DataContext';
import { deriveBusStatus, relativeTime, loadLevel } from '../utils/busStatus';
import {
  Button, IconButton, SearchInput, StatusBadge, EmptyState, Modal, ConfirmDialog,
  Field, Input, Select, useToast, SortHeader, Pagination, SkeletonRows, ProgressBar,
} from '../components/ui';

const PAGE_SIZE = 25;
const STATES = ['on_route', 'idle', 'no_signal', 'offline', 'out_of_service'];

// The driver app owns status / location / passengerCount / lastUpdated.
// Writing anything else back from this form corrupted the documents.
const EDITABLE = ['busNumber', 'driverId', 'driverName', 'route', 'capacity'];
const BLANK = { busNumber: '', driverId: '', driverName: '', route: '', capacity: '' };

export default function Buses() {
  const { t } = useTranslation();
  const toast = useToast();
  const { buses, drivers, routes, loading, now } = useData();

  const [search, setSearch] = useState('');
  const [stateFilter, setStateFilter] = useState(null);
  const [sort, setSort] = useState({ key: 'busNumber', dir: 'asc' });
  const [page, setPage] = useState(0);

  const [modal, setModal] = useState(null);   // { mode, bus }
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  const enriched = useMemo(
    () => buses.map((b) => ({ ...b, state: deriveBusStatus(b, now) })),
    [buses, now]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = enriched;
    if (stateFilter) rows = rows.filter((b) => b.state === stateFilter);
    if (q) rows = rows.filter((b) =>
      String(b.busNumber ?? '').toLowerCase().includes(q) ||
      (b.route || '').toLowerCase().includes(q) ||
      (b.driverName || '').toLowerCase().includes(q));

    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) => {
      const av = a[sort.key], bv = b[sort.key];
      if (sort.key === 'busNumber' || sort.key === 'capacity') {
        return ((Number(av) || 0) - (Number(bv) || 0)) * dir;
      }
      if (sort.key === 'lastUpdateTime') return ((av || 0) - (bv || 0)) * dir;
      return String(av ?? '').localeCompare(String(bv ?? ''), undefined, { numeric: true }) * dir;
    });
  }, [enriched, search, stateFilter, sort]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const onSort = (key) => {
    setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));
    setPage(0);
  };

  const openCreate = () => { setForm(BLANK); setErrors({}); setModal({ mode: 'create' }); };
  const openEdit = (bus) => {
    // Only editable fields — never the derived state or driver-app fields.
    setForm(Object.fromEntries(EDITABLE.map((k) => [k, bus[k] ?? ''])));
    setErrors({});
    setModal({ mode: 'edit', bus });
  };

  const validate = () => {
    const e = {};
    if (!String(form.busNumber).trim()) e.busNumber = t('required_field');
    const cap = Number(form.capacity);
    if (!form.capacity || Number.isNaN(cap) || cap < 1 || cap > 100) e.capacity = t('required_field');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = Object.fromEntries(EDITABLE.map((k) => [k, form[k] ?? '']));
      payload.capacity = Number(payload.capacity);
      if (modal.mode === 'edit') {
        await updateDoc(doc(db, 'buses', modal.bus.id), payload);
        toast(t('bus_updated'));
      } else {
        await addDoc(collection(db, 'buses'), { ...payload, status: 'Active', passengerCount: 0 });
        toast(t('new_bus_added'));
      }
      setModal(null);
    } catch (err) {
      console.error('[buses] save', err);
      toast(t('save_failed'), 'error');   // modal stays open, data intact
    } finally { setSaving(false); }
  };

  const remove = async () => {
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'buses', confirmDel.id));
      toast(t('bus_updated'));
      setConfirmDel(null);
    } catch (err) {
      console.error('[buses] delete', err);
      toast(t('error_generic'), 'error');
    } finally { setSaving(false); }
  };

  const toggleService = async (bus) => {
    const next = bus.serviceState === 'out_of_service' ? null : 'out_of_service';
    try { await updateDoc(doc(db, 'buses', bus.id), { serviceState: next }); }
    catch (err) { console.error(err); toast(t('error_generic'), 'error'); }
  };

  return (
    <>
      <PageHeader title={t('buses')} actions={
        <Button variant="primary" onClick={openCreate}>
          <Plus size={16} aria-hidden="true" />{t('add_new_bus')}
        </Button>
      } />

      <div className="page-content">
        <div className="toolbar">
          <div className="toolbar__search">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }}
                         placeholder={t('search_bus_placeholder')} />
          </div>
          <div className="chips">
            {STATES.map((s) => (
              <button key={s} type="button" className="chip" aria-pressed={stateFilter === s}
                      onClick={() => { setStateFilter(stateFilter === s ? null : s); setPage(0); }}>
                {t(s)}
              </button>
            ))}
            {(stateFilter || search) && (
              <Button size="sm" variant="ghost"
                      onClick={() => { setStateFilter(null); setSearch(''); setPage(0); }}>
                {t('clear_filters')}
              </Button>
            )}
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <SortHeader id="busNumber" sort={sort} onSort={onSort}>{t('bus_no')}</SortHeader>
                <SortHeader id="state" sort={sort} onSort={onSort}>{t('status')}</SortHeader>
                <SortHeader id="driverName" sort={sort} onSort={onSort}>{t('driver')}</SortHeader>
                <SortHeader id="route" sort={sort} onSort={onSort}>{t('route')}</SortHeader>
                <th>{t('load')}</th>
                <SortHeader id="lastUpdateTime" sort={sort} onSort={onSort}>{t('last_seen')}</SortHeader>
                <th style={{ width: 96 }}>{t('actions')}</th>
              </tr>
            </thead>

            {loading.buses ? <SkeletonRows rows={6} cols={7} /> : (
              <tbody>
                {pageRows.map((b) => (
                  <tr key={b.id}>
                    <td className="tabular" style={{ fontWeight: 600 }}>{b.busNumber}</td>
                    <td><StatusBadge status={b.state} /></td>
                    <td className={b.driverName ? '' : 'muted'}>{b.driverName || '—'}</td>
                    <td className={b.route ? '' : 'muted'}>{b.route || '—'}</td>
                    <td style={{ minWidth: 130 }}>
                      <div className="tabular" style={{ fontSize: 'var(--text-xs)', marginBottom: 4 }}>
                        {b.passengerCount ?? 0} / {b.capacity ?? '—'}
                      </div>
                      <ProgressBar value={b.passengerCount ?? 0} max={Number(b.capacity) || 0}
                                   level={loadLevel(b.passengerCount, b.capacity)} label={t('load')} />
                    </td>
                    <td className="muted tabular">{relativeTime(b.lastUpdateTime, t)}</td>
                    <td>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button size="sm" variant="ghost" onClick={() => openEdit(b)}>{t('edit')}</Button>
                        <IconButton label={t('take_out_of_service')} onClick={() => toggleService(b)}>
                          <Wrench size={15} />
                        </IconButton>
                        <IconButton label={t('delete')} onClick={() => setConfirmDel(b)}>
                          <MoreHorizontal size={15} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>

          {!loading.buses && filtered.length === 0 && (
            search || stateFilter
              ? <EmptyState icon={SearchX} title={t('no_results')} body={t('no_results_hint')}
                  action={<Button variant="secondary" onClick={() => { setSearch(''); setStateFilter(null); }}>{t('clear_filters')}</Button>} />
              : <EmptyState icon={BusIcon} title={t('empty_buses')} body={t('empty_buses_hint')}
                  action={<Button variant="primary" onClick={openCreate}>{t('add_new_bus')}</Button>} />
          )}

          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </div>
      </div>

      {modal && (
        <Modal title={modal.mode === 'edit' ? t('edit_bus') : t('add_new_bus')} onClose={() => setModal(null)}
               footer={
                 <>
                   <Button variant="secondary" onClick={() => setModal(null)}>{t('cancel')}</Button>
                   <Button variant="primary" onClick={save} loading={saving}>
                     {modal.mode === 'edit' ? t('save_changes') : t('create_bus')}
                   </Button>
                 </>
               }>
          <form onSubmit={save} noValidate>
            <Field label={t('bus_number')} required htmlFor="f-num" error={errors.busNumber}>
              <Input id="f-num" value={form.busNumber} invalid={!!errors.busNumber}
                     onChange={(e) => setForm({ ...form, busNumber: e.target.value })} />
            </Field>
            <Field label={t('capacity')} required htmlFor="f-cap" error={errors.capacity}>
              <Input id="f-cap" type="number" min="1" max="100" value={form.capacity} invalid={!!errors.capacity}
                     onChange={(e) => setForm({ ...form, capacity: e.target.value })} />
            </Field>
            <Field label={t('assign_driver')} htmlFor="f-drv" hint={form.driverId ? undefined : t('unassigned')}>
              <Select id="f-drv" value={form.driverId} onChange={(e) => {
                const d = drivers.find((x) => x.id === e.target.value);
                setForm({ ...form, driverId: e.target.value, driverName: d ? d.name : '' });
              }}>
                <option value="">{t('select_driver')}</option>
                {drivers.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </Select>
            </Field>
            <Field label={t('assign_route')} htmlFor="f-rt">
              <Select id="f-rt" value={form.route} onChange={(e) => setForm({ ...form, route: e.target.value })}>
                <option value="">{t('select_route')}</option>
                {routes.map((r) => <option key={r.id} value={r.name}>{r.name}</option>)}
              </Select>
            </Field>
          </form>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDialog danger loading={saving}
          title={t('confirm_delete_bus', { number: confirmDel.busNumber })}
          body={t('confirm_delete_bus_body')}
          confirmLabel={t('delete')}
          onConfirm={remove} onClose={() => setConfirmDel(null)} />
      )}
    </>
  );
}
