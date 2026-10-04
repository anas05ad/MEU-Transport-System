import React, { useEffect, useMemo } from 'react';
import {
  BrowserRouter as Router, Routes, Route, NavLink, Navigate,
  useLocation, useNavigate,
} from 'react-router-dom';
import { signOut } from 'firebase/auth';
import { useJsApiLoader } from '@react-google-maps/api';
import { useTranslation } from 'react-i18next';
import {
  Radio, Bus, Users, Route as RouteIcon, MapPin, CalendarClock,
  AlertOctagon, Settings as SettingsIcon, LogOut,
} from 'lucide-react';

import './i18n';
import { auth } from './firebase';
import { AuthProvider, useAuth } from './context/AuthContext';
import { DataProvider, useData } from './context/DataContext';
import { ToastProvider, Button, EmptyState } from './components/ui';
import ErrorBoundary from './components/ErrorBoundary';
import PageHeader from './components/PageHeader';

import Login from './pages/Login';
import Operations from './pages/Operations';
import Buses from './pages/Buses';
import Drivers from './pages/Drivers';
import RoutesPage from './pages/RoutesPage';
import RouteEditor from './pages/RouteEditor';
import Stops from './pages/Stops';
import Timetables from './pages/Timetables';
import Incidents from './pages/Incidents';
import Settings from './pages/Settings';
import meuLogo from './assets/meu-logo.png';

import './App.css';

const MAPS_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
const MAPS_LIBRARIES = ['places']; // module constant — an inline array remounts the script every render

/* ---------- Auth gate ---------- */
function RequireAuth({ children }) {
  const { user, loading } = useAuth();
  const location = useLocation();
  if (loading) return <Boot />;
  if (!user) return <Navigate to="/" replace state={{ from: location }} />;
  return children;
}

function Boot() {
  return (
    <div className="boot">
      <img src={meuLogo} alt="MEU Loading" className="boot__logo" style={{ height: '90px', objectFit: 'contain' }} />
    </div>
  );
}

/* ---------- Sidebar ---------- */
const NAV = [
  { group: null, items: [{ to: '/operations', key: 'operations', Icon: Radio }] },
  { group: 'fleet', items: [
    { to: '/fleet/buses', key: 'buses', Icon: Bus },
    { to: '/fleet/drivers', key: 'drivers', Icon: Users },
  ]},
  { group: 'network', items: [
    { to: '/network/routes', key: 'routes', Icon: RouteIcon },
    { to: '/network/stops', key: 'stops', Icon: MapPin },
    { to: '/network/timetables', key: 'timetables', Icon: CalendarClock },
  ]},
  { group: null, items: [
    { to: '/incidents', key: 'incidents', Icon: AlertOctagon, badge: 'incidents' },
    { to: '/settings', key: 'system_settings', Icon: SettingsIcon },
  ]},
];

function Sidebar() {
  const { t } = useTranslation();
  const { user } = useAuth();
  const { reports } = useData();
  const navigate = useNavigate();

  const openIncidents = useMemo(() => reports.filter((r) => !r.resolved).length, [reports]);
  const displayName = user?.displayName || user?.email || '';
  const initial = (displayName.trim()[0] || '?').toUpperCase();

  return (
    <div className="sidebar">
      <div className="sidebar__brand">
        <img src={meuLogo} alt="MEU Logo" style={{ height: '36px', borderRadius: '4px', objectFit: 'contain' }} />
        <div className="sidebar__product">{t('app_name')}</div>
      </div>

      <nav className="sidebar__nav" aria-label={t('app_name')}>
        {NAV.map((section, i) => (
          <React.Fragment key={i}>
            {section.group && <div className="nav-group">{t(section.group)}</div>}
            {section.items.map(({ to, key, Icon, badge }) => (
              <NavLink
                key={to}
                to={to}
                className="nav-item"
                title={t(key)}
                onClick={to === '/operations' ? (e) => {
                  e.preventDefault();
                  window.location.href = '/operations';
                } : undefined}
              >
                <Icon size={18} aria-hidden="true" style={{ flex: 'none' }} />
                <span className="nav-label">{t(key)}</span>
                {badge === 'incidents' && openIncidents > 0 && (
                  <span className="nav-item__count tabular">{openIncidents}</span>
                )}
              </NavLink>
            ))}
          </React.Fragment>
        ))}
      </nav>

      <div className="sidebar__foot">
        <div className="sidebar__user">
          <div className="avatar" aria-hidden="true">{initial}</div>
          <div>
            <div className="sidebar__user-name">{displayName}</div>
            <div className="sidebar__user-role">{t('admin')}</div>
          </div>
        </div>
        <button className="logout-btn" onClick={() => signOut(auth).then(() => navigate('/'))}>
          <LogOut size={16} aria-hidden="true" />
          <span>{t('sign_out')}</span>
        </button>
      </div>
    </div>
  );
}

/* ---------- Shell ---------- */
function Shell() {
  const { t } = useTranslation();
  return (
    <div className="dashboard-layout">
      <Sidebar />
      <div className="main-content">
        <ErrorBoundary title={t('crash_title')} reloadLabel={t('reload')}>
          <Routes>
            <Route path="/operations" element={<Operations />} />
            <Route path="/fleet/buses" element={<Buses />} />
            <Route path="/fleet/drivers" element={<Drivers />} />
            <Route path="/network/routes" element={<RoutesPage />} />
            <Route path="/network/routes/:routeId" element={<RouteEditor />} />
            <Route path="/network/stops" element={<Stops />} />
            <Route path="/network/timetables" element={<Timetables />} />
            <Route path="/incidents" element={<Incidents />} />
            <Route path="/settings" element={<Settings />} />
            {/* legacy paths kept working for existing bookmarks */}
            <Route path="/dashboard" element={<Navigate to="/operations" replace />} />
            <Route path="/buses" element={<Navigate to="/fleet/buses" replace />} />
            <Route path="/drivers" element={<Navigate to="/fleet/drivers" replace />} />
            <Route path="*" element={<NotFound />} />
          </Routes>
        </ErrorBoundary>
      </div>
    </div>
  );
}

function NotFound() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  return (
    <>
      <PageHeader title="404" />
      <div className="page-content">
        <EmptyState title={t('not_found')}
          action={<Button variant="primary" onClick={() => navigate('/operations')}>{t('go_to_operations')}</Button>} />
      </div>
    </>
  );
}

/* ---------- Direction / language side effect ---------- */
function useDocumentDirection() {
  const { i18n } = useTranslation();
  useEffect(() => {
    const rtl = i18n.language?.startsWith('ar');
    document.documentElement.dir = rtl ? 'rtl' : 'ltr';
    document.documentElement.lang = rtl ? 'ar' : 'en';
  }, [i18n.language]);
}

// useJsApiLoader loads the script ONCE globally and never re-injects it on
// navigation, preventing GoogleMap instances from losing their state when the
// user navigates away and returns to the Operations page.
function MapsGate({ children }) {
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: MAPS_KEY || '',
    libraries: MAPS_LIBRARIES,
  });

  if (!MAPS_KEY) return children;   // no key — map will degrade gracefully
  if (!isLoaded) return <Boot />;   // show loading screen while script loads
  return children;
}

export default function App() {
  useDocumentDirection();
  return (
    <AuthProvider>
      <ToastProvider>
        <Router>
          <Routes>
            <Route path="/" element={<Login />} />
            <Route path="/*" element={
              <RequireAuth>
                <DataProvider>
                  <MapsGate>
                    <Shell />
                  </MapsGate>
                </DataProvider>
              </RequireAuth>
            } />
          </Routes>
        </Router>
      </ToastProvider>
    </AuthProvider>
  );
}
