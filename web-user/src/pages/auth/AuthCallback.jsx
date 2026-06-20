import { useEffect } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getMe } from '../../api/auth';

export default function AuthCallback() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { login } = useAuth();

  useEffect(() => {
    const token = searchParams.get('token');
    const error = searchParams.get('error');

    if (error) {
      navigate(`/login?error=${error}`, { replace: true });
      return;
    }

    if (!token) {
      navigate('/login', { replace: true });
      return;
    }

    // Store token (this also triggers a profile fetch in AuthContext,
    // but we need the role immediately to redirect)
    login(null, token);

    // Fetch the full profile ourselves to know the role right now
    getMe()
      .then(res => {
        if (res.ok) {
          const role = res.user.role || 'faculty';
          const rolePath = `/${role}/home`;
          navigate(rolePath, { replace: true });
        } else {
          navigate('/login', { replace: true });
        }
      })
      .catch(() => {
        navigate('/login', { replace: true });
      });
  }, [searchParams, navigate, login]);

  return null;
}