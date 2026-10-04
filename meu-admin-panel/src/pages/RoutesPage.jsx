import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { deleteDoc, doc } from 'firebase/firestore';
import { useTranslation } from 'react-i18next';
import { Route as RouteIcon, Plus, Trash2, AlertTriangle, SearchX } from 'lucide-react';

import PageHeader from '../components/PageHeader';
import { db } from '../firebase';
import { useData } from '../context/DataContext';
import { deriveBusStatus } from '../utils/busStatus';
import {
  Button, IconButton, SearchInput, Badge, EmptyState, ConfirmDialog,
  useToast, SortHeader, SkeletonRows,
} from '../components/ui';

export default function RoutesPage() {
  const { t } = useTranslation();
  const toast = useToast();
  const navigate = useNavigate();
  const { routes, buses, loading, now } = useData();

  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });
  const [confirmDel, setConfirmDel] = useState(null);
  const [saving, setSaving] = useState(false);

  const busesByRoute = useMemo(() => {
    const map = new Map();
    buses.forEach((b) => {
      if (!b.route) return;
      const list = map.get(b.route) || [];
      list.push({ ...b, state: deriveBusStatus(b, now) });
      map.set(b.route, list);
    });
    return map;
  }, [buses, now]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = routes.map((r) => {
      const assigned = busesByRoute.get(r.name) || [];
      return {
        ...r,
        stopCount: (r.stops || []).length,
        pickups: (r.pickupTimes || []).length,
        returns: (r.returnTimes || []).length,
        assigned: assigned.length,
        live: assigned.filter((b) => b.state === 'on_route').length,
      };
    });
    if (q) list = list.filter((r) => (r.name || '').toLowerCase().includes(q));
    const dir = sort.dir === 'asc' ? 1 : -1;
    return list.sort((a, b) => {
      if (typeof a[sort.key] === 'number') return ((a[sort.key] - b[sort.key])) * dir;
      return String(a[sort.key] ?? '').localeCompare(String(b[sort.key] ?? '')) * dir;
    });
  }, [routes, busesByRoute, search, sort]);

  const onSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  const remove = async () => {
    setSaving(true);
    try {
      await deleteDoc(doc(db, 'routes', confirmDel.id));
      toast(t('saved'));
      setConfirmDel(null);
    } catch (err) {
      console.error('[routes] delete', err);
      toast(t('error_generic'), 'error');
    } finally { setSaving(false); }
  };

  return (
    <>
      <PageHeader title={t('routes')} actions={
        <Button variant="primary" onClick={() => navigate('/network/routes/new')}>
          <Plus size={16} aria-hidden="true" />{t('new_route')}
        </Button>
      } />

      <div className="page-content">
        <div className="toolbar">
          <div className="toolbar__search">
            <SearchInput value={search} onChange={setSearch} placeholder={t('route_name')} />
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <SortHeader id="name" sort={sort} onSort={onSort}>{t('route_name')}</SortHeader>
                <SortHeader id="stopCount" sort={sort} onSort={onSort} align="end">{t('stops_count')}</SortHeader>
                <SortHeader id="pickups" sort={sort} onSort={onSort} align="end">{t('pickup_times')}</SortHeader>
                <SortHeader id="returns" sort={sort} onSort={onSort} align="end">{t('return_times')}</SortHeader>
                <SortHeader id="assigned" sort={sort} onSort={onSort}>{t('route_coverage')}</SortHeader>
                <th style={{ width: 96 }}>{t('actions')}</th>
              </tr>
            </thead>

            {loading.routes ? <SkeletonRows rows={6} cols={6} /> : (
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} data-clickable="true" onClick={() => navigate(`/network/routes/${r.id}`)}>
                    <td style={{ fontWeight: 600, maxWidth: 320 }}>{r.name}</td>
                    <td className="num tabular">{r.stopCount}</td>
                    <td className="num tabular">{r.pickups}</td>
                    <td className="num tabular">{r.returns}</td>
                    <td>
                      {/* A route with a timetable and no bus is a service failure
                          that was previously invisible everywhere in the product. */}
                      {r.assigned === 0
                        ? <Badge tone="warn" icon={AlertTriangle}>{t('no_bus_assigned')}</Badge>
                        : <Badge tone="ok">{r.assigned} {t('assigned_buses')}</Badge>}
                    </td>
                    <td onClick={(e) => e.stopPropagation()}>
                      <div style={{ display: 'flex', gap: 4 }}>
                        <Button size="sm" variant="ghost" onClick={() => navigate(`/network/routes/${r.id}`)}>
                          {t('edit')}
                        </Button>
                        <IconButton label={t('delete')} onClick={() => setConfirmDel(r)}>
                          <Trash2 size={15} />
                        </IconButton>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>

          {!loading.routes && rows.length === 0 && (
            search
              ? <EmptyState icon={SearchX} title={t('no_results')} body={t('no_results_hint')} />
              : <EmptyState icon={RouteIcon} title={t('empty_routes')} body={t('empty_routes_hint')}
                  action={<Button variant="primary" onClick={() => navigate('/network/routes/new')}>{t('new_route')}</Button>} />
          )}
        </div>
      </div>

      {confirmDel && (
        <ConfirmDialog danger loading={saving}
          title={t('confirm_delete_route', { name: confirmDel.name })}
          body={t('confirm_delete_route_body')}
          confirmLabel={t('delete')}
          onConfirm={remove} onClose={() => setConfirmDel(null)} />
      )}
    </>
  );
}
