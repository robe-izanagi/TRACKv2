import { useState } from "react";
import { useSearchParams } from "react-router-dom";
import { FcGoogle } from "react-icons/fc";
import { Link } from "react-router-dom";
import { getGoogleUrl } from "../../api/auth";
import BrandHeader from "../../components/common/BrandHeader";
import Footer from "../../components/layout/Footer";
import FeedbackModal from "../../components/common/FeedbackModal";
import styles from "./Login.module.css";

const AUTH_ERROR_MESSAGES = {
  domain_not_allowed:
    "The Google account you selected uses an email domain that is not approved for TRACK. Sign in with your official institutional email address, or contact an administrator to ask whether your domain can be approved.",
  invalid_email:
    "Google did not provide a valid email address for this account. Check that your Google account has an email address and try again.",
  blocked:
    "This account is currently blocked or suspended, so it cannot sign in. Contact an administrator if you think this is a mistake.",
  missing_code:
    "Google did not complete the sign-in request. Please start again and choose your Google account.",
  missing_token:
    "The sign-in service did not return a secure login session. Start sign-in again and choose your Google account.",
  profile_unavailable:
    "Your sign-in could not be completed because TRACK could not load your account details. Try again. If the problem continues, contact an administrator.",
  auth_failed:
    "Google sign-in could not be completed. Try again. If the problem continues, check that you selected the correct Google account or contact an administrator.",
};

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [feedback, setFeedback] = useState({ message: "", type: "error" });
  const [searchParams, setSearchParams] = useSearchParams();
  const callbackError = searchParams.get("error");
  const callbackMessage = callbackError
    ? AUTH_ERROR_MESSAGES[callbackError]
      || "We could not complete your sign-in. Please start again, and contact an administrator if the problem continues."
    : "";

  const handleGoogleLogin = async () => {
    setFeedback({ message: "", type: "error" });
    if (callbackError) {
      setSearchParams((current) => {
        const next = new URLSearchParams(current);
        next.delete("error");
        return next;
      }, { replace: true });
    }
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
        message:
          err?.response?.data?.message || "TRACK could not reach the sign-in service. Check your internet connection and try again.",
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
        message={feedback.message || callbackMessage}
        type={feedback.type}
        onClose={() => {
          setFeedback({ message: "", type: "error" });
          if (callbackError) {
            setSearchParams((current) => {
              const next = new URLSearchParams(current);
              next.delete("error");
              return next;
            }, { replace: true });
          }
        }}
      />
    </div>
  );
}
