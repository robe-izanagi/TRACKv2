import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { Link } from "react-router-dom";
import { getGoogleUrl } from "../../api/auth";
import BrandHeader from "../../components/common/BrandHeader";
import Footer from "../../components/layout/Footer";
import FeedbackModal from "../../components/common/FeedbackModal";
import styles from "./Login.module.css";

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", type: "error" });
  const [searchParams] = useSearchParams();

  // AuthCallback.jsx forwards backend errors here as ?error=<message>
  // (e.g. blocked account, account not found) after the Google redirect.
  useEffect(() => {
    const err = searchParams.get("error");
    if (err) {
      setFeedback({ message: decodeURIComponent(err), type: "error" });
    }
  }, [searchParams]);

  const handleGoogleLogin = async () => {
    setFeedback({ message: "", type: "error" });
    setLoading(true);
    try {
      const data = await getGoogleUrl(window.location.origin);
      if (data.url) {
        window.location.href = data.url;
      } else {
        setFeedback({
          message: "Failed to get Google login URL.",
          type: "error",
        });
      }
    } catch (err) {
      setFeedback({
        message:
          err?.response?.data?.message || err?.message || "TRACK could not start Google sign-in. Try again or use another sign-in method.",
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
          <h2 className={styles.title}>Welcome Back</h2>
          <p className={styles.description}>
            Sign in with your official Google account to access your calendars
            and tasks.
          </p>

          <button
            type="button"
            className={styles.googleButton}
            onClick={handleGoogleLogin}
            disabled={loading}
          >
            <FcGoogle className={styles.googleIcon} />
            {loading ? "Redirecting..." : "Continue With Google"}
          </button>

          <div className={styles.registerSection}>
            <span className={styles.registerText}>
              Don't have an account yet?
            </span>
            <p className={styles.info}>
              First-time users must authenticate with Google and provide an
              account code.
            </p>
            <Link to="/register" className={styles.secondaryButton}>
              Create Account
            </Link>
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
