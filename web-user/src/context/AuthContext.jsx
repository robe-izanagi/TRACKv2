import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getMe } from '../api/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [user, setUser] = useState(null);
  const [token, setToken] = useState(localStorage.getItem('token'));
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();
  const location = useLocation();

  // Fetch full profile whenever token changes
  useEffect(() => {
    if (!token) {
      setUser(null);
      setLoading(false);
      return;
    }

    setLoading(true);
    getMe()
      .then(res => {
        if (res.ok) {
          setUser(res.user);
        } else {
          // invalid token
          localStorage.removeItem('token');
          setToken(null);
          setUser(null);
        }
      })
      .catch(() => {
        localStorage.removeItem('token');
        setToken(null);
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, [token]);

  // Redirect to role‑based home after user is loaded (except on public pages)
  useEffect(() => {
    if (!user || loading) return;          // wait until profile is ready
    const publicPaths = ['/login', '/register', '/auth/callback', '/request-account-code'];
    if (publicPaths.some(p => location.pathname.startsWith(p))) return; // stay on public pages

    const role = user.role || 'faculty';
    const expectedHome = `/${role}/home`;
    if (location.pathname !== expectedHome) {
      navigate(expectedHome, { replace: true });
    }
  }, [user, loading, location.pathname, navigate]);

  const login = useCallback((_userData, newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    // Do NOT set user or navigate here – the effects above will handle everything
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem('token');
    setToken(null);
    setUser(null);
    navigate('/login', { replace: true });
  }, [navigate]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

export const useAuth = () => useContext(AuthContext);