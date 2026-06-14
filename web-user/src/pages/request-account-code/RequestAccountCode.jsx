import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import apiClient from '../../api/client';
import { getDepartments, getOffices, getRoles } from '../../api/lookups';
import styles from './RequestAccountCode.module.css';

export default function RequestAccountCode() {
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [email, setEmail] = useState('');
  const [department, setDepartment] = useState('');
  const [office, setOffice] = useState('');
  const [role, setRole] = useState('');
  const [description, setDescription] = useState('');
  const [departments, setDepartments] = useState([]);
  const [offices, setOffices] = useState([]);
  const [rolesList, setRolesList] = useState([]);
  const [loading, setLoading] = useState(false);
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const [dRes, oRes, rRes] = await Promise.all([
          getDepartments(),
          getOffices(),
          getRoles()
        ]);
        if (dRes.ok) setDepartments(dRes.items || []);
        if (oRes.ok) setOffices(oRes.items || []);
        if (rRes.ok) setRolesList(rRes.items || []);
      } catch (err) {
        console.warn('Failed to load lookups', err);
      }
    })();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');
    try {
      const payload = {
        first_name: firstName,
        last_name: lastName,
        email,
        department_id: department || null,
        office_id: office || null,
        role_id: role || null,
        user_description: description || null,
      };
      const res = await apiClient.post('/account-code-requests', payload);
      if (res.data && res.data.ok) {
        setSuccess('Request submitted successfully. We will review it shortly.');
        setFirstName('');
        setLastName('');
        setEmail('');
        setDepartment('');
        setOffice('');
        setRole('');
        setDescription('');
      } else {
        setError(res.data?.message || 'Submission failed.');
      }
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      <h2 className={styles.title}>Request Account Code</h2>

      <label className={styles.field}>
        <span className={styles.label}>FIRST NAME</span>
        <input className={styles.input} type="text" placeholder="First Name" value={firstName} onChange={(e) => setFirstName(e.target.value)} required />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>LAST NAME</span>
        <input className={styles.input} type="text" placeholder="Last Name" value={lastName} onChange={(e) => setLastName(e.target.value)} required />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>EMAIL</span>
        <input className={styles.input} type="email" placeholder="name@pup.edu.ph" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>
      <label className={styles.field}>
        <span className={styles.label}>DEPARTMENT</span>
        <select className={styles.input} value={department} onChange={(e) => setDepartment(e.target.value)} required>
          <option value="">Select Department</option>
          {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>OFFICE</span>
        <select className={styles.input} value={office} onChange={(e) => setOffice(e.target.value)} required>
          <option value="">Select Office</option>
          {offices.map((o) => <option key={o.id} value={o.id}>{o.name}</option>)}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>ROLE</span>
        <select className={styles.input} value={role} onChange={(e) => setRole(e.target.value)} required>
          <option value="">Select Role</option>
          {rolesList.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </label>
      <label className={styles.field}>
        <span className={styles.label}>DESCRIPTION (OPTIONAL)</span>
        <textarea className={styles.textarea} placeholder="Reason for request / additional information." value={description} onChange={(e) => setDescription(e.target.value)} />
      </label>

      <button className={styles.primaryButton} type="submit" disabled={loading}>
        {loading ? 'Submitting...' : 'Submit Request'}
      </button>

      {error && <p className={styles.errorText}>{error}</p>}
      {success && <p className={styles.successText}>{success}</p>}

      <p className={styles.helpText}>
        Already have a Code? <Link to="/register">Register Here</Link>
      </p>
      <div className={styles.loginAction}>
        <span className={styles.loginText}>Already have an Account?</span>
        <Link to="/login" className={styles.secondaryButton}>Login</Link>
      </div>
    </form>
  );
}