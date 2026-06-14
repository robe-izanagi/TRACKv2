import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (token) {
      // We don't have user data here, but we can fetch it or store token and let context handle it.
      // For simplicity, just store token and navigate; the context's useEffect will fetch user.
      localStorage.setItem('token', token);
      navigate('/', { replace: true });
    } else if (error) {
      navigate(`/login?error=${error}`, { replace: true });
    } else {
      navigate('/login', { replace: true });
    }
  }, [searchParams, navigate, login]);

  return null;
}