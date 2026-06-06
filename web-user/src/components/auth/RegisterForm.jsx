import { useState } from "react";
import axios from "axios";
import styles from "../../styles/components/auth/RegisterForm.module.css";

export default function RegisterForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [accountCode, setAccountCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");
    if (password !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }
    setLoading(true);
    try {
      const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001";
      const payload = { email, password, account_code: accountCode };
      const res = await axios.post(`${apiBase}/api/auth/register`, payload);
      if (res.data && res.data.ok) {
        setSuccess("Registration successful. You may now log in.");
        setEmail("");
        setPassword("");
        setConfirmPassword("");
        setAccountCode("");
      } else {
        setError((res.data && res.data.message) || "Registration failed.");
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || "Server error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2 className={styles.title}>Create Your Account</h2>

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
          placeholder="Password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>CONFIRM PASSWORD</span>
        <input
          className={styles.input}
          type="password"
          placeholder="Confirm Password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>ACCOUNT CODE</span>
        <input
          className={styles.input}
          type="text"
          placeholder="Account Code"
          value={accountCode}
          onChange={(e) => setAccountCode(e.target.value)}
          required
        />
      </label>

      <button className={styles.primaryButton} type="submit" disabled={loading}>
        {loading ? "Registering..." : "Register"}
      </button>

      {error && <p className={styles.errorText}>{error}</p>}
      {success && <p className={styles.successText}>{success}</p>}

      <p className={styles.helpText}>
        Need an Account Code? <a href="/request-account-code">Request one Here</a>
      </p>

      <div className={styles.loginAction}>
        <span className={styles.loginText}>Already have an Account?</span>
        <button
          type="button"
          className={styles.secondaryButton}
          onClick={() => (window.location.href = "/login")}
        >
          Login
        </button>
      </div>
    </form>
  );
}
