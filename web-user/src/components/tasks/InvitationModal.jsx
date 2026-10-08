import { useState, useEffect } from "react";
import Modal from "../common/Modal";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import {
  FiSearch,
  FiUser,
  FiBriefcase,
  FiMapPin,
  FiHome,
} from "react-icons/fi";
import styles from "./InvitationModal.module.css";

export default function InvitationModal({
  isOpen,
  onClose,
  selectedIds = [],
  onSave,
  title = "Add People",
  type = "collaborators", // 'assignees' or 'collaborators'
}) {
  const { user: currentUser } = useAuth();

  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState("");
  const [tempSelected, setTempSelected] = useState([...selectedIds]);
  const [sortBy, setSortBy] = useState("name");
  const [filterType, setFilterType] = useState("all");
  const [filterValue, setFilterValue] = useState("");
  const [selectAllChecked, setSelectAllChecked] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [offices, setOffices] = useState([]);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  // ─── Fetch data when modal opens ──────────────────────
  useEffect(() => {
    if (!isOpen) return;

    const fetchData = async () => {
      setLoading(true);
      setError("");
      try {
        const [usersRes, deptRes, officeRes] = await Promise.all([
          apiClient.get("/auth/users?exclude_admins=true"),
          apiClient.get("/lookups/departments"),
          apiClient.get("/lookups/offices"),
        ]);

        const allUsers = usersRes.data.users || [];
        // Filter out the current user
        const filteredUsers = allUsers.filter((u) => u.id !== currentUser?.id);

        setUsers(filteredUsers);
        setDepartments(deptRes.data.items || []);
        setOffices(officeRes.data.items || []);
        setTempSelected([...selectedIds]);
        setSearch("");
        setFilterType("all");
        setFilterValue("");
        setSortBy("name");
      } catch (err) {
        console.error("Failed to load data", err);
        setError(err.response?.data?.message || err.message || "We could not load the people you can invite. Check your connection and try again.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [isOpen, selectedIds, currentUser?.id]);

  // ─── Filter & sort ─────────────────────────────────────
  const filteredUsers = users
    .filter((u) => {
      if (search) {
        const term = search.toLowerCase();
        const name = (u.name || "").toLowerCase();
        const email = (u.email || "").toLowerCase();
        if (!name.includes(term) && !email.includes(term)) return false;
      }
      if (filterType === "department" && filterValue) {
        return u.department === filterValue;
      }
      if (filterType === "office" && filterValue) {
        return u.office === filterValue;
      }
      return true;
    })
    .sort((a, b) => {
      const valA = (a[sortBy] || "").toLowerCase();
      const valB = (b[sortBy] || "").toLowerCase();
      return valA.localeCompare(valB);
    });

  // ─── Select‑all logic ──────────────────────────────────
  useEffect(() => {
    if (filteredUsers.length === 0) {
      setSelectAllChecked(false);
      return;
    }
    const allSelected = filteredUsers.every((u) => tempSelected.includes(u.id));
    setSelectAllChecked(allSelected);
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
      const visibleIds = new Set(filteredUsers.map((u) => u.id));
      setTempSelected((prev) => prev.filter((id) => !visibleIds.has(id)));
    } else {
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
    setFilterValue("");
  };

  const handleFilterValueChange = (e) => {
    setFilterValue(e.target.value);
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className={styles.wrapper}>
        <div className={styles.controls}>
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
                      <option key={d.id} value={d.name}>
                        {d.name}
                      </option>
                    ))}
                  {filterType === "office" &&
                    offices.map((o) => (
                      <option key={o.id} value={o.name}>
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
        </div>

        {loading && <p className={styles.loading}>Loading users...</p>}
        {error && <p className={styles.error}>{error}</p>}

        {!loading && !error && (
          <div className={styles.list}>
            {filteredUsers.length > 0 ? (
              filteredUsers.map((user) => {
                const checked = tempSelected.includes(user.id);
                return (
                  <label key={user.id} className={styles.userCard}>
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={() => toggleUser(user.id)}
                      className={styles.checkbox}
                    />
                    <div className={styles.userLeft}>
                      <div className={styles.avatarPlaceholder}>
                        <FiUser size={24} />
                      </div>
                      <div className={styles.userInfo}>
                        <div className={styles.userName}>
                          {user.name || "Unknown"}
                        </div>
                        <div className={styles.userEmail}>{user.email}</div>
                      </div>
                    </div>
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
                );
              })
            ) : (
              <p className={styles.empty}>No users found.</p>
            )}
          </div>
        )}

        <div className={styles.actions}>
          <button type="button" className={styles.cancelBtn} onClick={onClose}>
            Cancel
          </button>
          <button type="button" className={styles.saveBtn} onClick={handleSave}>
            Save ({tempSelected.length})
          </button>
        </div>
      </div>
    </Modal>
  );
}
