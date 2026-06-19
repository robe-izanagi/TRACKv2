import { useEffect, useState, useRef } from "react";
import {
  generateCode,
  listCodes,
  getDepartments,
  getOffices,
  getRoles,
  getAvailablePositions,
} from "../api/admin";
import styles from "./AccountCodes.module.css";

// ── Simple searchable dropdown ──────────────────────────
function SearchableSelect({ options, value, onChange, placeholder }) {
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const wrapperRef = useRef(null);

  // close on outside click
  useEffect(() => {
    const handler = (e) => {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const filtered = options.filter((opt) =>
    opt.label.toLowerCase().includes(search.toLowerCase()),
  );

  const selectedLabel = options.find((o) => o.value === value)?.label || "";

  return (
    <div ref={wrapperRef} className={styles.searchableWrapper}>
      <input
        type="text"
        className={styles.input}
        placeholder={placeholder}
        value={open ? search : selectedLabel}
        onFocus={() => {
          setOpen(true);
          setSearch("");
        }}
        onChange={(e) => {
          setSearch(e.target.value);
          setOpen(true);
        }}
      />
      {open && (
        <ul className={styles.dropdown}>
          {filtered.map((opt) => (
            <li
              key={opt.value}
              className={styles.dropdownItem}
              onClick={() => {
                onChange(opt.value);
                setSearch("");
                setOpen(false);
              }}
            >
              {opt.label}
            </li>
          ))}
          {filtered.length === 0 && (
            <li className={styles.dropdownEmpty}>No match</li>
          )}
        </ul>
      )}
    </div>
  );
}

// ── Main component ──────────────────────────────────────
export default function AccountCodes() {
  const [codes, setCodes] = useState([]);
  const [depts, setDepts] = useState([]);
  const [offices, setOffices] = useState([]);
  const [roles, setRoles] = useState([]);
  const [positions, setPositions] = useState([]);
  const [form, setForm] = useState({
    is_admin: false,
    department_id: "",
    office_id: "",
    role_id: "",
    position_id: "",
  });
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);

  const loadData = async () => {
    try {
      const [codesRes, deptsRes, officesRes, rolesRes, posRes] =
        await Promise.all([
          listCodes(),
          getDepartments(),
          getOffices(),
          getRoles(),
          getAvailablePositions(),
        ]);
      setCodes(codesRes.codes || []);
      setDepts(deptsRes.items || []);
      setOffices(officesRes.items || []);
      setRoles(rolesRes.items || []);
      setPositions(posRes.positions || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setMessage("");
    setLoading(true);
    try {
      const payload = { is_admin: form.is_admin };
      if (!form.is_admin) {
        payload.department_id = form.department_id || undefined;
        payload.office_id = form.office_id;
        payload.role_id = form.role_id;
        payload.position_id = form.position_id || undefined;
      }
      const res = await generateCode(payload);
      setMessage(`Code generated: ${res.account_code.code}`);
      loadData();
      setForm({
        is_admin: false,
        department_id: "",
        office_id: "",
        role_id: "",
        position_id: "",
      });
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to generate code.");
    } finally {
      setLoading(false);
    }
  };

  // Prepare option arrays for searchable selects
  const positionOpts = positions.map((p) => ({
    value: p.id,
    label: `${p.name}${!p.allow_multiple ? " (single holder)" : ""}`,
  }));
  const deptOpts = depts.map((d) => ({ value: d.id, label: d.name }));
  const officeOpts = offices.map((o) => ({ value: o.id, label: o.name }));

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
              {/* Position – searchable */}
              <SearchableSelect
                options={positionOpts}
                value={form.position_id}
                onChange={(val) => setForm({ ...form, position_id: val })}
                placeholder="-- Select Position (if on the list) --"
              />

              {/* Department – searchable */}
              <SearchableSelect
                options={deptOpts}
                value={form.department_id}
                onChange={(val) => setForm({ ...form, department_id: val })}
                placeholder="-- Select Department (if have) --"
              />

              {/* Office – searchable */}
              <SearchableSelect
                options={officeOpts}
                value={form.office_id}
                onChange={(val) => setForm({ ...form, office_id: val })}
                placeholder="-- Select Office --"
              />

              {/* Role – simple select (only 3 items) */}
              <select
                className={styles.select}
                value={form.role_id}
                onChange={(e) => setForm({ ...form, role_id: e.target.value })}
                required={!form.is_admin}
              >
                <option value="">-- Select Role --</option>
                {roles.map((r) => (
                  <option key={r.id} value={r.id}>
                    {r.name}
                  </option>
                ))}
              </select>
            </>
          )}

          <button type="submit" disabled={loading} className={styles.btn}>
            {loading ? "Generating..." : "Generate Code"}
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
              <th>Generated By</th>
              <th>Type</th>
              <th>Department</th>
              <th>Office</th>
              <th>Role</th>
              <th>Position</th>
              <th>Status</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {codes.map((code) => (
              <tr key={code.id}>
                <td>{code.code}</td>
                <td>{code.generated_by || "—"}</td>
                <td>{code.is_admin ? "Admin" : "User"}</td>
                <td>{code.department || "—"}</td>
                <td>{code.office || "—"}</td>
                <td>{code.role || "—"}</td>
                <td>{code.position || "—"}</td>
                <td>{code.status}</td>
                <td>{new Date(code.created_at).toLocaleDateString()}</td>
              </tr>
            ))}
            {codes.length === 0 && (
              <tr>
                <td colSpan="8">No codes yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
