import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Link, Navigate } from "react-router-dom";
import Footer from "../components/login/Footer";
import BrandHeader from "../components/login/BrandHeader";
import FeedbackModal from "../components/common/FeedbackModal";
import styles from "./Login.module.css";

export default function Login() {
  const { login, loading, error, token } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [formError, setFormError] = useState("");
  const [dismissedError, setDismissedError] = useState(false);

  if (token) return <Navigate to="/dashboard" replace />;

  const handleSubmit = (e) => {
    e.preventDefault();
    setFormError("");
    setDismissedError(false);
    if (!username.trim()) {
      setFormError("Enter your administrator username. It is the username you chose when your admin account was created.");
      return;
    }
    if (!password) {
      setFormError("Enter your password to sign in. If you forgot it, contact your system administrator.");
      return;
    }
    login(username.trim(), password);
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.pageContent}>
        <BrandHeader />
        <div className={styles.loginCard}>
          <h1 className={styles.title}>Admin Login</h1>
          <p className={styles.subTitle}>Welcome back!</p>
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.inputContainer}>
              <label htmlFor="username">Username: </label>
              <input
                id="username"
                type="text"
                placeholder="Enter Admin Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            <div className={styles.inputContainer}>
              <label htmlFor="password">Password: </label>
              <input
                id="password"
                type="password"
                placeholder="Enter Admin Password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? "Logging in..." : "Login"}
            </button>
            <p
              style={{
                textAlign: "center",
                marginTop: "16px",
                fontFamily: "sans-serif",
              }}
            >
              Don't have an account? <Link to="/register">Register here</Link>
            </p>
          </form>
        </div>
      </div>
      <Footer />
      <FeedbackModal
        message={formError || (dismissedError ? "" : error)}
        type="error"
        onClose={() => {
          setFormError("");
          setDismissedError(true);
        }}
      />
    </div>
  );
}
