import { useState, useEffect } from "react";
import Modal from "../common/Modal";
import apiClient from "../../api/client";
import {
  FiSearch,
  FiUser,
  FiBriefcase,
  FiMapPin,
  FiHome,
} from "react-icons/fi";
import styles from "./InviteAttendeesModal.module.css";

export default function InviteAttendeesModal({
  isOpen,
  onClose,
  selectedIds,
  onSave,
  departmentId = null,
  type = "attendees",
}) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [tempSelected, setTempSelected] = useState([...selectedIds]);

  // Sort & Filter states
  const [sortBy, setSortBy] = useState("name");
  const [filterType, setFilterType] = useState("all"); // all, department, office
  const [filterValue, setFilterValue] = useState(""); // UUID of selected department/office
  const [selectAllChecked, setSelectAllChecked] = useState(false);

  // Dropdown options for filter
  const [departments, setDepartments] = useState([]);
  const [offices, setOffices] = useState([]);

  // Fetch non‑admin users and lookup data on open
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      try {
        const [usersRes, deptRes, officeRes] = await Promise.all([
          apiClient.get("/auth/users?exclude_admins=true"),
          apiClient.get("/lookups/departments"),
          apiClient.get("/lookups/offices"),
        ]);
        setUsers(usersRes.data.users || []);
        setDepartments(deptRes.data.items || []);
        setOffices(officeRes.data.items || []);
        setTempSelected([...selectedIds]);
      } catch (err) {
        console.error("Failed to load data", err);
      }
    };
    fetchData();
  }, [isOpen, selectedIds]);

  // ── Filtered & sorted list ──────────────────────
  const filteredUsers = users
    .filter((u) => {
      // Search filter
      if (search) {
        const term = search.toLowerCase();
        const matchName = (u.name || "").toLowerCase().includes(term);
        const matchEmail = (u.email || "").toLowerCase().includes(term);
        if (!matchName && !matchEmail) return false;
      }

      // Filter type
      if (filterType === "department" && filterValue) {
        return u.department_id === filterValue;
      }
      if (filterType === "office" && filterValue) {
        return u.office_id === filterValue;
      }
      return true;
    })
    .sort((a, b) => {
      const valA = (a[sortBy] || "").toLowerCase();
      const valB = (b[sortBy] || "").toLowerCase();
      if (valA < valB) return -1;
      if (valA > valB) return 1;
      return 0;
    });

  // Manage "Select All" checkbox based on filtered list
  useEffect(() => {
    if (filteredUsers.length === 0) {
      setSelectAllChecked(false);
      return;
    }
    const allVisibleSelected = filteredUsers.every((u) =>
      tempSelected.includes(u.id),
    );
    setSelectAllChecked(allVisibleSelected);
  }, [filteredUsers, tempSelected]);

  const toggleUser = (userId) => {
    setTempSelected((prev) =>
      prev.includes(userId)
        ? prev.filter((id) => id !== userId)
        : [...prev, userId],
    );
  };

  const handleSelectAll = () => {
    if (selectAllChecked) {
      // Deselect all visible
      const visibleIds = new Set(filteredUsers.map((u) => u.id));
      setTempSelected((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
      // Select all visible
      const visibleIds = filteredUsers.map((u) => u.id);
      setTempSelected((prev) => [...new Set([...prev, ...visibleIds])]);
    }
    setSelectAllChecked(!selectAllChecked);
  };

  const handleSave = () => {
    onSave(tempSelected);
    onClose();
  };

  const handleFilterTypeChange = (e) => {
    setFilterType(e.target.value);
    setFilterValue(""); // reset value when switching filter type
  };

  const handleFilterValueChange = (e) => {
    setFilterValue(e.target.value);
  };

  return (
    <Modal
      isOpen={isOpen}
      onClose={onClose}
      title={
        type === "collaborators" ? "Add Collaborators" : "Invite Attendees"
      }
    >
      {/* Search + Sort */}
      <div className={styles.controlsRow}>
        <div className={styles.searchBar}>
          <FiSearch size={16} />
          <input
            type="text"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        <select
          className={styles.sortSelect}
          value={sortBy}
          onChange={(e) => setSortBy(e.target.value)}
        >
          <option value="name">Name</option>
          <option value="email">Email</option>
          <option value="department">Department</option>
          <option value="office">Office</option>
        </select>
      </div>

      {/* Filter row: Filter type + value + Select All */}
      <div className={styles.filterRow}>
        <div className={styles.filterGroup}>
          <select
            className={styles.filterSelect}
            value={filterType}
            onChange={handleFilterTypeChange}
          >
            <option value="all">All</option>
            <option value="department">Department</option>
            <option value="office">Office</option>
          </select>

          {filterType !== "all" && (
            <select
              className={styles.filterValueSelect}
              value={filterValue}
              onChange={handleFilterValueChange}
            >
              <option value="">-- Select {filterType} --</option>
              {filterType === "department" &&
                departments.map((d) => (
                  <option key={d.id} value={d.id}>
                    {d.name}
                  </option>
                ))}
              {filterType === "office" &&
                offices.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
            </select>
          )}
        </div>

        <label className={styles.selectAllLabel}>
          <input
            type="checkbox"
            checked={selectAllChecked}
            onChange={handleSelectAll}
          />
          Select All
        </label>
      </div>

      {/* User list – fixed cards */}
      <div className={styles.list}>
        {filteredUsers.map((user) => (
          <label key={user.id} className={styles.userCard}>
            <input
              type="checkbox"
              checked={tempSelected.includes(user.id)}
              onChange={() => toggleUser(user.id)}
              className={styles.checkbox}
            />
            {/* LEFT SIDE */}
            <div className={styles.userLeft}>
              <div className={styles.avatarPlaceholder}>
                <FiUser size={24} />
              </div>
              <div className={styles.userInfo}>
                <div className={styles.userName}>{user.name || "Unknown"}</div>
                <div className={styles.userEmail}>{user.email}</div>
              </div>
            </div>
            {/* RIGHT SIDE */}
            <div className={styles.userRight}>
              {user.position && (
                <div className={styles.tag}>
                  <FiBriefcase size={12} /> {user.position}
                </div>
              )}
              {user.department && (
                <div className={styles.tag}>
                  <FiHome size={12} /> {user.department}
                </div>
              )}
              {user.office && (
                <div className={styles.tag}>
                  <FiMapPin size={12} /> {user.office}
                </div>
              )}
            </div>
          </label>
        ))}
        {filteredUsers.length === 0 && (
          <p className={styles.empty}>No users found.</p>
        )}
      </div>

      {/* Actions */}
      <div className={styles.actions}>
        <button type="button" onClick={onClose} className={styles.cancelBtn}>
          Cancel
        </button>
        <button type="button" onClick={handleSave} className={styles.saveBtn}>
          Save ({tempSelected.length})
        </button>
      </div>
    </Modal>
  );
}
