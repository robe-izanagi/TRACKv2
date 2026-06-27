import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import InputField from "../../../components/common/InputField";
import Button from "../../../components/common/Button";
import SelectDropdown from "../../../components/common/SelectDropdown";
import RadioGroup from "../../../components/common/RadioGroup";
import EventColor from "../../../components/events/EventColor";
import InviteAttendeesModal from "../../../components/events/InviteAttendeesModal";
import MapPicker from "../../../components/common/MapPicker";
import FileAttachment from "../../../components/common/FileAttachment";
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
    event_type: "event", // ← new field
  });

  const [attendeeIds, setAttendeeIds] = useState([]);
  const [collaboratorIds, setCollaboratorIds] = useState([]);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [attachments, setAttachments] = useState([]);

  const [departments, setDepartments] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const fileInputRef = useRef(null);

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptRes, venueRes] = await Promise.all([
          apiClient.get("/lookups/departments"),
          apiClient.get("/venues"),
        ]);
        setDepartments(deptRes.data.items || []);
        setVenues(venueRes.data.venues || []);
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

  const handleFileAdd = () => {
    fileInputRef.current?.click();
  };
  const handleFileChange = (e) => {
    const files = Array.from(e.target.files);
    const newAttachments = files.map((file) => ({
      file,
      name: file.name,
      size: `${(file.size / 1024).toFixed(1)} KB`,
    }));
    setAttachments((prev) => [...prev, ...newAttachments]);
    e.target.value = "";
  };
  const handleRemoveFile = (fileToRemove) => {
    setAttachments((prev) => prev.filter((f) => f !== fileToRemove));
  };

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
      map_location:
        form.method !== "online" && form.hierarchy !== "local"
          ? form.map_location || undefined
          : undefined,
      attendee_ids: attendeeIds,
      collaborator_ids: collaboratorIds,
      remind_before_minutes: form.remind_before_minutes || null,
      is_email_reminder: form.is_email_reminder,
      event_type: form.event_type, // ← send event_type
    };

    console.log("Submitting event payload:", payload);

    try {
      const res = await apiClient.post("/events", payload);
      if (!res.data.ok) {
        setMessage(res.data.message || "Failed to create event");
        setLoading(false);
        return;
      }

      const eventId = res.data.event.id;

      if (attachments.length > 0) {
        const formData = new FormData();
        attachments.forEach(({ file }) => formData.append("files", file));
        try {
          await apiClient.post(`/attachments/event/${eventId}`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch (uploadErr) {
          console.error("File upload failed:", uploadErr);
        }
      }

      navigate("/calendar");
    } catch (err) {
      setMessage(err.response?.data?.message || "Server error");
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
        <div className={styles.titleSection}>
          <InputField
            className={styles.titleInput}
            value={form.title}
            placeholder="Enter title for your event.."
            onChange={(e) => updateField("title", e.target.value)}
          />
        </div>

        <div className={styles.sectionContent}>
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

          {/* ── Event Type (new dropdown) ── */}
          <div className={styles.section}>
            <SelectDropdown
              label="EVENT TYPE"
              options={[
                { value: "meeting", label: "Meeting" },
                { value: "seminar", label: "Seminar" },
                { value: "event", label: "Event" },
              ]}
              value={form.event_type}
              onChange={(e) => updateField("event_type", e.target.value)}
            />
          </div>

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
                <div className={styles.mapContainer}>
                  <label className={styles.sectionLabel}>MAP LOCATION</label>
                  <MapPicker
                    currentMapLocation={form.map_location}
                    onLocationSelect={(loc) => {
                      updateField("map_location", loc.map_location);
                    }}
                  />
                  <span className={styles.hint}>
                    Click on the map or search for a location
                  </span>
                </div>
              )}
            </div>
          )}

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

          <div className={styles.section}>
            <FileAttachment
              files={attachments.map(({ name, size }) => ({ name, size }))}
              onRemove={(file) => {
                const toRemove = attachments.find((f) => f.name === file.name);
                if (toRemove) handleRemoveFile(toRemove);
              }}
              onAdd={handleFileAdd}
            />
          </div>

          <div className={styles.section}>
            <button
              type="button"
              className={styles.inviteBtn}
              onClick={() => setShowAttendeeModal(true)}
            >
              Invite Attendees ({attendeeIds.length})
            </button>
            <button
              type="button"
              className={styles.inviteBtn}
              onClick={() => setShowCollabModal(true)}
            >
              Add Collaborators ({collaboratorIds.length})
            </button>
          </div>

          <div className={styles.section}>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Event"}
            </Button>
            {message && <p className={styles.error}>{message}</p>}
          </div>
        </div>

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

        <input
          type="file"
          multiple
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />
      </form>
    </div>
  );
}
