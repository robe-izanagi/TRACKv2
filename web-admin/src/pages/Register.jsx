import { useState } from "react";
import { useNavigate, Link } from "react-router-dom";
import apiClient from "../api/client"; // ⚠️ i-adjust kung iba ang path ng axios instance mo
import Footer from "../components/login/Footer";
import BrandHeader from "../components/login/BrandHeader";
import FeedbackModal from "../components/common/FeedbackModal";
import styles from "./Login.module.css";

export default function Register() {
  const navigate = useNavigate();

  const [form, setForm] = useState({
    username: "",
    password: "",
    confirmPassword: "",
    accountCode: "",
  });
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", type: "error" });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ message: "", type: "error" });

    if (!form.accountCode.trim()) {
      setFeedback({
        message: "Enter the admin account code provided by your system administrator. It is required to create an admin account.",
        type: "error",
      });
      return;
    }
    if (!form.username.trim()) {
      setFeedback({
        message: "Choose a username for your administrator account.",
        type: "error",
      });
      return;
    }
    if (form.username.trim().length < 3) {
      setFeedback({
        message: "Your username must be at least 3 characters long. Choose a longer username and try again.",
        type: "error",
      });
      return;
    }
    if (!form.confirmPassword) {
      setFeedback({
        message: "Re-enter your password in the confirmation field so we can check that both entries match.",
        type: "error",
      });
      return;
    }
    if (form.password !== form.confirmPassword) {
      setFeedback({
        message: "The passwords do not match. Re-enter the same password in both password fields.",
        type: "error",
      });
      return;
    }
    if (form.password.length < 8) {
      setFeedback({
        message: "Your password must contain at least 8 characters. Enter a longer password and try again.",
        type: "error",
      });
      return;
    }
    setLoading(true);
    try {
      const { data } = await apiClient.post("/admin/register", {
        username: form.username.trim(),
        password: form.password,
        account_code: form.accountCode.trim(),
      });

      if (data.ok) {
        setFeedback({
          message: "Your administrator account has been created. You will be taken to the sign-in page shortly.",
          type: "success",
        });
        setTimeout(() => navigate("/login"), 1500);
      } else {
        setFeedback({
          message: data.message || "We could not create your account. Check the information and try again.",
          type: "error",
        });
      }
    } catch (err) {
      const message = err.response?.data?.message;
      const isGenericMessage = typeof message === "string"
        && /^(server error|internal server error|something went wrong|request failed)\.?$/i.test(message.trim());
      setFeedback({
        message: message && !isGenericMessage
          ? message
          : !err.response
            ? "TRACK could not reach the registration service. Check your internet connection and try again."
            : "The registration service could not complete your request. Your account has not been confirmed as created. Wait a moment and try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.loginPage}>
      <div className={styles.pageContent}>
        <BrandHeader />
        <div className={styles.loginCard}>
          <h1 className={styles.title}>Admin Register</h1>
          <p className={styles.subTitle}>Create a new admin account</p>
          <form onSubmit={handleSubmit} noValidate>
            <div className={styles.inputContainer}>
              <label htmlFor="accountCode">Admin Account Code: </label>
              <input
                type="text"
                id="accountCode"
                name="accountCode"
                placeholder="Enter Admin Account Code"
                value={form.accountCode}
                onChange={handleChange}
                className={styles.input}
                required
              />
            </div>
            <div className={styles.inputContainer}>
              <label htmlFor="username">Username: </label>
              <input
                type="text"
                id="username"
                name="username"
                placeholder="Choose a Username"
                value={form.username}
                onChange={handleChange}
                className={styles.input}
                required
                minLength={3}
                autoComplete="username"
              />
            </div>
            <div className={styles.inputContainer}>
              <label htmlFor="password">Password: </label>
              <input
                type="password"
                id="password"
                name="password"
                placeholder="Enter Password"
                value={form.password}
                onChange={handleChange}
                className={styles.input}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <div className={styles.inputContainer}>
              <label htmlFor="confirmPassword">Confirm Password: </label>
              <input
                type="password"
                id="confirmPassword"
                name="confirmPassword"
                placeholder="Re-enter Password"
                value={form.confirmPassword}
                onChange={handleChange}
                className={styles.input}
                required
                minLength={8}
                autoComplete="new-password"
              />
            </div>
            <button type="submit" disabled={loading} className={styles.button}>
              {loading ? "Creating Account..." : "Register"}
            </button>
          </form>
          <p
            style={{
              textAlign: "center",
              marginTop: "16px",
              fontFamily: "sans-serif",
            }}
          >
            Already have an account? <Link to="/login">Login here</Link>
          </p>
        </div>
      </div>
      <Footer />
      <FeedbackModal
        message={feedback.message}
        type={feedback.type}
        onClose={() => setFeedback({ message: "", type: "error" })}
      />
    </div>
  );
}
