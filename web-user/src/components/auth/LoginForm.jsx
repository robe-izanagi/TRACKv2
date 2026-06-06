import { useState } from "react";
import axios from "axios";
import { FcGoogle } from "react-icons/fc";
import styles from "../../styles/components/auth/LoginForm.module.css";

export default function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const res = await axios.post(`${apiBase}/api/auth/login`, { email, password });
      if (res.data && res.data.ok && res.data.token) {
        localStorage.setItem('token', res.data.token);
        // optionally store user
        localStorage.setItem('user', JSON.stringify(res.data.user || {}));
        window.location.href = '/';
      } else {
        setError((res.data && res.data.message) || 'Login failed');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Server error');
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = () => {
    console.log("Google login clicked");
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2 className={styles.title}>Welcome Back</h2>

      <label className={styles.field}>
        <span className={styles.label}>EMAIL</span>
        <input
          className={styles.input}
          type="email"
          placeholder="name@pup.edu.ph"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>PASSWORD</span>
        <input
          className={styles.input}
          type="password"
          placeholder="********"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      <div className={styles.forgotLink}>
        <a href="/forgot-password">FORGOT PASSWORD?</a>
      </div>

      <button className={styles.primaryButton} type="submit" disabled={loading}>
        {loading ? 'Logging in...' : 'Login'}
      </button>

      {error && <p className={styles.errorText}>{error}</p>}

      <button
        type="button"
        className={styles.googleButton}
        onClick={handleGoogleLogin}
      >
        <FcGoogle className={styles.googleIcon} />
        Continue With Google
      </button>

      <div className={styles.registerSection}>
        <span className={styles.registerText}>New to the institution?</span>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => (window.location.href = "/register")}
        >
          Register
        </button>
      </div>
    </form>
  );
}
