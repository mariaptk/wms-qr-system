import { Navigate, NavLink, Route, Routes, useLocation } from 'react-router-dom';
import { useAuth } from './auth.jsx';
import { ROLE_LABELS } from './lib/shipments.js';
import { Loading } from './components/ui.jsx';
import LoginPage from './pages/LoginPage.jsx';
import RegisterPage from './pages/RegisterPage.jsx';
import DashboardPage from './pages/DashboardPage.jsx';
import ShipmentsPage from './pages/ShipmentsPage.jsx';
import ShipmentFormPage from './pages/ShipmentFormPage.jsx';
import ShipmentPage from './pages/ShipmentPage.jsx';
import ScanPage from './pages/ScanPage.jsx';
import CatalogPage from './pages/CatalogPage.jsx';
import MonitoringPage from './pages/MonitoringPage.jsx';

const NAV = [
  { to: '/', label: 'Сводка', end: true },
  { to: '/shipments', label: 'Отгрузки' },
  { to: '/scan', label: 'Сканер QR' },
  { to: '/catalog', label: 'Справочники' },
  { to: '/monitoring', label: 'Мониторинг' },
];

function Layout({ children }) {
  const { user, logout } = useAuth();
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="brand">
          <img src="/favicon.svg" alt="" width="32" height="32" />
          <div>
            <strong>WMS</strong>
            <span>склад и отгрузки</span>
          </div>
        </div>
        <nav>
          {NAV.map((item) => (
            <NavLink key={item.to} to={item.to} end={item.end}>{item.label}</NavLink>
          ))}
        </nav>
        <div className="sidebar-user">
          <div className="user-name">{user.name}</div>
          <div className="muted small">{ROLE_LABELS[user.role]} · {user.email}</div>
          <button className="btn btn-ghost btn-small" type="button" onClick={logout}>Выйти</button>
        </div>
      </aside>
      <main className="content">{children}</main>
    </div>
  );
}

function RequireAuth({ children }) {
  const { user, ready } = useAuth();
  const location = useLocation();
  if (!ready) return <div className="center-screen"><Loading text="Восстанавливаем сессию…" /></div>;
  if (!user) return <Navigate to="/login" replace state={{ from: location.pathname + location.search }} />;
  return <Layout>{children}</Layout>;
}

function NotFound() {
  return (
    <div className="card">
      <h1>Страница не найдена</h1>
      <p><NavLink to="/">На главную</NavLink></p>
    </div>
  );
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/" element={<RequireAuth><DashboardPage /></RequireAuth>} />
      <Route path="/shipments" element={<RequireAuth><ShipmentsPage /></RequireAuth>} />
      <Route path="/shipments/new" element={<RequireAuth><ShipmentFormPage /></RequireAuth>} />
      <Route path="/shipments/:id" element={<RequireAuth><ShipmentPage /></RequireAuth>} />
      <Route path="/shipments/:id/edit" element={<RequireAuth><ShipmentFormPage /></RequireAuth>} />
      <Route path="/scan" element={<RequireAuth><ScanPage /></RequireAuth>} />
      <Route path="/catalog" element={<RequireAuth><CatalogPage /></RequireAuth>} />
      <Route path="/monitoring" element={<RequireAuth><MonitoringPage /></RequireAuth>} />
      <Route path="*" element={<RequireAuth><NotFound /></RequireAuth>} />
    </Routes>
  );
}
