import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { debounce } from "lodash";
import InputField from "../../../components/common/InputField";
import Button from "../../../components/common/Button";
import SelectDropdown from "../../../components/common/SelectDropdown";
import RadioGroup from "../../../components/common/RadioGroup";
import EventColor from "../../../components/events/EventColor";
import InviteAttendeesModal from "../../../components/events/InviteAttendeesModal";
import MapPicker from "../../../components/common/MapPicker";
import FileAttachment from "../../../components/common/FileAttachment";
import ConflictCard from "../../../components/events/ConflictCard";
import apiClient from "../../../api/client";
import { useAuth } from "../../../context/AuthContext";
import { FiAlertCircle, FiCheckCircle, FiClock } from "react-icons/fi";
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
    event_type: "event",
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

  // Conflict detection states
  const [conflictData, setConflictData] = useState(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [showConflictSheet, setShowConflictSheet] = useState(false);

  // Store current user's full profile (includes department_id)
  const [currentProfile, setCurrentProfile] = useState(null);

  const fileInputRef = useRef(null);

  // Fetch lookup data and current user's profile
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [deptRes, venueRes, profileRes] = await Promise.all([
          apiClient.get("/lookups/departments"),
          apiClient.get("/venues"),
          apiClient.get("/auth/me"),
        ]);
        setDepartments(deptRes.data.items || []);
        setVenues(venueRes.data.venues || []);
        if (profileRes.data.ok) {
          setCurrentProfile(profileRes.data.user);
        }
      } catch (err) {
        console.error("Failed to load form data", err);
      }
    };
    fetchData();
  }, []);

  // When visibility changes to "department", auto‑set department
  useEffect(() => {
    if (form.visibility === "department" && currentProfile?.department_id) {
      if (form.department_id !== currentProfile.department_id) {
        updateField("department_id", currentProfile.department_id);
      }
    }
  }, [form.visibility, currentProfile]);

  // Auto‑invite all members of the selected department (excluding creator)
  useEffect(() => {
    if (form.visibility === "department" && form.department_id) {
      apiClient
        .get(`/auth/users?department_id=${form.department_id}`)
        .then((res) => {
          const ids = (res.data.users || [])
            .filter((u) => u.id !== user?.id)
            .map((u) => u.id);
          setAttendeeIds(ids);
        })
        .catch(console.error);
    }
  }, [form.department_id, form.visibility, user?.id]);

  const updateField = (field, value) =>
    setForm((prev) => ({ ...prev, [field]: value }));

  const handleFileAdd = () => fileInputRef.current?.click();
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

  // ─── Conflict Detection ────────────────────────────────
  const checkConflicts = useCallback(async () => {
    // Only check if we have date and time
    if (
      !form.start_date ||
      !form.end_date ||
      !form.start_time ||
      !form.end_time
    ) {
      setConflictData(null);
      return;
    }

    const startDateTime = `${form.start_date}T${form.start_time}:00`;
    const endDateTime = `${form.end_date}T${form.end_time}:00`;

    setCheckingConflicts(true);
    try {
      const res = await apiClient.post("/events/check-conflicts", {
        venue_id: form.venue_id || null,
        attendee_ids: attendeeIds,
        creator_id: user.id,
        start_datetime: startDateTime,
        end_datetime: endDateTime,
        // exclude_event_id: null for create
      });
      if (res.data.ok) {
        setConflictData(res.data);
      } else {
        setConflictData(null);
      }
    } catch (err) {
      console.error("Conflict check error:", err);
      setConflictData(null);
    } finally {
      setCheckingConflicts(false);
    }
  }, [
    form.start_date,
    form.end_date,
    form.start_time,
    form.end_time,
    form.venue_id,
    attendeeIds,
    user.id,
  ]);

  const debouncedCheck = useCallback(debounce(checkConflicts, 500), [
    checkConflicts,
  ]);

  useEffect(() => {
    debouncedCheck();
    return () => debouncedCheck.cancel();
  }, [debouncedCheck]);

  // ─── Submit ────────────────────────────────────────────
  const handleSubmit = async (e) => {
    e.preventDefault();

    // If there's a venue conflict, ask for confirmation
    if (conflictData?.conflicts?.venue?.has) {
      const confirmProceed = window.confirm(
        "The selected venue is already booked for this time. Are you sure you want to proceed?",
      );
      if (!confirmProceed) return;
    }

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
      event_type: form.event_type,
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

  // ─── Visibility Options ──────────────────────────────
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

  // Determine if there are any conflicts
  const hasAnyConflict =
    conflictData &&
    (conflictData.conflicts.venue.has ||
      conflictData.conflicts.attendees.has ||
      conflictData.conflicts.creator.has);

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
          </div>

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
            {form.visibility === "department" && (
              <p style={{ fontSize: "0.85rem", color: "#374151" }}>
                All users belongs to your department{" "}
                <strong>{currentProfile?.department}</strong> will be
                automatically invited.
              </p>
            )}
            <button
              type="button"
              className={styles.inviteBtn}
              onClick={() => setShowAttendeeModal(true)}
            >
              Invite Attendees ({attendeeIds.length})
            </button>
          </div>

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

            {/* ── Conflict Notice Card ── */}
            {checkingConflicts && (
              <div className={styles.checkingNotice}>
                <FiClock size={18} />
                <span>Checking conflicts...</span>
              </div>
            )}
            {!checkingConflicts && hasAnyConflict && (
              <div
                className={styles.conflictNotice}
                onClick={() => setShowConflictSheet(true)}
              >
                <div className={styles.conflictNoticeLeft}>
                  <FiAlertCircle size={20} className={styles.conflictIcon} />
                  <span>
                    {conflictData.conflicts.venue.has && "Venue conflict "}
                    {conflictData.conflicts.attendees.has &&
                      "· Attendee conflicts "}
                    {conflictData.conflicts.creator.has &&
                      "· You have a conflict "}
                  </span>
                </div>
                <span className={styles.viewDetails}>Tap to view details</span>
              </div>
            )}
            {!checkingConflicts &&
              !hasAnyConflict &&
              form.start_date &&
              form.start_time && (
                <div className={styles.noConflictNotice}>
                  <FiCheckCircle size={18} className={styles.noConflictIcon} />
                  <span>No conflicts detected</span>
                </div>
              )}

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
              className={styles.collabBtn}
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

        {/* Conflict Bottom Sheet */}
        <ConflictCard
          conflictData={conflictData}
          checking={checkingConflicts}
          isOpen={showConflictSheet}
          onClose={() => setShowConflictSheet(false)}
          onApplyRecommendation={(slot) => {
            // Apply the selected recommended slot to the form
            const startDate = slot.start_datetime.split("T")[0];
            const startTime = slot.start_datetime.split("T")[1].slice(0, 5);
            const endDate = slot.end_datetime.split("T")[0];
            const endTime = slot.end_datetime.split("T")[1].slice(0, 5);
            updateField("start_date", startDate);
            updateField("start_time", startTime);
            updateField("end_date", endDate);
            updateField("end_time", endTime);
            setShowConflictSheet(false);
          }}
        />
      </form>
    </div>
  );
}
