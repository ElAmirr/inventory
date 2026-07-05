import { Routes, Route, Navigate, Outlet, NavLink } from 'react-router-dom';
import { useContext } from 'react';
import { AuthContext } from './context/AuthContext';
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import Inventory from './pages/Inventory';
import Sales from './pages/Sales';
import Reports from './pages/Reports';
import Customers from './pages/Customers';
import Settings from './pages/Settings';
import { LayoutDashboard, Package2, ShoppingCart, BarChart3, LogOut, Users, Settings as SettingsIcon } from 'lucide-react';

function RequireAdminOrRedirect({ element, fallback }) {
  const { user } = useContext(AuthContext);
  if (user?.role !== 'admin') {
    return <Navigate to={fallback} replace />;
  }
  return element;
}

function ProtectedLayout() {
  const { user, logout } = useContext(AuthContext);
  if (!user) return <Navigate to="/login" replace />;

  return (
    <div className="app-shell">
      {/* ─── Sidebar ─── */}
      <aside className="sidebar">
        <h2 className="sidebar-brand">Shop OS</h2>

        <div className="sidebar-user">
          <div>Utilisateur : {user.username}</div>
          <strong style={{ textTransform: 'capitalize' }}>Rôle : {user.role}</strong>
        </div>

        <nav className="sidebar-nav">
          {user.role === 'admin' && (
            <NavLink to="/" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`} end>
              <LayoutDashboard size={18} /> Tableau de bord
            </NavLink>
          )}
          <NavLink to="/sales" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <ShoppingCart size={18} /> Caisse
          </NavLink>
          <NavLink to="/inventory" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
            <Package2 size={18} /> Inventaire
          </NavLink>
          {user.role === 'admin' && (
            <>
              <NavLink to="/customers" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <Users size={18} /> Clients
              </NavLink>
              <NavLink to="/reports" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <BarChart3 size={18} /> Rapports
              </NavLink>
              <NavLink to="/settings" className={({ isActive }) => `nav-link${isActive ? ' active' : ''}`}>
                <SettingsIcon size={18} /> Magasin
              </NavLink>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <button onClick={logout} className="nav-link logout" style={{ width: '100%' }}>
            <LogOut size={18} /> Déconnexion
          </button>
        </div>
      </aside>

      {/* ─── Main Content ─── */}
      <main className="main-content">
        <Outlet />
      </main>
    </div>
  );
}

function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/" element={<ProtectedLayout />}>
        {/* Cashiers don't have access to Dashboard, redirect them to sales */}
        <Route index element={<RequireAdminOrRedirect element={<Dashboard />} fallback="/sales" />} />
        <Route path="sales" element={<Sales />} />
        <Route path="inventory" element={<Inventory />} />
        <Route path="customers" element={<RequireAdminOrRedirect element={<Customers />} fallback="/sales" />} />
        <Route path="reports" element={<RequireAdminOrRedirect element={<Reports />} fallback="/sales" />} />
        <Route path="settings" element={<RequireAdminOrRedirect element={<Settings />} fallback="/sales" />} />
      </Route>
    </Routes>
  );
}

export default App;
