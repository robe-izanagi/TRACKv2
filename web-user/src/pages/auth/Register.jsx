import { useState } from "react";
import { FcGoogle } from "react-icons/fc";
import { useSearchParams, Link, useNavigate } from "react-router-dom";
import { getGoogleUrl, completeGoogleRegistration } from "../../api/auth";
import { useAuth } from "../../context/AuthContext";
import BrandHeader from "../../components/common/BrandHeader";
import Footer from "../../components/layout/Footer";
import styles from "./Register.module.css";

export default function Register() {
  const [searchParams] = useSearchParams();
  const registrationToken = searchParams.get("registration_token");
  const email = searchParams.get("email");
  const navigate = useNavigate();
  const { login } = useAuth();

  const [accountCode, setAccountCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // STEP 1: Google SSO button (no token)
  if (!registrationToken) {
    const handleGoogle = async () => {
      setLoading(true);
      try {
        const data = await getGoogleUrl(window.location.origin);
        if (data.url) {
          window.location.href = data.url;
        } else {
          setError(data.message || "TRACK could not start Google sign-in. Try again or use another sign-in method.");
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || "TRACK could not reach the server. Check your internet connection and try again.");
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

            {error && <p className={styles.errorText}>{error}</p>}

            <div className={styles.loginAction}>
              <span className={styles.loginText}>Already have an account?</span>
              <Link to="/login" className={styles.secondaryButton}>Login</Link>
            </div>
          </div>
        </div>
        <Footer />
      </div>
    );
  }

  // STEP 2: Account code form
  const handleSubmit = async (e) => {
    if (e) e.preventDefault();       // support both form submit and direct call
    console.log("handleSubmit called", accountCode);
    setError("");
    if (!accountCode.trim()) {
      setError("Please enter your account code.");
      return;
    }
    setLoading(true);
    console.log("Calling API…");
    try {
      const data = await completeGoogleRegistration(registrationToken, accountCode.trim());
      console.log("API response:", data);
      if (data.ok) {
        login(data.user, data.token);   // this already redirects to role home
      } else {
        setError(data.message || "Registration failed.");
      }
    } catch (err) {
      console.error("Registration error:", err);
      setError(err?.response?.data?.message || err?.message || "We could not complete your registration. Review your information and try again.");
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

          <label className={styles.field}>
            <span className={styles.label}>ACCOUNT CODE</span>
            <input
              className={styles.input}
              type="text"
              placeholder="e.g. CET-ICT-FACULTY-ABCDEF"
              value={accountCode}
              onChange={(e) => setAccountCode(e.target.value)}
              required
            />
          </label>

          {/* Button with both form submit and onClick fallback */}
          <button
            className={styles.primaryButton}
            type="submit"
            disabled={loading}
            onClick={(e) => {
              // If form submit didn't work, call handleSubmit manually
              if (!loading) {
                handleSubmit(e);
              }
            }}
          >
            {loading ? "Registering..." : "Complete Registration"}
          </button>

          {error && <p className={styles.errorText}>{error}</p>}

          <p className={styles.helpText}>
            Need an account code? <Link to="/request-account-code">Request one here</Link>
          </p>
        </div>
      </div>
      <Footer />
    </div>
  );
}