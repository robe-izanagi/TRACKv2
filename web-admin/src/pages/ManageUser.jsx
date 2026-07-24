import { useState, useEffect, useCallback, useMemo, useRef } from "react";
import { FiSearch, FiUser, FiX } from "react-icons/fi";
import apiClient from "../api/client";
import styles from "./ManageUsers.module.css";

export default function ManageUsers() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");

  // Filter states
  const [statusFilter, setStatusFilter] = useState("");
  const [departmentFilter, setDepartmentFilter] = useState("");
  const [officeFilter, setOfficeFilter] = useState("");
  const [roleFilter, setRoleFilter] = useState("");

  // Lookup data for filters
  const [departments, setDepartments] = useState([]);
  const [offices, setOffices] = useState([]);
  const [roles, setRoles] = useState([]);

  // ─── Debounce search ──────────────────────────────────
  const debounceTimer = useRef(null);

  useEffect(() => {
    clearTimeout(debounceTimer.current);
    debounceTimer.current = setTimeout(() => {
      setDebouncedSearch(search);
    }, 400);
    return () => clearTimeout(debounceTimer.current);
  }, [search]);

  // ─── Fetch users (depends on debounced search + filters) ──
  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.append("search", debouncedSearch);
      if (statusFilter) params.append("status", statusFilter);
      if (departmentFilter) params.append("department_id", departmentFilter);
      if (officeFilter) params.append("office_id", officeFilter);
      if (roleFilter) params.append("role_id", roleFilter);

      const res = await apiClient.get(`/admin/users?${params.toString()}`);
      if (res.data.ok) {
        setUsers(res.data.users);
      }
    } catch (err) {
      console.error("Failed to fetch users:", err);
    } finally {
      setLoading(false);
    }
  }, [
    debouncedSearch,
    statusFilter,
    departmentFilter,
    officeFilter,
    roleFilter,
  ]);

  // ─── Fetch lookups (only once) ──────────────────────
  const fetchLookups = useCallback(async () => {
    try {
      const [deptRes, officeRes, roleRes] = await Promise.all([
        apiClient.get("/lookups/departments"),
        apiClient.get("/lookups/offices"),
        apiClient.get("/lookups/roles"),
      ]);
      setDepartments(deptRes.data.items || []);
      setOffices(officeRes.data.items || []);
      setRoles(roleRes.data.items || []);
    } catch (err) {
      console.error("Failed to fetch lookups:", err);
    }
  }, []);

  useEffect(() => {
    fetchLookups();
  }, [fetchLookups]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const clearFilters = () => {
    setSearch("");
    setStatusFilter("");
    setDepartmentFilter("");
    setOfficeFilter("");
    setRoleFilter("");
  };

  // ─── useMemo for filter options (static after fetch) ──
  const departmentOptions = useMemo(() => departments, [departments]);
  const officeOptions = useMemo(() => offices, [offices]);
  const roleOptions = useMemo(() => roles, [roles]);

  // ─── useMemo for user count / summary ──────────────
  const userCount = useMemo(() => users.length, [users]);

  // ─── Memoized status badge renderer ────────────────
  const getStatusBadge = useCallback((status) => {
    const statusMap = {
      active: { class: styles.badgeActive, label: "Active" },
      blocked: { class: styles.badgeBlocked, label: "Blocked" },
      suspended: { class: styles.badgeSuspended, label: "Suspended" },
      pending: { class: styles.badgePending, label: "Pending" },
    };
    const s = statusMap[status] || statusMap.pending;
    return <span className={s.class}>{s.label}</span>;
  }, []);

  // ─── Memoized table rows ────────────────────────────
  const userRows = useMemo(() => {
    if (users.length === 0) {
      return (
        <tr>
          <td colSpan="7" className={styles.noData}>
            No users found
          </td>
        </tr>
      );
    }
    return users.map((u) => (
      <tr key={u.id}>
        <td>
          <div className={styles.userCell}>
            <span className={styles.avatar}>
              {u.display_picture ? (
                <img src={u.display_picture} alt={u.username} />
              ) : (
                <FiUser />
              )}
            </span>
            <span className={styles.userName}>
              {u.full_name || u.username || "—"}
            </span>
          </div>
        </td>
        <td>{u.email}</td>
        <td>{getStatusBadge(u.status)}</td>
        <td>{u.department || "—"}</td>
        <td>{u.office || "—"}</td>
        <td>{u.role || "—"}</td>
        <td className={styles.joinedDate}>
          {new Date(u.created_at).toLocaleDateString("en-US", {
            month: "short",
            day: "numeric",
            year: "numeric",
          })}
        </td>
      </tr>
    ));
  }, [users, getStatusBadge]);

  return (
    <div className={styles.container}>
      <div className={styles.header}>
        <h1>Manage Users</h1>
        <span className={styles.userCount}>{userCount} users</span>
      </div>

      {/* ─── Search & Filters ─── */}
      <div className={styles.filterSection}>
        <div className={styles.searchBar}>
          <FiSearch className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search by username, email, or full name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
          {search && (
            <button className={styles.clearBtn} onClick={() => setSearch("")}>
              <FiX />
            </button>
          )}
        </div>

        <div className={styles.filterRow}>
          <select
            className={styles.filterSelect}
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
          >
            <option value="">All Status</option>
            <option value="active">Active</option>
            <option value="blocked">Blocked</option>
            <option value="suspended">Suspended</option>
            <option value="pending">Pending</option>
          </select>

          <select
            className={styles.filterSelect}
            value={departmentFilter}
            onChange={(e) => setDepartmentFilter(e.target.value)}
          >
            <option value="">All Departments</option>
            {departmentOptions.map((d) => (
              <option key={d.id} value={d.id}>
                {d.name}
              </option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={officeFilter}
            onChange={(e) => setOfficeFilter(e.target.value)}
          >
            <option value="">All Offices</option>
            {officeOptions.map((o) => (
              <option key={o.id} value={o.id}>
                {o.name}
              </option>
            ))}
          </select>

          <select
            className={styles.filterSelect}
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
          >
            <option value="">All Roles</option>
            {roleOptions.map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
              </option>
            ))}
          </select>

          {(statusFilter || departmentFilter || officeFilter || roleFilter) && (
            <button className={styles.clearFiltersBtn} onClick={clearFilters}>
              Clear Filters
            </button>
          )}
        </div>
      </div>

      {/* ─── Table ─── */}
      {loading ? (
        <p className={styles.loading}>Loading users...</p>
      ) : (
        <div className={styles.tableWrapper}>
          <table className={styles.table}>
            <thead>
              <tr>
                <th>User</th>
                <th>Email</th>
                <th>Status</th>
                <th>Department</th>
                <th>Office</th>
                <th>Role</th>
                <th>Joined</th>
              </tr>
            </thead>
            <tbody>{userRows}</tbody>
          </table>
        </div>
      )}
    </div>
  );
}
