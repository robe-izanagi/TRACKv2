import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import InputField from '../../../components/common/InputField';
import Button from '../../../components/common/Button';
import SelectDropdown from '../../../components/common/SelectDropdown';
import RadioGroup from '../../../components/common/RadioGroup';
import EventColor from '../../../components/events/EventColor';
import InviteAttendeesModal from '../../../components/events/InviteAttendeesModal';
import apiClient from '../../../api/client';
import { useAuth } from '../../../context/AuthContext';
import styles from './CreateEvent.module.css';

export default function CreateEvent() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [form, setForm] = useState({
    title: '',
    color: '#800000',
    visibility: 'private',
    method: 'face-to-face',
    link: '',
    hierarchy: 'local',
    department_id: '',
    description: '',
    start_date: '',
    end_date: '',
    start_time: '',
    end_time: '',
    venue_id: '',
    location_id: '',
    exact_location: '',
    street: '',
    map_location: '',
    remind_before_minutes: '',
    is_email_reminder: false,
  });

  const [attendeeIds, setAttendeeIds] = useState([]);
  const [collaboratorIds, setCollaboratorIds] = useState([]);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);

  // Dropdown data
  const [departments, setDepartments] = useState([]);
  const [venues, setVenues] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptRes, venueRes, locRes] = await Promise.all([
          apiClient.get('/lookups/departments'),
          apiClient.get('/venues'),
          apiClient.get('/events/locations')
        ]);
        setDepartments(deptRes.data.items || []);
        setVenues(venueRes.data.venues || []);
        setLocations(locRes.data.locations || []);
      } catch (err) {
        console.error('Failed to load form data', err);
      }
    };
    fetchData();
  }, []);

  const updateField = (field, value) =>
    setForm(prev => ({ ...prev, [field]: value }));

  // Auto‑invite department members when department_id changes
  useEffect(() => {
    if (form.visibility === 'department' && form.department_id) {
      apiClient.get(`/auth/users?department_id=${form.department_id}`)
        .then(res => {
          const ids = (res.data.users || []).map(u => u.id);
          setAttendeeIds(ids);
        })
        .catch(console.error);
    }
  }, [form.department_id, form.visibility]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage('');

    const payload = {
      title: form.title,
      color: form.color,
      visibility: form.visibility,
      method: form.method,
      link: form.method === 'online' ? form.link : undefined,
      hierarchy: form.hierarchy,
      start_datetime: `${form.start_date}T${form.start_time}:00`,
      end_datetime: `${form.end_date}T${form.end_time}:00`,
      department_id: form.visibility === 'department' ? form.department_id : undefined,
      description: form.description,
      venue_id: form.hierarchy === 'local' ? (form.venue_id || 'undecided') : undefined,
      location_id: form.hierarchy !== 'local' && !form.exact_location ? form.location_id : undefined,
      exact_location: form.hierarchy !== 'local' ? form.exact_location : undefined,
      street: form.hierarchy !== 'local' ? form.street : undefined,
      map_location: form.hierarchy !== 'local' ? form.map_location : undefined,
      attendee_ids: attendeeIds,
      collaborator_ids: collaboratorIds,
      remind_before_minutes: form.remind_before_minutes || null,
      is_email_reminder: form.is_email_reminder,
    };

    try {
      const res = await apiClient.post('/events', payload);
      if (res.data.ok) {
        navigate('/calendar');
      } else {
        setMessage(res.data.message || 'Failed to create event');
      }
    } catch (err) {
      setMessage(err.response?.data?.message || 'Server error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className={styles.form}>
      {/* Title */}
      <div className={styles.titleSection}>
        <InputField
          className={styles.titleInput}
          value={form.title}
          placeholder="Enter title for your event.."
          onChange={(e) => updateField('title', e.target.value)}
        />
      </div>

      <div className={styles.sectionContent}>
        {/* Color & Visibility */}
        <div className={styles.section}>
          <EventColor
            value={form.color}
            onChange={(color) => updateField('color', color)}
          />
          <div className={styles.row}>
            <RadioGroup
              name="visibility"
              label="VISIBILITY OF EVENT"
              options={[
                { value: 'private', label: 'Private' },
                { value: 'department', label: 'Department' },
                { value: 'campus', label: 'Campus' },
              ]}
              value={form.visibility}
              onChange={(e) => updateField('visibility', e.target.value)}
            />
            <RadioGroup
              name="method"
              label="METHOD"
              options={[
                { value: 'face-to-face', label: 'Face to Face' },
                { value: 'online', label: 'Online' },
              ]}
              value={form.method}
              onChange={(e) => updateField('method', e.target.value)}
            />
          </div>
          {form.method === 'online' && (
            <InputField
              label="EVENT LINK"
              value={form.link}
              onChange={(e) => updateField('link', e.target.value)}
            />
          )}
        </div>

        {/* Hierarchy & Department (if department event) */}
        <div className={styles.section}>
          <SelectDropdown
            label="HIERARCHY LEVEL"
            options={[
              { value: 'local', label: 'Local' },
              { value: 'regional', label: 'Regional' },
              { value: 'national', label: 'National' },
              { value: 'international', label: 'International' },
            ]}
            value={form.hierarchy}
            onChange={(e) => updateField('hierarchy', e.target.value)}
          />
          {form.visibility === 'department' && (
            <SelectDropdown
              label="DEPARTMENT"
              options={departments.map(d => ({ value: d.id, label: d.name }))}
              value={form.department_id}
              onChange={(e) => updateField('department_id', e.target.value)}
            />
          )}
        </div>

        {/* Venue / Location */}
        <div className={styles.section}>
          {form.hierarchy === 'local' ? (
            <SelectDropdown
              label="VENUE"
              options={[
                { value: '', label: '-- Select Venue --' },
                ...venues.map(v => ({ value: v.id, label: v.name }))
              ]}
              value={form.venue_id}
              onChange={(e) => updateField('venue_id', e.target.value)}
            />
          ) : (
            <>
              <SelectDropdown
                label="USE SAVED LOCATION"
                options={[
                  { value: '', label: '-- New Location --' },
                  ...locations.map(l => ({ value: l.id, label: `${l.exact_location}, ${l.map_location}` }))
                ]}
                value={form.location_id}
                onChange={(e) => updateField('location_id', e.target.value)}
              />
              {!form.location_id && (
                <>
                  <InputField
                    label="EXACT LOCATION"
                    placeholder="e.g. Building 1, 2nd Floor, Room 201"
                    value={form.exact_location}
                    onChange={(e) => updateField('exact_location', e.target.value)}
                  />
                  <InputField
                    label="STREET / PUROK"
                    placeholder="e.g. Purok 4B"
                    value={form.street}
                    onChange={(e) => updateField('street', e.target.value)}
                  />
                  <InputField
                    label="MAP LOCATION"
                    placeholder="e.g. San Miguel, Sto. Tomas, Batangas"
                    value={form.map_location}
                    onChange={(e) => updateField('map_location', e.target.value)}
                  />
                </>
              )}
            </>
          )}
        </div>

        {/* Schedule & Reminder */}
        <div className={styles.section}>
          <div className={styles.row}>
            <InputField
              label="START DATE"
              type="date"
              value={form.start_date}
              onChange={(e) => updateField('start_date', e.target.value)}
            />
            <InputField
              label="END DATE"
              type="date"
              value={form.end_date}
              onChange={(e) => updateField('end_date', e.target.value)}
            />
          </div>
          <div className={styles.row}>
            <InputField
              label="START TIME"
              type="time"
              value={form.start_time}
              onChange={(e) => updateField('start_time', e.target.value)}
            />
            <InputField
              label="END TIME"
              type="time"
              value={form.end_time}
              onChange={(e) => updateField('end_time', e.target.value)}
            />
          </div>
          <div className={styles.row}>
            <SelectDropdown
              label="REMINDER"
              options={[
                { value: '', label: 'None' },
                { value: '5', label: '5 min before' },
                { value: '10', label: '10 min before' },
                { value: '15', label: '15 min before' },
                { value: '30', label: '30 min before' },
                { value: '60', label: '1 hour before' },
                { value: '1440', label: '1 day before' },
              ]}
              value={form.remind_before_minutes}
              onChange={(e) => updateField('remind_before_minutes', e.target.value)}
            />
            <div className={styles.checkRow}>
              <label>
                <input
                  type="checkbox"
                  checked={form.is_email_reminder}
                  onChange={(e) => updateField('is_email_reminder', e.target.checked)}
                />
                Email Reminder
              </label>
            </div>
          </div>
        </div>

        {/* Description */}
        <div className={styles.section}>
          <InputField
            label="DESCRIPTION"
            as="textarea"
            rows={3}
            value={form.description}
            onChange={(e) => updateField('description', e.target.value)}
            placeholder="Add details about your event, agenda, or guest list..."
          />
        </div>

        {/* Attendees & Collaborators */}
        <div className={styles.section}>
          <div className={styles.row}>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowAttendeeModal(true)}
            >
              Invite Attendees ({attendeeIds.length})
            </Button>
            <Button
              type="button"
              variant="secondary"
              onClick={() => setShowCollabModal(true)}
            >
              Add Collaborators ({collaboratorIds.length})
            </Button>
          </div>
        </div>

        {/* Submit */}
        <div className={styles.section}>
          <Button type="submit" disabled={loading}>
            {loading ? 'Creating...' : 'Create Event'}
          </Button>
          {message && <p className={styles.error}>{message}</p>}
        </div>
      </div>

      {/* Modals */}
      <InviteAttendeesModal
        isOpen={showAttendeeModal}
        onClose={() => setShowAttendeeModal(false)}
        selectedIds={attendeeIds}
        onSave={setAttendeeIds}
        departmentId={form.visibility === 'department' ? form.department_id : null}
      />
      {/* Collaborators modal (similar but uses different state) – reuse same modal with a title */}
      <InviteAttendeesModal
        isOpen={showCollabModal}
        onClose={() => setShowCollabModal(false)}
        selectedIds={collaboratorIds}
        onSave={setCollaboratorIds}
        departmentId={null}
      />
    </form>
  );
}