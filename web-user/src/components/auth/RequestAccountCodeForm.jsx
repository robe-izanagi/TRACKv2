import { useState, useEffect } from "react";
import axios from "axios";
import styles from "../../styles/components/auth/RequestAccountCodeForm.module.css";

export default function RequestAccountCodeForm() {
  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [department, setDepartment] = useState("");
  const [office, setOffice] = useState("");
  const [role, setRole] = useState("");
  const [description, setDescription] = useState("");
  const [departments, setDepartments] = useState([]);
  const [offices, setOffices] = useState([]);
  const [rolesList, setRolesList] = useState([]);

  const handleSubmit = (e) => {
    e.preventDefault();
    (async () => {
      setLoading(true);
      setError("");
      try {
        const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001";
        const payload = {
          first_name: firstName,
          last_name: lastName,
          email,
          department_id: department || null,
          office_id: office || null,
          role_id: role || null,
          user_description: description || null,
        };

        const res = await axios.post(`${apiBase}/api/account-code-requests`, payload);
        if (res.data && res.data.ok) {
          setSuccess("Request submitted successfully. We will review it shortly.");
          // clear form
          setFirstName("");
          setLastName("");
          setEmail("");
          setDepartment("");
          setOffice("");
          setRole("");
          setDescription("");
        } else {
          setError((res.data && res.data.message) || "Submission failed.");
        }
      } catch (err) {
        setError(err?.response?.data?.message || err.message || "Server error");
      } finally {
        setLoading(false);
      }
    })();
  };

  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState("");
  const [error, setError] = useState("");

  useEffect(() => {
    const apiBase = import.meta.env.VITE_API_URL || "http://localhost:3001";
    (async () => {
      try {
        const [dRes, oRes, rRes] = await Promise.all([
          axios.get(`${apiBase}/api/lookups/departments`),
          axios.get(`${apiBase}/api/lookups/offices`),
          axios.get(`${apiBase}/api/lookups/roles`),
        ]);
        if (dRes.data && dRes.data.ok) setDepartments(dRes.data.items || []);
        if (oRes.data && oRes.data.ok) setOffices(oRes.data.items || []);
        if (rRes.data && rRes.data.ok) setRolesList(rRes.data.items || []);
      } catch (err) {
        console.warn('Failed to load lookups', err);
      }
    })();
  }, []);

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2 className={styles.title}>Request Account Code</h2>

      <label className={styles.field}>
        <span className={styles.label}>FIRST NAME</span>
        <input
          className={styles.input}
          type="text"
          placeholder="First Name"
          value={firstName}
          onChange={(e) => setFirstName(e.target.value)}
          required
        />
      </label>

      <label className={styles.field}>
        <span className={styles.label}>LAST NAME</span>
        <input
          className={styles.input}
          type="text"
          placeholder="Last Name"
          value={lastName}
          onChange={(e) => setLastName(e.target.value)}
          required
        />
      </label>

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
        <span className={styles.label}>DEPARTMENT</span>
        <select
          className={styles.input}
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          required
        >
          <option value="">Select Department</option>
          {departments.map((d) => (
            <option key={d.id} value={d.id}>{d.name}</option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>OFFICE</span>
        <select
          className={styles.input}
          value={office}
          onChange={(e) => setOffice(e.target.value)}
          required
        >
          <option value="">Select Office</option>
          {offices.map((o) => (
            <option key={o.id} value={o.id}>{o.name}</option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>ROLE</span>
        <select
          className={styles.input}
          value={role}
          onChange={(e) => setRole(e.target.value)}
          required
        >
          <option value="">Select Role</option>
          {rolesList.map((r) => (
            <option key={r.id} value={r.id}>{r.name}</option>
          ))}
        </select>
      </label>

      <label className={styles.field}>
        <span className={styles.label}>DESCRIPTION (OPTIONAL)</span>
        <textarea
          className={styles.textarea}
          placeholder="Reason for request / additional information."
          value={description}
          onChange={(e) => setDescription(e.target.value)}
        />
      </label>

      <button className={styles.primaryButton} type="submit" disabled={loading}>
        {loading ? "Submitting..." : "Submit Request"}
      </button>

      {error && <p className={styles.errorText}>{error}</p>}
      {success && <p className={styles.successText}>{success}</p>}

      <p className={styles.helpText}>
        Already have a Code? <a href="/register">Register Here</a>
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
