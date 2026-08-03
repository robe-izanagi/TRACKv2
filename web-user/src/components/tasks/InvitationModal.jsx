import { useEffect, useState } from "react";
import Modal from "../common/Modal";
import styles from "./InvitationModal.module.css";

const sampleCollaborators = [
  {
    id: 1,
    name: "Alicia Dela Cruz",
    email: "alicia@example.com",
    role: "Department Head",
    department: "Computer Science",
  },
  {
    id: 2,
    name: "Miguel Santos",
    email: "miguel@example.com",
    role: "Faculty",
    department: "Mathematics",
  },
  {
    id: 3,
    name: "Rina Gomez",
    email: "rina@example.com",
    role: "Staff",
    department: "Office of Student Affairs",
  },
  {
    id: 4,
    name: "Jude Lim",
    email: "jude@example.com",
    role: "Coordinator",
    department: "Research",
  },
];

const sampleAssignees = [
  {
    id: 10,
    name: "Carla Reyes",
    email: "carla@example.com",
    role: "Assistant Professor",
    department: "English",
  },
  {
    id: 11,
    name: "Noah Cruz",
    email: "noah@example.com",
    role: "Staff",
    department: "HR",
  },
  {
    id: 12,
    name: "Mina Torres",
    email: "mina@example.com",
    role: "Coordinator",
    department: "Admin",
  },
  {
    id: 13,
    name: "Ethan Brooks",
    email: "ethan@example.com",
    role: "Professor",
    department: "Engineering",
  },
];

export default function InvitationModal({
  isOpen,
  onClose,
  selectedIds = [],
  onSave,
  title = "Add People",
  type = "collaborators",
}) {
  const [search, setSearch] = useState("");
  const [tempSelected, setTempSelected] = useState([]);
  const [users, setUsers] = useState([]);

  useEffect(() => {
    if (!isOpen) return;

    setSearch("");
    setTempSelected([...selectedIds]);

    // Replace this with your real API call later.
    const sampleData = type === "assignees" ? sampleAssignees : sampleCollaborators;
    setUsers(sampleData);
  }, [isOpen, selectedIds, type]);

  const filteredUsers = users.filter((user) => {
    const term = search.toLowerCase();
    return (
      !term ||
      user.name?.toLowerCase().includes(term) ||
      user.email?.toLowerCase().includes(term) ||
      user.department?.toLowerCase().includes(term)
    );
  });

  const toggleUser = (userId) => {
    setTempSelected((prev) =>
      prev.includes(userId) ? prev.filter((id) => id !== userId) : [...prev, userId],
    );
  };

  const handleSave = () => {
    onSave(tempSelected);
    onClose();
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={title}>
      <div className={styles.wrapper}>
        <div className={styles.searchBar}>
          <input
            type="text"
            placeholder="Search people..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>

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
                  <div className={styles.userInfo}>
                    <div className={styles.name}>{user.name}</div>
                    <div className={styles.email}>{user.email}</div>
                  </div>
                  <div className={styles.meta}>
                    <span className={styles.badge}>{user.role}</span>
                    <span className={styles.department}>{user.department}</span>
                  </div>
                </label>
              );
            })
          ) : (
            <p className={styles.empty}>No people found.</p>
          )}
        </div>

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
