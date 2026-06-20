import { useState, useEffect } from 'react';
import { useAuth } from '../../../context/AuthContext';
import { getVenues, createVenue, updateVenue, archiveVenue } from '../../../api/venues';
import { FiPlus, FiEdit, FiTrash2, FiSearch, FiMapPin } from 'react-icons/fi';
import Modal from '../../../components/common/Modal';
import styles from './VenuesList.module.css';

export default function VenuesList() {
  const { user } = useAuth();
  const isStaff = user?.role === 'staff';

  const [venues, setVenues] = useState([]);
  const [search, setSearch] = useState('');
  const [modalOpen, setModalOpen] = useState(false);
  const [editingVenue, setEditingVenue] = useState(null);
  const [form, setForm] = useState({
    name: '',
    code: '',
    building_location: '',
    type: ''
  });
  const [message, setMessage] = useState('');

  const load = async () => {
    try {
      const data = await getVenues();
      setVenues(data.venues || []);
    } catch (err) {
      console.error(err);
    }
  };

  useEffect(() => { load(); }, []);

  const filtered = venues.filter(v =>
    v.name.toLowerCase().includes(search.toLowerCase()) ||
    v.code.toLowerCase().includes(search.toLowerCase())
  );

  const openAdd = () => {
    setEditingVenue(null);
    setForm({ name: '', code: '', building_location: '', type: '' });
    setMessage('');
    setModalOpen(true);
  };

  const openEdit = (venue) => {
    setEditingVenue(venue);
    setForm({
      name: venue.name,
      code: venue.code,
      building_location: venue.building_location || '',
      type: venue.type || ''
    });
    setMessage('');
    setModalOpen(true);
  };

  const handleSave = async (e) => {
    e.preventDefault();
    setMessage('');
    try {
      if (editingVenue) {
        await updateVenue(editingVenue.id, form);
      } else {
        await createVenue(form);
      }
      setModalOpen(false);
      load();
    } catch (err) {
      setMessage(err.response?.data?.message || 'Failed to save venue.');
    }
  };

  const handleArchive = async (id) => {
    if (!window.confirm('Archive this venue? It will no longer appear in the list.')) return;
    try {
      await archiveVenue(id);
      load();
    } catch (err) {
      setMessage('Failed to archive venue.');
    }
  };

  return (
    <div className={styles.container}>
      <h1 className={styles.pageTitle}>Venues</h1>

      {/* Search & Add */}
      <div className={styles.toolbar}>
        <div className={styles.searchRow}>
          <FiSearch size={18} className={styles.searchIcon} />
          <input
            type="text"
            placeholder="Search venues..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className={styles.searchInput}
          />
        </div>
        {isStaff && (
          <button className={styles.addBtn} onClick={openAdd}>
            <FiPlus size={18} /> Add
          </button>
        )}
      </div>

      {/* Venue Cards */}
      {filtered.length === 0 && (
        <p className={styles.emptyMessage}>No venues found.</p>
      )}

      {filtered.map(venue => (
        <div key={venue.id} className={styles.card}>
          <div className={styles.cardLeft}>
            <div className={styles.venueName}>
              <FiMapPin size={16} /> {venue.name}
            </div>
            <div className={styles.venueCode}>Code: {venue.code}</div>
            {venue.building_location && (
              <div className={styles.venueDetail}>📌 {venue.building_location}</div>
            )}
            {venue.type && (
              <div className={styles.venueTypeBadge}>{venue.type}</div>
            )}
          </div>
          {isStaff && (
            <div className={styles.actions}>
              <button
                className={styles.actionBtn}
                onClick={() => openEdit(venue)}
                title="Edit"
              >
                <FiEdit size={16} />
              </button>
              <button
                className={styles.actionBtn}
                onClick={() => handleArchive(venue.id)}
                title="Archive"
              >
                <FiTrash2 size={16} />
              </button>
            </div>
          )}
        </div>
      ))}

      {/* Add / Edit Modal */}
      <Modal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        title={editingVenue ? 'Edit Venue' : 'Add Venue'}
      >
        <form onSubmit={handleSave} className={styles.form}>
          <label className={styles.field}>
            <span className={styles.label}>Name *</span>
            <input
              className={styles.input}
              placeholder="e.g. Main Auditorium"
              value={form.name}
              onChange={e => setForm({ ...form, name: e.target.value })}
              required
            />
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Code *</span>
            <input
              className={styles.input}
              placeholder="e.g. AUD-01 (unique identifier)"
              value={form.code}
              onChange={e => setForm({ ...form, code: e.target.value.toUpperCase().replace(/\s/g, '-') })}
              required
            />
            <span className={styles.hint}>Short unique code for this venue.</span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Building / Location</span>
            <input
              className={styles.input}
              placeholder="e.g. Main Building, 2nd Floor"
              value={form.building_location}
              onChange={e => setForm({ ...form, building_location: e.target.value })}
            />
            <span className={styles.hint}>Optional – helps attendees find it.</span>
          </label>

          <label className={styles.field}>
            <span className={styles.label}>Type</span>
            <input
              className={styles.input}
              placeholder="e.g. Auditorium, Classroom, Gymnasium"
              value={form.type}
              onChange={e => setForm({ ...form, type: e.target.value })}
            />
            <span className={styles.hint}>Optional – room category.</span>
          </label>

          {message && <p className={styles.error}>{message}</p>}

          <button type="submit" className={styles.submitBtn}>
            {editingVenue ? 'Update Venue' : 'Create Venue'}
          </button>
        </form>
      </Modal>
    </div>
  );
}