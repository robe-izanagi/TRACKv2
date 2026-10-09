import { createContext, useContext, useState } from 'react';
import { loginAdmin } from '../api/auth';

const AuthContext = createContext();

export const AuthProvider = ({ children }) => {
  const [token, setToken] = useState(localStorage.getItem('admin_token'));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const login = async (username, password) => {
    setLoading(true);
    setError('');
    try {
      const result = await loginAdmin(username, password);
      if (!result.ok) {
        setError(result.message
          || 'We could not sign you in. Check your administrator username and password, then try again.');
      } else {
        localStorage.setItem('admin_token', result.token);
        setToken(result.token);
        setUser(result.user);
      }
    } catch (err) {
      const message = err.response?.data?.message;
      const isGenericMessage = typeof message === 'string'
        && /^(server error|internal server error|something went wrong|request failed)\.?$/i.test(message.trim());
      setError(message && !isGenericMessage
        ? message
        : !err.response
          ? 'TRACK could not reach the sign-in service. Check your internet connection and try again.'
          : 'The sign-in service could not complete your request. Wait a moment and try again. If the problem continues, contact your system administrator.');
    } finally {
      setLoading(false);
    }
  };

  const logout = () => {
    localStorage.removeItem('admin_token');
    setToken(null);
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, error, login, logout }}>
      {children}
    </AuthContext.Provider>
  );
};

// The auth hook is intentionally exported beside its provider for this context module.
// eslint-disable-next-line react-refresh/only-export-components
export const useAuth = () => useContext(AuthContext);