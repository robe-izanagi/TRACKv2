import { useEffect, useState } from 'react';
import { generateCode, listCodes, getDepartments, getOffices, getRoles } from '../api/admin';
import styles from './AccountCodes.module.css';

export default function AccountCodes() {
  const [codes, setCodes] = useState([]);
  const [depts, setDepts] = useState([]);
  const [offices, setOffices] = useState([]);
  const [roles, setRoles] = useState([]);
  const [form, setForm] = useState({
    is_admin: false,
    department_id: '',
    office_id: '',
    role_id: '',
  });
  const [message, setMessage] = useState('');
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      const [codesRes, deptsRes, officesRes, rolesRes] = await Promise.all([
        listCodes(),
        getDepartments(),
        getOffices(),
        getRoles()
      ]);
      setCodes(codesRes.codes || []);
      setDepts(deptsRes.items || []);
      setOffices(officesRes.items || []);
      setRoles(rolesRes.items || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage('');
    setLoading(true);
    try {
      const payload = {
        is_admin: form.is_admin,
      };
      if (!form.is_admin) {
        payload.department_id = form.department_id || undefined;
        payload.office_id = form.office_id;
        payload.role_id = form.role_id;
      }
      const res = await generateCode(payload);
      setMessage(`Code generated: ${res.account_code.code}`);
      loadData(); // refresh list
      // reset form
      setForm({ is_admin: false, department_id: '', office_id: '', role_id: '' });
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to generate code.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1>Account Codes</h1>

      {/* Generate Form */}
      <div className={styles.card}>
        <h2>Generate New Code</h2>
        <form onSubmit={handleSubmit}>
          <label className={styles.checkLabel}>
            <input
              type="checkbox"
              checked={form.is_admin}
              onChange={(e) => setForm({ ...form, is_admin: e.target.checked })}
            />
            Admin Code
          </label>

          {!form.is_admin && (
            <>
              <select
                className={styles.select}
                value={form.department_id}
                onChange={(e) => setForm({ ...form, department_id: e.target.value })}
              >
                <option value="">-- Select Department (optional) --</option>
                {depts.map(d => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>

              <select
                className={styles.select}
                value={form.office_id}
                onChange={(e) => setForm({ ...form, office_id: e.target.value })}
                required={!form.is_admin}
              >
                <option value="">-- Select Office --</option>
                {offices.map(o => <option key={o.id} value={o.id}>{o.name}</option>)}
              </select>

              <select
                className={styles.select}
                value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: e.target.value })}
                required={!form.is_admin}
              >
                <option value="">-- Select Role --</option>
                {roles.map(r => <option key={r.id} value={r.id}>{r.name}</option>)}
              </select>
            </>
          )}

          <button type="submit" disabled={loading} className={styles.btn}>
            {loading ? 'Generating...' : 'Generate Code'}
          </button>
        </form>
        {message && <p className={styles.msg}>{message}</p>}
      </div>

      {/* Codes Table */}
      <div className={styles.card}>
        <h2>Generated Codes</h2>
        <table className={styles.table}>
          <thead>
            <tr>
              <th>Code</th>
              <th>Type</th>
              <th>Department</th>
              <th>Office</th>
              <th>Role</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {codes.map(code => (
              <tr key={code.id}>
                <td>{code.code}</td>
                <td>{code.is_admin ? 'Admin' : 'User'}</td>
                <td>{code.Department?.name || '—'}</td>
                <td>{code.Office?.name || '—'}</td>
                <td>{code.Role?.name || '—'}</td>
                <td>{code.status}</td>
                <td>{new Date(code.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {codes.length === 0 && (
              <tr><td colSpan="7">No codes yet.</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}