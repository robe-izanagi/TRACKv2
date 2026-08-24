import { useState, useEffect } from "react";
import { useNavigate, Link } from "react-router-dom";
import { FiCheckCircle, FiAlertCircle, FiArrowRight } from "react-icons/fi";
import apiClient from "../../api/client";
import {
  getDepartments,
  getOffices,
  getRoles,
  getAvailablePositionsPublic,
  getDomains,
} from "../../api/lookups";
import BrandHeader from "../../components/common/BrandHeader";
import Footer from "../../components/layout/Footer";
import FeedbackModal from "../../components/common/FeedbackModal";
import styles from "./RequestAccountCode.module.css";

export default function RequestAccountCode() {
  const navigate = useNavigate();

  // ─── Form State ──────────────────────────────────────
  const [email, setEmail] = useState("");
  const [fullName, setFullName] = useState("");
  const [department, setDepartment] = useState("");
  const [office, setOffice] = useState("");
  const [role, setRole] = useState("");
  const [position, setPosition] = useState("");
  const [description, setDescription] = useState("");

  const [departments, setDepartments] = useState([]);
  const [offices, setOffices] = useState([]);
  const [roles, setRoles] = useState([]);
  const [positions, setPositions] = useState([]);
  const [allowedDomains, setAllowedDomains] = useState([]);

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  // ─── Email validation state ──────────────────────────
  const [emailError, setEmailError] = useState("");

  // ─── Feedback state ──────────────────────────────────
  const [feedback, setFeedback] = useState({ message: "", type: "" });

  // ─── Fetch lookups and domains ───────────────────────
  useEffect(() => {
    (async () => {
      try {
        const [dRes, oRes, rRes, pRes, domRes] = await Promise.all([
          getDepartments(),
          getOffices(),
          getRoles(),
          getAvailablePositionsPublic(),
          getDomains(),
        ]);
        if (dRes.ok) setDepartments(dRes.items || []);
        if (oRes.ok) setOffices(oRes.items || []);
        if (rRes.ok) setRoles(rRes.items || []);
        if (pRes.ok) setPositions(pRes.positions || []);
        if (domRes.ok) setAllowedDomains(domRes.domains || []);
      } catch (err) {
        console.warn("Failed to load lookups", err);
      }
    })();
  }, []);

  // ─── Validate email domain ───────────────────────────
  const validateEmailDomain = (emailValue) => {
    if (!emailValue) {
      setEmailError("");
      return true;
    }
    const domain = emailValue.split("@")[1];
    if (!domain) {
      setEmailError("Please enter a valid email address.");
      return false;
    }
    if (allowedDomains.length > 0 && !allowedDomains.includes(domain)) {
      setEmailError(
        `Email domain "${domain}" is not allowed. Allowed domains: ${allowedDomains.join(", ")}`,
      );
      return false;
    }
    setEmailError("");
    return true;
  };

  const handleEmailChange = (e) => {
    const value = e.target.value;
    setEmail(value);
    validateEmailDomain(value);
  };

  // ─── Show feedback ────────────────────────────────────
  const showFeedback = (message, type = "success") => {
    setFeedback({ message, type });
  };

  const clearFeedback = () => {
    setFeedback({ message: "", type: "" });
    setSuccess("");
    setError("");
  };

  // ─── Submit Request ─────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setSuccess("");
    clearFeedback();

    // ── Basic validation ──
    if (!fullName.trim()) {
      showFeedback("Please enter your full name.", "error");
      setLoading(false);
      return;
    }
    if (!email.trim()) {
      showFeedback("Please enter your email address.", "error");
      setLoading(false);
      return;
    }
    // Validate email domain again
    if (!validateEmailDomain(email)) {
      showFeedback(emailError, "error");
      setLoading(false);
      return;
    }
    // At least one of department or office must be selected
    if (!department && !office) {
      showFeedback("Please select at least one: Department or Office.", "error");
      setLoading(false);
      return;
    }
    if (!role) {
      showFeedback("Please select a role.", "error");
      setLoading(false);
      return;
    }

    try {
      const payload = {
        email: email.trim(),
        full_name: fullName.trim(),
        department_id: department || null,
        office_id: office || null,
        role_id: role,
        position_id: position || null,
        description: description || null,
      };

      const res = await apiClient.post("/account-code-requests", payload);
      if (res.data && res.data.ok) {
        showFeedback("Request submitted successfully! Please wait for admin approval.", "success");
        setEmail("");
        setFullName("");
        setDepartment("");
        setOffice("");
        setRole("");
        setPosition("");
        setDescription("");
        setEmailError("");
      } else {
        showFeedback(res.data?.message || "Submission failed.", "error");
      }
    } catch (err) {
      const status = err?.response?.status;
      const msg = err?.response?.data?.message || err.message || "Server error";

      let userMsg = msg;
      if (status === 409 || msg.includes("already registered") || msg.includes("pending request") || msg.includes("approved")) {
        if (msg.includes("already registered")) {
          userMsg = "This email is already registered. Please login or use a different email address.";
        } else if (msg.includes("pending request")) {
          userMsg = "You already have a pending request. Please wait for admin approval.";
        } else if (msg.includes("approved")) {
          userMsg = "This email already has an approved account code request. Please check your email for the code.";
        } else {
          userMsg = "This email is already in the system. Please use a different email address.";
        }
      } else if (msg.includes("pending request")) {
        userMsg = "You already have a pending request. Please wait for admin review.";
      }
      showFeedback(userMsg, "error");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className={styles.requestAccountCodePage}>
      <div className={styles.pageContent}>
        <BrandHeader />
        <div className={styles.requestCard}>
          <h2 className={styles.title}>Request Account Code</h2>

          <form onSubmit={handleSubmit}>
            <label className={styles.field}>
              <span className={styles.label}>FULL NAME *</span>
              <input
                className={styles.input}
                type="text"
                placeholder="Enter your full name"
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                required
              />
            </label>

            <label className={styles.field}>
              <span className={styles.label}>EMAIL *</span>
              <input
                className={styles.input}
                type="email"
                placeholder="Enter your email address"
                value={email}
                onChange={handleEmailChange}
                required
                style={{ borderColor: emailError ? "var(--input-focus-color)" : "" }}
              />
              {emailError && (
                <span className={styles.fieldError}>{emailError}</span>
              )}
            </label>

            <div className={styles.fieldGroup}>
              <span className={styles.labelGroup}>DEPARTMENT OR OFFICE *</span>
              <div className={styles.row}>
                <label className={styles.fieldHalf}>
                  <span className={styles.subLabel}>Department</span>
                  <select
                    className={styles.input}
                    value={department}
                    onChange={(e) => setDepartment(e.target.value)}
                  >
                    <option value="">Select Department</option>
                    {departments.map((d) => (
                      <option key={d.id} value={d.id}>
                        {d.name}
                      </option>
                    ))}
                  </select>
                </label>

                <label className={styles.fieldHalf}>
                  <span className={styles.subLabel}>Office</span>
                  <select
                    className={styles.input}
                    value={office}
                    onChange={(e) => setOffice(e.target.value)}
                  >
                    <option value="">Select Office</option>
                    {offices.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.name}
                      </option>
                    ))}
                  </select>
                </label>
              </div>
              <span className={styles.hintText}>
                At least one of Department or Office must be selected.
              </span>
            </div>

            <label className={styles.field}>
              <span className={styles.label}>ROLE *</span>
              <select
                className={styles.input}
                value={role}
                onChange={(e) => setRole(e.target.value)}
                required
              >
                <option value="">Select Role</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name=="officials"?"heads":r.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>POSITION</span>
              <select
                className={styles.input}
                value={position}
                onChange={(e) => setPosition(e.target.value)}
              >
                <option value="">None</option>
                {positions.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </label>

            <label className={styles.field}>
              <span className={styles.label}>ADDITIONAL NOTES</span>
              <textarea
                className={styles.textareaSmall}
                placeholder="Any additional information for the admin..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
              />
            </label>

            <button
              className={styles.primaryButton}
              type="submit"
              disabled={loading}
            >
              {loading ? "Submitting..." : "Submit Request"}
            </button>
          </form>

          {/* ─── Link to Register ─────────────────────────── */}
          <div className={styles.registerLinkWrapper}>
            <span className={styles.registerLinkText}>
              Already have an account code?{" "}
              <Link to="/register" className={styles.registerLink}>
                Register here <FiArrowRight size={14} />
              </Link>
            </span>
          </div>
        </div>
      </div>
      <Footer />

      {/* ─── Feedback Modal ─────────────────────────────── */}
      <FeedbackModal
        message={feedback.message}
        type={feedback.type}
        onClose={clearFeedback}
      />
    </div>
  );
}