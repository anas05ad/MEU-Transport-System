import { useMemo } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTranslation } from 'react-i18next';
import { CalendarClock } from 'lucide-react';

import PageHeader from '../components/PageHeader';
import { useData } from '../context/DataContext';
import { EmptyState, SkeletonRows, Badge } from '../components/ui';

// 06:00 → 19:00 in 30-minute slots.
const SLOTS = Array.from({ length: 27 }, (_, i) => {
  const mins = 6 * 60 + i * 30;
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
});

const snap = (time) => {
  if (!time) return null;
  const [h, m] = time.split(':').map(Number);
  if (Number.isNaN(h)) return null;
  const mins = h * 60 + (m >= 30 ? 30 : 0);
  return `${String(Math.floor(mins / 60)).padStart(2, '0')}:${String(mins % 60).padStart(2, '0')}`;
};

export default function Timetables() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const { routes, buses, loading } = useData();

  const grid = useMemo(() => routes.map((r) => {
    const cells = {};
    (r.pickupTimes || []).forEach((x) => { const s = snap(x); if (s) cells[s] = 'pickup'; });
    (r.returnTimes || []).forEach((x) => { const s = snap(x); if (s) cells[s] = cells[s] ? 'both' : 'return'; });
    return { id: r.id, name: r.name, cells };
  }), [routes]);

  // The real scheduling question is "how many buses do I need at 06:30?"
  const totals = useMemo(() => SLOTS.map((s) => grid.filter((r) => r.cells[s]).length), [grid]);
  const inService = buses.filter((b) => b.serviceState !== 'out_of_service').length;

  const COLOR = { pickup: 'var(--color-status-info)', return: 'var(--color-accent-soft)', both: 'var(--color-primary-300)' };

  return (
    <>
      <PageHeader title={t('timetables')} />
      <div className="page-content">
        {!loading.routes && routes.length === 0 ? (
          <EmptyState icon={CalendarClock} title={t('empty_routes')} body={t('empty_routes_hint')} />
        ) : (
          <div className="tbl-wrap">
            <table className="tbl">
              <thead>
                <tr>
                  <th style={{ position: 'sticky', insetInlineStart: 0, zIndex: 2,
                               background: 'var(--color-surface-alt)', minWidth: 220 }}>{t('route')}</th>
                  {SLOTS.map((s) => (
                    <th key={s} className="tabular" style={{ textAlign: 'center', minWidth: 46, padding: '8px 2px' }}>{s}</th>
                  ))}
                </tr>
              </thead>
              {loading.routes ? <SkeletonRows rows={6} cols={8} /> : (
                <tbody>
                  {grid.map((r) => (
                    <tr key={r.id} data-clickable="true" onClick={() => navigate(`/network/routes/${r.id}`)}>
                      <td style={{ position: 'sticky', insetInlineStart: 0, background: 'var(--color-surface)',
                                   fontWeight: 600, maxWidth: 260 }}>{r.name}</td>
                      {SLOTS.map((s) => (
                        <td key={s} style={{ padding: 3, textAlign: 'center' }}>
                          {r.cells[s] && (
                            <span title={t(r.cells[s] === 'return' ? 'return' : 'pickup')}
                                  style={{ display: 'block', height: 18, borderRadius: 4,
                                           background: COLOR[r.cells[s]] }} />
                          )}
                        </td>
                      ))}
                    </tr>
                  ))}
                  <tr style={{ background: 'var(--color-surface-alt)' }}>
                    <td style={{ position: 'sticky', insetInlineStart: 0, background: 'var(--color-surface-alt)',
                                 fontWeight: 700 }}>{t('total_departures')}</td>
                    {totals.map((n, i) => (
                      <td key={i} className="tabular" style={{ textAlign: 'center', fontWeight: 700,
                            color: n > inService && inService > 0 ? 'var(--color-status-critical)' : 'var(--color-text-secondary)' }}>
                        {n || ''}
                      </td>
                    ))}
                  </tr>
                </tbody>
              )}
            </table>
          </div>
        )}

        <div style={{ display: 'flex', gap: 'var(--space-4)', fontSize: 'var(--text-sm)' }}>
          <Badge tone="info">{t('pickup')}</Badge>
          <Badge tone="neutral">{t('return')}</Badge>
          <span className="muted" style={{ color: 'var(--color-text-muted)' }}>
            {inService} {t('buses')}
          </span>
        </div>
      </div>
    </>
  );
}
