import { useEffect, useState } from 'react';
import { getDepartments, createDepartment, toggleDepartment, getOffices, createOffice, toggleOffice } from '../api/admin';
import styles from './Declaration.module.css';

export default function Declaration() {
  const [tab, setTab] = useState('departments'); // 'departments' | 'offices'
  const [departments, setDepartments] = useState([]);
  const [offices, setOffices] = useState([]);
  const [newName, setNewName] = useState('');
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const [deptRes, officeRes] = await Promise.all([getDepartments(), getOffices()]);
      setDepartments(deptRes.items || []);
      setOffices(officeRes.items || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { load(); }, []);

  const addItem = async () => {
    if (!newName.trim()) return;
    try {
      if (tab === 'departments') {
        await createDepartment(newName.trim());
      } else {
        await createOffice(newName.trim());
      }
      setNewName('');
      load();
      setMessage('Added successfully.');
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to add.');
    }
  };

  const toggleItem = async (id, currentActive) => {
    try {
      if (tab === 'departments') {
        await toggleDepartment(id, !currentActive);
      } else {
        await toggleOffice(id, !currentActive);
      }
      load();
    } catch (err) {
      setMessage('Failed to toggle status.');
    }
  };

  const list = tab === 'departments' ? departments : offices;

  return (
    <div>
      <h1>Declaration</h1>
      <div className={styles.tabs}>
        <button className={tab === 'departments' ? styles.activeTab : ''} onClick={() => setTab('departments')}>Departments</button>
        <button className={tab === 'offices' ? styles.activeTab : ''} onClick={() => setTab('offices')}>Offices</button>
      </div>

      <div className={styles.card}>
        <div className={styles.addForm}>
          <input
            type="text"
            placeholder={`New ${tab.slice(0, -1)} name`}
            value={newName}
            onChange={e => setNewName(e.target.value)}
            className={styles.input}
          />
          <button onClick={addItem} className={styles.btn}>Add</button>
        </div>
        {message && <p className={styles.msg}>{message}</p>}

        <table className={styles.table}>
          <thead>
            <tr><th>Name</th><th>Status</th><th>Action</th></tr>
          </thead>
          <tbody>
            {list.map(item => (
              <tr key={item.id}>
                <td>{item.name}</td>
                <td>{item.is_active ? 'Active' : 'Inactive'}</td>
                <td>
                  <button onClick={() => toggleItem(item.id, item.is_active)}>
                    {item.is_active ? 'Deactivate' : 'Activate'}
                  </button>
                </td>
              </tr>
            ))}
            {list.length === 0 && <tr><td colSpan="3">No items found.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}