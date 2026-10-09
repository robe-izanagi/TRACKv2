import { useState, useEffect } from "react";
import { Link } from "react-router-dom";
import { FiArrowRight } from "react-icons/fi";
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
  const handleEmailChange = (e) => {
    setEmail(e.target.value);
  };

  // ─── Show feedback ────────────────────────────────────
  const showFeedback = (message, type = "success") => {
    setFeedback({ message, type });
  };

  const clearFeedback = () => {
    setFeedback({ message: "", type: "" });
  };

  // ─── Submit Request ─────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
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
    const normalizedEmail = email.trim().toLowerCase();
    if (
      !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)
    ) {
      showFeedback(
        "Enter a valid email address, including the part after @ (for example, name@school.edu).",
        "error",
      );
      setLoading(false);
      return;
    }
    const emailDomain = normalizedEmail.split("@")[1];
    if (allowedDomains.length > 0
      && !allowedDomains.some((domain) => domain.toLowerCase() === emailDomain)) {
      showFeedback(
        `The email domain "${emailDomain}" is not approved for account requests. Use your official institutional email address or contact an administrator to ask whether this domain can be approved.`,
        "error",
      );
      setLoading(false);
      return;
    }
    if (!department && !office) {
      showFeedback(
        "Select at least one department or office so the administrator can assign your request correctly.",
        "error",
      );
      setLoading(false);
      return;
    }
    if (!role) {
      showFeedback("Select your role before submitting the account-code request.", "error");
      setLoading(false);
      return;
    }

    try {
      const payload = {
        email: normalizedEmail,
        full_name: fullName.trim(),
        department_id: department || null,
        office_id: office || null,
        role_id: role,
        position_id: position || null,
        description: description || null,
      };

      const res = await apiClient.post("/account-code-requests", payload);
      if (res.data && res.data.ok) {
        showFeedback(
          "Your account-code request has been submitted successfully. An administrator must approve it before you can register; please wait for the decision.",
          "success",
        );
        setEmail("");
        setFullName("");
        setDepartment("");
        setOffice("");
        setRole("");
        setPosition("");
        setDescription("");
      } else {
        showFeedback(
          res.data?.message || "We could not submit your request. Check your information and try again.",
          "error",
        );
      }
    } catch (err) {
      showFeedback(
        err?.response?.data?.message
          || "TRACK could not submit your request. Check your internet connection and try again.",
        "error",
      );
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

          <form onSubmit={handleSubmit} noValidate>
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
              />
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
                    {r.name}
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