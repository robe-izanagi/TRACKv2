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

  // Smart redirect: only redirect when at root OR on a different role's path
  useEffect(() => {
    if (!user || loading) return;

    const currentPath = location.pathname;
    const publicPaths = ['/login', '/register', '/auth/callback', '/request-account-code'];
    if (publicPaths.some(p => currentPath.startsWith(p))) return;

    const role = user.role || 'faculty';
    const expectedHome = `/${role}/home`;

    // If user is at root "/", send them to their role-home
    if (currentPath === '/') {
      navigate(expectedHome, { replace: true });
      return;
    }

    // If user is on a path that starts with a different role (e.g., /staff/home when role is officials),
    // redirect to their own role-home
    const otherRoles = ['officials', 'staff', 'faculty'].filter(r => r !== role);
    if (otherRoles.some(r => currentPath.startsWith(`/${r}/`))) {
      navigate(expectedHome, { replace: true });
      return;
    }

    // Otherwise, allow navigation (e.g., /profile, /calendar, /venues, etc.)
  }, [user, loading, location.pathname, navigate]);

  const login = useCallback((_userData, newToken) => {
    localStorage.setItem('token', newToken);
    setToken(newToken);
    // Redirect to root; the effect above will send them to the correct role-home
    navigate('/', { replace: true });
  }, [navigate]);

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