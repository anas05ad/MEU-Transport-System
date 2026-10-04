import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { MapPin, SearchX } from 'lucide-react';

import PageHeader from '../components/PageHeader';
import { useData } from '../context/DataContext';
import { sanitizeCoord } from '../utils/busStatus';
import { Button, SearchInput, EmptyState, SkeletonRows, SortHeader } from '../components/ui';

// Stops are embedded inside route documents, not a separate collection.
// This is a read-oriented index across all routes; editing happens in the
// route editor so coordinates can't drift between routes.
export default function Stops() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { routes, loading } = useData();
  const [search, setSearch] = useState('');
  const [sort, setSort] = useState({ key: 'name', dir: 'asc' });

  const stops = useMemo(() => {
    const byName = new Map();
    routes.forEach((r) => {
      (r.stops || []).forEach((s) => {
        const key = (s.name || '').trim();
        if (!key) return;
        const entry = byName.get(key) || { name: key, coord: sanitizeCoord(s), routes: [] };
        entry.routes.push({ id: r.id, name: r.name });
        byName.set(key, entry);
      });
    });
    return [...byName.values()];
  }, [routes]);

  const rows = useMemo(() => {
    const q = search.trim().toLowerCase();
    let list = q ? stops.filter((s) => s.name.toLowerCase().includes(q)) : stops;
    const dir = sort.dir === 'asc' ? 1 : -1;
    return [...list].sort((a, b) => {
      if (sort.key === 'count') return (a.routes.length - b.routes.length) * dir;
      return a.name.localeCompare(b.name) * dir;
    });
  }, [stops, search, sort]);

  const onSort = (key) => setSort((s) => ({ key, dir: s.key === key && s.dir === 'asc' ? 'desc' : 'asc' }));

  return (
    <>
      <PageHeader title={t('stops')} />
      <div className="page-content">
        <div className="toolbar">
          <div className="toolbar__search">
            <SearchInput value={search} onChange={setSearch} placeholder={t('stop_name')} />
          </div>
        </div>

        <div className="tbl-wrap">
          <table className="tbl">
            <thead>
              <tr>
                <SortHeader id="name" sort={sort} onSort={onSort}>{t('stop_name')}</SortHeader>
                <SortHeader id="count" sort={sort} onSort={onSort} align="end">{t('serving_routes')}</SortHeader>
                <th>{t('routes')}</th>
                <th>{t('coordinates')}</th>
              </tr>
            </thead>
            {loading.routes ? <SkeletonRows rows={6} cols={4} /> : (
              <tbody>
                {rows.map((s) => (
                  <tr key={s.name}>
                    <td style={{ fontWeight: 600 }}>{s.name}</td>
                    <td className="num tabular">{s.routes.length}</td>
                    <td>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
                        {s.routes.slice(0, 3).map((r) => (
                          <Button key={r.id} size="sm" variant="ghost"
                                  onClick={() => navigate(`/network/routes/${r.id}`)}>{r.name}</Button>
                        ))}
                        {s.routes.length > 3 && <span className="muted">+{s.routes.length - 3}</span>}
                      </div>
                    </td>
                    <td className="muted tabular" dir="ltr">
                      {s.coord ? `${s.coord.lat.toFixed(4)}, ${s.coord.lng.toFixed(4)}` : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            )}
          </table>

          {!loading.routes && rows.length === 0 && (
            search
              ? <EmptyState icon={SearchX} title={t('no_results')} body={t('no_results_hint')} />
              : <EmptyState icon={MapPin} title={t('empty_stops')} body={t('empty_stops_hint')} />
          )}
        </div>
      </div>
    </>
  );
}
