import { useState } from 'react';
import { FcGoogle } from 'react-icons/fc';
import { Link } from 'react-router-dom';
import { getGoogleUrl } from '../../api/auth';
import styles from './Login.module.css';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleGoogleLogin = async () => {
    setError('');
    setLoading(true);
    try {
      const data = await getGoogleUrl(window.location.origin);
      if (data.url) {
        window.location.href = data.url;
      } else {
        setError('Failed to get Google login URL.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || 'Could not initiate Google login.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.form}>
      <h2 className={styles.title}>Welcome Back</h2>
      <p style={{ textAlign: 'center', color: '#555' }}>
        Sign in with your official Google account to access your calendars and tasks.
      </p>

      <button
        type="button"
        className={styles.googleButton}
        onClick={handleGoogleLogin}
        disabled={loading}
      >
        <FcGoogle className={styles.googleIcon} />
        {loading ? 'Redirecting...' : 'Continue With Google'}
      </button>

      {error && <p style={{ color: 'red', textAlign: 'center' }}>{error}</p>}

      <div className={styles.registerSection}>
        <span className={styles.registerText}>Don't have an account yet?</span>
        <p style={{ fontSize: '0.85rem', color: '#555' }}>
          First-time users must authenticate with Google and provide an account code.
        </p>
        <Link to="/register" className={styles.secondaryButton}>
          Create Account
        </Link>
      </div>
    </div>
  );
}