import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import InputField from "../../../components/common/InputField";
import Button from "../../../components/common/Button";
import SelectDropdown from "../../../components/common/SelectDropdown";
import RadioGroup from "../../../components/common/RadioGroup";
import EventColor from "../../../components/events/EventColor";
import InviteAttendeesModal from "../../../components/events/InviteAttendeesModal";
import MapPicker from "../../../components/common/MapPicker";
import apiClient from "../../../api/client";
import { useAuth } from "../../../context/AuthContext";
import styles from "./CreateEvent.module.css";

export default function CreateEvent() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const role = user?.role || "faculty";
  const hasDepartment = !!user?.department;

  const initialVisibility =
    role === "staff" || role === "faculty" ? "private" : "private";

  const [form, setForm] = useState({
    title: "",
    color: "#800000",
    visibility: initialVisibility,
    method: "face-to-face",
    link: "",
    hierarchy: "local",
    department_id: "",
    description: "",
    start_date: "",
    end_date: "",
    start_time: "",
    end_time: "",
    venue_id: "",
    location_id: "",
    exact_location: "",
    street: "",
    map_location: "",
    remind_before_minutes: "",
    is_email_reminder: false,
  });

  const [attendeeIds, setAttendeeIds] = useState([]);
  const [collaboratorIds, setCollaboratorIds] = useState([]);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);

  const [departments, setDepartments] = useState([]);
  const [venues, setVenues] = useState([]);
  const [locations, setLocations] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptRes, venueRes, locRes] = await Promise.all([
          apiClient.get("/lookups/departments"),
          apiClient.get("/venues"),
          apiClient.get("/events/locations"),
        ]);
        setDepartments(deptRes.data.items || []);
        setVenues(venueRes.data.venues || []);
        setLocations(locRes.data.locations || []);
      } catch (err) {
        console.error("Failed to load form data", err);
      }
    };
    fetchData();
  }, []);

  const updateField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  useEffect(() => {
    if (form.visibility === "department" && form.department_id) {
      apiClient
        .get(`/auth/users?department_id=${form.department_id}`)
        .then((res) => {
          const ids = (res.data.users || []).map((u) => u.id);
          setAttendeeIds(ids);
        })
        .catch(console.error);
    }
  }, [form.department_id, form.visibility]);

  useEffect(() => {
    if (form.location_id) {
      updateField("map_location", "");
      updateField("exact_location", "");
      updateField("street", "");
    }
  }, [form.location_id]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");

    const payload = {
      title: form.title,
      color: form.color,
      visibility: form.visibility,
      method: form.method,
      link: form.method === "online" ? form.link : undefined,
      hierarchy: form.hierarchy,
      start_datetime: `${form.start_date}T${form.start_time}:00`,
      end_datetime: `${form.end_date}T${form.end_time}:00`,
      department_id:
        form.visibility === "department" ? form.department_id : undefined,
      description: form.description,
      venue_id:
        form.method !== "online" && form.hierarchy === "local"
          ? form.venue_id || "undecided"
          : undefined,
      location_id:
        form.method !== "online" && form.hierarchy !== "local"
          ? form.location_id || undefined
          : undefined,
      exact_location:
        form.method !== "online" &&
        form.hierarchy !== "local" &&
        !form.location_id
          ? form.exact_location || ""
          : undefined,
      street:
        form.method !== "online" &&
        form.hierarchy !== "local" &&
        !form.location_id
          ? form.street || ""
          : undefined,
      map_location:
        form.method !== "online" &&
        form.hierarchy !== "local" &&
        !form.location_id
          ? form.map_location
          : undefined,
      attendee_ids: attendeeIds,
      collaborator_ids: collaboratorIds,
      remind_before_minutes: form.remind_before_minutes || null,
      is_email_reminder: form.is_email_reminder,
    };

    try {
      const res = await apiClient.post("/events", payload);
      if (res.data.ok) {
        navigate("/calendar");
      } else {
        setMessage(res.data.message || "Failed to create event");
      }
    } catch (err) {
      setMessage(err.response?.data?.message || "Server error");
    } finally {
      setLoading(false);
    }
  };

  const visibilityOptions = [];
  if (role === "officials") {
    visibilityOptions.push({ value: "private", label: "Private" });
    if (hasDepartment) {
      visibilityOptions.push({ value: "department", label: "Department" });
    }
    visibilityOptions.push({ value: "campus", label: "Campus" });
  } else {
    visibilityOptions.push({ value: "private", label: "Private" });
  }

  const showVisibilityRadio = visibilityOptions.length > 1;

  return (
    <div className={styles.pageWrapper}>
      <form onSubmit={handleSubmit} className={styles.form}>
        {/* Title */}
        <div className={styles.titleSection}>
          <InputField
            className={styles.titleInput}
            value={form.title}
            placeholder="Enter title for your event.."
            onChange={(e) => updateField("title", e.target.value)}
          />
        </div>

        <div className={styles.sectionContent}>
          {/* Color & Visibility */}
          <div className={styles.section}>
            <EventColor
              value={form.color}
              onChange={(color) => updateField("color", color)}
            />
            <div className={styles.stackRow}>
              {showVisibilityRadio ? (
                <RadioGroup
                  name="visibility"
                  label="VISIBILITY OF EVENT"
                  options={visibilityOptions}
                  value={form.visibility}
                  onChange={(e) => updateField("visibility", e.target.value)}
                />
              ) : (
                <div className={styles.staticVisibility}>
                  <span className={styles.label}>VISIBILITY: Private</span>
                </div>
              )}
              <RadioGroup
                name="method"
                label="METHOD"
                options={[
                  { value: "face-to-face", label: "Face to Face" },
                  { value: "online", label: "Online" },
                ]}
                value={form.method}
                onChange={(e) => updateField("method", e.target.value)}
              />
            </div>
            {form.method === "online" && (
              <InputField
                label="EVENT LINK"
                value={form.link}
                onChange={(e) => updateField("link", e.target.value)}
              />
            )}
          </div>

          {/* Hierarchy & Department */}
          <div className={styles.section}>
            <SelectDropdown
              label="HIERARCHY LEVEL"
              options={[
                { value: "local", label: "Local" },
                { value: "regional", label: "Regional" },
                { value: "national", label: "National" },
                { value: "international", label: "International" },
              ]}
              value={form.hierarchy}
              onChange={(e) => updateField("hierarchy", e.target.value)}
            />
            {form.visibility === "department" && (
              <SelectDropdown
                label="DEPARTMENT"
                options={departments.map((d) => ({
                  value: d.id,
                  label: d.name,
                }))}
                value={form.department_id}
                onChange={(e) => updateField("department_id", e.target.value)}
              />
            )}
          </div>

          {/* Venue / Location – hidden when method is online */}
          {form.method !== "online" && (
            <div className={styles.section}>
              {form.hierarchy === "local" ? (
                <SelectDropdown
                  label="VENUE"
                  options={[
                    { value: "", label: "-- Select Venue --" },
                    ...venues.map((v) => ({ value: v.id, label: v.name })),
                  ]}
                  value={form.venue_id}
                  onChange={(e) => updateField("venue_id", e.target.value)}
                />
              ) : (
                <>
                  <SelectDropdown
                    label="USE SAVED LOCATION"
                    options={[
                      { value: "", label: "-- New Location --" },
                      ...locations.map((l) => ({
                        value: l.id,
                        label: `${l.exact_location}, ${l.map_location}`,
                      })),
                    ]}
                    value={form.location_id}
                    onChange={(e) => updateField("location_id", e.target.value)}
                  />
                  {!form.location_id && (
                    <div className={styles.mapContainer}>
                      <label className={styles.sectionLabel}>
                        MAP LOCATION
                      </label>
                      <MapPicker
                        currentMapLocation={form.map_location}
                        onLocationSelect={(loc) => {
                          updateField("map_location", loc.map_location);
                          updateField("exact_location", "");
                          updateField("street", "");
                        }}
                      />
                      <span className={styles.hint}>
                        Click on the map or search for a location
                      </span>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Schedule & Reminder */}
          <div className={styles.section}>
            <div className={styles.row}>
              <InputField
                label="START DATE"
                type="date"
                value={form.start_date}
                onChange={(e) => updateField("start_date", e.target.value)}
              />
              <InputField
                label="END DATE"
                type="date"
                value={form.end_date}
                onChange={(e) => updateField("end_date", e.target.value)}
              />
            </div>
            <div className={styles.row}>
              <InputField
                label="START TIME"
                type="time"
                value={form.start_time}
                onChange={(e) => updateField("start_time", e.target.value)}
              />
              <InputField
                label="END TIME"
                type="time"
                value={form.end_time}
                onChange={(e) => updateField("end_time", e.target.value)}
              />
            </div>
            <div className={styles.stackRow}>
              <SelectDropdown
                label="REMINDER"
                options={[
                  { value: "", label: "None" },
                  { value: "5", label: "5 min before" },
                  { value: "10", label: "10 min before" },
                  { value: "15", label: "15 min before" },
                  { value: "30", label: "30 min before" },
                  { value: "60", label: "1 hour before" },
                  { value: "1440", label: "1 day before" },
                ]}
                value={form.remind_before_minutes}
                onChange={(e) =>
                  updateField("remind_before_minutes", e.target.value)
                }
              />
              <div className={styles.checkRow}>
                <label>
                  <input
                    type="checkbox"
                    checked={form.is_email_reminder}
                    onChange={(e) =>
                      updateField("is_email_reminder", e.target.checked)
                    }
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
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Add details about your event, agenda, or guest list..."
            />
          </div>

          {/* Attendees & Collaborators */}
          <div className={styles.section}>
            <button
              type="button"
              className={styles.inviteBtn}
              onClick={() => setShowAttendeeModal(true)}
            >
              👥 Invite Attendees ({attendeeIds.length})
            </button>
            <button
              type="button"
              className={styles.inviteBtn}
              onClick={() => setShowCollabModal(true)}
            >
              ✏️ Add Collaborators ({collaboratorIds.length})
            </button>
          </div>

          {/* Submit */}
          <div className={styles.section}>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Event"}
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
          departmentId={
            form.visibility === "department" ? form.department_id : null
          }
        />
        <InviteAttendeesModal
          isOpen={showCollabModal}
          onClose={() => setShowCollabModal(false)}
          selectedIds={collaboratorIds}
          onSave={setCollaboratorIds}
          departmentId={null}
        />
      </form>
    </div>
  );
}
