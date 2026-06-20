import { useState, useEffect } from 'react';
import Modal from '../../components/common/Modal';
import apiClient from '../../api/client';
import { FiSearch, FiX } from 'react-icons/fi';
import styles from './InviteAttendeesModal.module.css';

export default function InviteAttendeesModal({
  isOpen,
  onClose,
  selectedIds,
  onSave,
  departmentId = null
}) {
  const [users, setUsers] = useState([]);
  const [search, setSearch] = useState('');
  const [tempSelected, setTempSelected] = useState([...selectedIds]);

  useEffect(() => {
    const fetchUsers = async () => {
      try {
        const params = {};
        if (departmentId) params.department_id = departmentId;
        const { data } = await apiClient.get('/auth/users', { params });  // we'll create this endpoint later
        setUsers(data.users || []);
      } catch (err) {
        console.error('Failed to load users', err);
      }
    };
    if (isOpen) {
      setTempSelected([...selectedIds]);
      fetchUsers();
    }
  }, [isOpen, departmentId, selectedIds]);

  const toggleUser = (userId) => {
    setTempSelected(prev =>
      prev.includes(userId) ? prev.filter(id => id !== userId) : [...prev, userId]
    );
  };

  const handleSave = () => {
    onSave(tempSelected);
    onClose();
  };

  const filtered = users.filter(u =>
    u.email?.toLowerCase().includes(search.toLowerCase()) ||
    u.name?.toLowerCase().includes(search.toLowerCase())
  );

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Invite Attendees">
      <div className={styles.searchBar}>
        <FiSearch size={16} />
        <input
          type="text"
          placeholder="Search users..."
          value={search}
          onChange={e => setSearch(e.target.value)}
          className={styles.searchInput}
        />
      </div>

      <div className={styles.list}>
        {filtered.map(user => (
          <label key={user.id} className={styles.userRow}>
            <input
              type="checkbox"
              checked={tempSelected.includes(user.id)}
              onChange={() => toggleUser(user.id)}
            />
            <div>
              <div className={styles.userName}>{user.name || user.email}</div>
              {user.department && <div className={styles.userDept}>{user.department}</div>}
            </div>
          </label>
        ))}
        {filtered.length === 0 && (
          <p className={styles.empty}>No users found.</p>
        )}
      </div>

      <div className={styles.actions}>
        <button onClick={onClose} className={styles.cancelBtn}>Cancel</button>
        <button onClick={handleSave} className={styles.saveBtn}>
          Save ({tempSelected.length})
        </button>
      </div>
    </Modal>
  );
}