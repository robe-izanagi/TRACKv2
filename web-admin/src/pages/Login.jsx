import { useState } from "react";
import { useAuth } from "../context/AuthContext";
import { Navigate } from "react-router-dom";
import Footer from "../components/login/Footer";
import BrandHeader from "../components/login/BrandHeader";
import styles from "./Login.module.css";

export default function Login() {
  const { login, loading, error, token } = useAuth();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  if (token) return <Navigate to="/dashboard" replace />;

  const handleSubmit = (e) => {
    e.preventDefault();
    login(username, password);
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.pageContent}>
        <BrandHeader />
        <div className={styles.loginCard}>
          <h1 className={styles.title}>Admin Login</h1>
          <p className={styles.subTitle}>Welcome back!</p>
          <form onSubmit={handleSubmit}>
            <div className={styles.inputContainer}>
              <label for="username">Username: </label>
              <input
                type="text"
                placeholder="Enter Admin Username"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={styles.input}
                required
              />
            </div>
            <div className={styles.inputContainer}>
              <label for="password">Password: </label>
              <input
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
          </form>
          {error && <p style={{ color: "red" }}>{error}</p>}
        </div>
      </div>
      <Footer />
    </div>
  );
}
