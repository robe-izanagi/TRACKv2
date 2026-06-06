import { NavLink, useNavigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

export default function Layout({ children }) {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  return (
    <div style={{ display: 'flex', minHeight: '100vh' }}>
      {/* Sidebar */}
      <aside style={{ width: 220, background: '#1e293b', color: '#e2e8f0', padding: '20px' }}>
        <h2 style={{ margin: '0 0 20px' }}>TRACK Admin</h2>
        <nav style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <NavLink to="/dashboard" style={linkStyle}>Dashboard</NavLink>
          <NavLink to="/account-codes" style={linkStyle}>Account Codes</NavLink>
          <NavLink to="/declaration" style={linkStyle}>Declaration</NavLink>
        </nav>
        <div style={{ marginTop: 'auto', paddingTop: 20 }}>
          <p style={{ fontSize: 14 }}>{user?.username || 'Admin'}</p>
          <button onClick={handleLogout} style={{ background: '#ef4444', color: 'white', border: 'none', padding: '6px 12px', borderRadius: 6, cursor: 'pointer' }}>Logout</button>
        </div>
      </aside>

      {/* Main content */}
      <main style={{ flex: 1, padding: 24, background: '#f1f5f9' }}>
        {children}
      </main>
    </div>
  );
}

const linkStyle = ({ isActive }) => ({
  color: isActive ? '#60a5fa' : '#cbd5e1',
  textDecoration: 'none',
  fontSize: 16,
  padding: '4px 0'
});