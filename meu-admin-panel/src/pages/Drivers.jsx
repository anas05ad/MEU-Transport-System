import { useMemo, useState } from 'react';
import { addDoc, updateDoc, deleteDoc, doc, collection } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Users, SearchX, Plus, Trash2 } from 'lucide-react';

import PageHeader from '../components/PageHeader';
import { db } from '../firebase';
import { useData } from '../context/DataContext';
import {
  Button, IconButton, SearchInput, Badge, EmptyState, Modal, ConfirmDialog,
  Field, Input, Select, useToast, SortHeader, Pagination, SkeletonRows,
} from '../components/ui';

const PAGE_SIZE = 25;
const BLANK = { name: '', phone: '', businessDays: 'Sunday - Thursday', offDay: 'Friday', email: '' };

export default function Drivers() {
  const { t } = useTranslation();
  const toast = useToast();
  const { drivers, buses, loading } = useData();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [page, setPage] = useState(0);
  const [modal, setModal] = useState(null);
  const [form, setForm] = useState(BLANK);
  const [errors, setErrors] = useState({});
  const [saving, setSaving] = useState(false);
  const [confirmDel, setConfirmDel] = useState(null);

  // bus.driverId is the single source of truth for assignment.
  const busByDriver = useMemo(() => {
    const map = new Map();
    buses.forEach((b) => { if (b.driverId) map.set(b.driverId, b); });
    return map;
  }, [buses]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    let rows = drivers;
    if (q) rows = rows.filter((d) =>
      (d.name || '').toLowerCase().includes(q) ||
      String(busByDriver.get(d.id)?.busNumber ?? d.busNo ?? '').toLowerCase().includes(q));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...rows].sort((a, b) =>
      String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? ''), undefined, { numeric: true }) * dir);
  }, [drivers, search, sort, busByDriver]);

  const pageRows = filtered.slice(page * PAGE_SIZE, (page + 1) * PAGE_SIZE);
  const onSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const openCreate = () => { setForm(BLANK); setErrors({}); setModal({ mode: 'create' }); };
  const openEdit = (d) => {
    setForm({ name: d.name || '', phone: d.phone || '', businessDays: d.businessDays || '',
              offDay: d.offDay || '', email: d.email || '' });
    setErrors({});
    setModal({ mode: 'edit', driver: d });
  };

  const validate = () => {
    const e = {};
    if (!form.name.trim() || form.name.trim().length < 2) e.name = t('required_field');
    if (!/^(\+962|0)7\d{8}$/.test(form.phone.replace(/[\s-]/g, ''))) e.phone = t('required_field');
    setErrors(e);
    return Object.keys(e).length === 0;
  };

  const save = async (e) => {
    e.preventDefault();
    if (!validate()) return;
    setSaving(true);
    try {
      const payload = {
        name: form.name.trim(), phone: form.phone.trim(),
        businessDays: form.businessDays, offDay: form.offDay,
      };
      if (modal.mode === 'edit') {
        await updateDoc(doc(db, 'drivers', modal.driver.id), payload);
        toast(t('driver_updated_success'));
      } else {
        // NOTE: creating the Firebase Auth account here signed the admin out
        // (createUserWithEmailAndPassword swaps the current session).
        // Account provisioning moves to a Cloud Function — see BC-1 in the spec.
        await addDoc(collection(db, 'drivers'), {
          ...payload, email: form.email.trim() || null,
          role: 'driver', status: 'active', accountStatus: 'pending',
        });
        toast(t('driver_created_success'));
      }
      setModal(null);
    } catch (err) {
      console.error('[drivers] save', err);
      toast(t('save_failed'), 'error');
    } finally { setSaving(false); }
  };

  const remove = async () => {
    const assigned = busByDriver.get(confirmDel.id);
    if (assigned) {
      toast(t('driver_has_bus', { number: assigned.busNumber }), 'error');
      setConfirmDel(null);
      return;
    }
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'drivers', confirmDel.id));
      toast(t('driver_deleted_success'));
      setConfirmDel(null);
    } catch (err) {
      console.error('[drivers] delete', err);
      toast(t('error_deleting_driver'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title={t('drivers')} actions={
        <Button variant="primary" onClick={openCreate}>
          <Plus size={16} aria-hidden="true" />{t('add_new_driver')}
        </Button>
      } />

      <div className="page-content">
        <div className="toolbar">
          <div className="toolbar__search">
            <SearchInput value={search} onChange={(v) => { setSearch(v); setPage(0); }}
                         placeholder={t('search_placeholder')} />
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <SortHeader id="name" sort={sort} onSort={onSort}>{t('name')}</SortHeader>
                <th>{t('assigned_bus')}</th>
                <th>{t('phone')}</th>
                <th>{t('business_days')}</th>
                <SortHeader id="offDay" sort={sort} onSort={onSort}>{t('off_day')}</SortHeader>
                <th style={{ width: 96 }}>{t('actions')}</th>
              </tr>
            </thead>

            {loading.drivers ? <SkeletonRows rows={6} cols={6} /> : (
              <tbody>
                {pageRows.map((d) => {
                  const bus = busByDriver.get(d.id);
                  return (
                    <tr key={d.id}>
                      <td style={{ fontWeight: 600 }}>{d.name}</td>
                      <td className={bus ? 'tabular' : 'muted'}>{bus ? bus.busNumber : '—'}</td>
                      <td className="tabular">
                        {d.phone ? <a href={`tel:${d.phone}`} dir="ltr">{d.phone}</a> : <span className="muted">—</span>}
                      </td>
                      <td className="muted">{d.businessDays || '—'}</td>
                      <td>{d.offDay || '—'}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 4 }}>
                          <Button size="sm" variant="ghost" onClick={() => openEdit(d)}>{t('edit')}</Button>
                          <IconButton label={t('delete')} onClick={() => setConfirmDel(d)}>
                            <Trash2 size={15} />
                          </IconButton>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            )}
          </table>

          {!loading.drivers && filtered.length === 0 && (
            search
              ? <EmptyState icon={SearchX} title={t('no_results')} body={t('no_results_hint')} />
              : <EmptyState icon={Users} title={t('empty_drivers')} body={t('empty_drivers_hint')}
                  action={<Button variant="primary" onClick={openCreate}>{t('add_new_driver')}</Button>} />
          )}

          <Pagination page={page} pageSize={PAGE_SIZE} total={filtered.length} onPage={setPage} />
        </div>
      </div>

      {modal && (
        <Modal title={modal.mode === 'edit' ? t('edit_driver') : t('add_new_driver')} onClose={() => setModal(null)}
               footer={
                 <>
                   <Button variant="secondary" onClick={() => setModal(null)}>{t('cancel')}</Button>
                   <Button variant="primary" onClick={save} loading={saving}>
                     {modal.mode === 'edit' ? t('update') : t('create')}
                   </Button>
                 </>
               }>
          <form onSubmit={save} noValidate>
            <Field label={t('full_name')} required htmlFor="d-name" error={errors.name}>
              <Input id="d-name" value={form.name} invalid={!!errors.name}
                     onChange={(e) => setForm({ ...form, name: e.target.value })} />
            </Field>
            <Field label={t('phone_number')} required htmlFor="d-phone" error={errors.phone} hint="07XXXXXXXX">
              <Input id="d-phone" dir="ltr" value={form.phone} invalid={!!errors.phone}
                     onChange={(e) => setForm({ ...form, phone: e.target.value })} />
            </Field>
            <Field label={t('business_days')} htmlFor="d-days">
              <Select id="d-days" value={form.businessDays}
                      onChange={(e) => setForm({ ...form, businessDays: e.target.value })}>
                <option value="Sunday - Thursday">Sunday - Thursday</option>
                <option value="Saturday - Thursday">Saturday - Thursday</option>
              </Select>
            </Field>
            <Field label={t('off_day')} htmlFor="d-off">
              <Select id="d-off" value={form.offDay} onChange={(e) => setForm({ ...form, offDay: e.target.value })}>
                <option value="Friday">Friday</option>
                <option value="Saturday">Saturday</option>
                <option value="Sunday">Sunday</option>
              </Select>
            </Field>
            {modal.mode === 'edit' && (
              <Field label={t('assigned_bus')} hint={t('assign_from_bus')} htmlFor="d-bus">
                <Input id="d-bus" disabled value={busByDriver.get(modal.driver.id)?.busNumber ?? '—'} />
              </Field>
            )}
            {modal.mode === 'create' && (
              <Field label={t('email_optional')} htmlFor="d-email" hint={t('auth_credentials_hint')}>
                <Input id="d-email" type="email" dir="ltr" value={form.email}
                       onChange={(e) => setForm({ ...form, email: e.target.value })} />
              </Field>
            )}
          </form>
        </Modal>
      )}

      {confirmDel && (
        <ConfirmDialog danger loading={saving}
          title={t('confirm_delete_driver', { name: confirmDel.name })}
          body={t('confirm_delete_driver_body')}
          confirmLabel={t('delete')}
          onConfirm={remove} onClose={() => setConfirmDel(null)} />
      )}
    </>
  );
}
