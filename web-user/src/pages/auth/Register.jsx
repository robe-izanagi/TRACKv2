import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { useSearchParams, Link } from "react-router-dom";
import { getGoogleUrl, completeGoogleRegistration } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import BrandHeader from "../../components/common/BrandHeader";
import Footer from "../../components/layout/Footer";
import FeedbackModal from "../../components/common/FeedbackModal";
import styles from "./Register.module.css";

export default function Register() {
  const [searchParams] = useSearchParams();
  const registrationToken = searchParams.get("registration_token");
  const email = searchParams.get("email");
  const { login } = useAuth();

  const [accountCode, setAccountCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", type: "error" });

  // STEP 1: Google SSO button (no token)
  if (!registrationToken) {
    const handleGoogle = async () => {
      setFeedback({ message: "", type: "error" });
      setLoading(true);
      try {
        const data = await getGoogleUrl(window.location.origin);
        if (data.url) {
          window.location.href = data.url;
        } else {
          setFeedback({
            message: "TRACK could not prepare Google sign-in. Please try again in a moment.",
            type: "error",
          });
        }
      } catch (err) {
        setFeedback({
          message: err.response?.data?.message
            || "TRACK could not reach the sign-in service. Check your internet connection and try again.",
          type: "error",
        });
      } finally {
        setLoading(false);
      }
    };

    return (
      <div className={styles.registerPage}>
        <div className={styles.pageContent}>
          <BrandHeader />
          <div className={styles.registerCard}>
            <h2 className={styles.title}>Create Your Account</h2>
            <p className={styles.infoText}>
              Start by signing in with your official Google account.
            </p>

            <button
              type="button"
              className={styles.googleButton}
              onClick={handleGoogle}
              disabled={loading}
            >
              <FcGoogle className={styles.googleIcon} />
              {loading ? "Redirecting..." : "Continue With Google"}
            </button>

            <div className={styles.loginAction}>
              <span className={styles.loginText}>Already have an account?</span>
              <Link to="/login" className={styles.secondaryButton}>Login</Link>
            </div>
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFeedback({ message: "", type: "error" });
    if (!accountCode.trim()) {
      setFeedback({
        message: "Enter the account code provided by your administrator. It is required to complete registration.",
        type: "error",
      });
      return;
    }
    setLoading(true);
    try {
      const data = await completeGoogleRegistration(registrationToken, accountCode.trim());
      if (data.ok) {
        login(data.user, data.token);
      } else {
        setFeedback({
          message: data.message || "We could not complete your registration. Check the account code and try again.",
          type: "error",
        });
      }
    } catch (err) {
      console.error("Registration error:", err);
      setFeedback({
        message: err?.response?.data?.message
          || "We could not reach the registration service. Check your internet connection and try again.",
        type: "error",
      });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.registerPage}>
      <div className={styles.pageContent}>
        <BrandHeader />
        <div className={styles.registerCard}>
          <h2 className={styles.title}>Complete Your Registration</h2>
          <p className={styles.infoText}>
            Signed in as <strong>{email}</strong>.<br />
            Enter the account code provided by your administrator to continue.
          </p>

          <form onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span className={styles.label}>ACCOUNT CODE</span>
              <input
                className={styles.input}
                type="text"
                placeholder="e.g. CET-ICT-FACULTY-ABCDEF"
                value={accountCode}
                onChange={(e) => setAccountCode(e.target.value)}
                autoComplete="off"
              />
            </label>
            <button
              className={styles.primaryButton}
              type="submit"
              disabled={loading}
            >
              {loading ? "Registering..." : "Complete Registration"}
            </button>
          </form>

          <p className={styles.helpText}>
            Need an account code? <Link to="/request-account-code">Request one here</Link>
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