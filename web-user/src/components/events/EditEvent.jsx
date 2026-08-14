import { useState, useEffect, useRef, useCallback } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { debounce } from "lodash";
import InputField from "../common/InputField";
import Button from "../common/Button";
import SelectDropdown from "../common/SelectDropdown";
import RadioGroup from "../common/RadioGroup";
import EventColor from "./EventColor";
import InviteAttendeesModal from "./InviteAttendeesModal";
import MapPicker from "../common/MapPicker";
import FileAttachment from "../common/FileAttachment";
import ConflictCard from "./ConflictCard";
import FeedbackModal from "../common/FeedbackModal";
import apiClient from "../../api/client";
import { useAuth } from "../../context/AuthContext";
import { getReadableTextColor } from "../../utils/colorUtils";
import {
  buildLocalDateTimeISO,
  splitISOToLocalParts,
} from "../../utils/dateTimeUtils";
import {
  FiAlertCircle,
  FiCheckCircle,
  FiClock,
  FiInfo,
  FiTag,
  FiType,
  FiMapPin,
  FiUsers,
  FiCalendar,
  FiFileText,
  FiPaperclip,
  FiUserPlus,
  FiX,
} from "react-icons/fi";
import styles from "../../pages/app/events/CreateEvent.module.css";

export default function EditEvent() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const role = user?.role || "faculty";
  const hasDepartment = !!user?.department;

  const [form, setForm] = useState({
    title: "",
    color: "#800000",
    visibility: "private",
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
    event_type: "event",
  });

  const [attendeeIds, setAttendeeIds] = useState([]);
  const [originalAttendeeIds, setOriginalAttendeeIds] = useState([]);
  const [collaboratorIds, setCollaboratorIds] = useState([]);
  const [showAttendeeModal, setShowAttendeeModal] = useState(false);
  const [showCollabModal, setShowCollabModal] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);

  const [departments, setDepartments] = useState([]);
  const [venues, setVenues] = useState([]);
  const [loading, setLoading] = useState(false);
  const [fetchingEvent, setFetchingEvent] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const [feedback, setFeedback] = useState({ message: "", type: "success" });
  const showFeedback = (msg, type = "success") =>
    setFeedback({ message: msg, type });

  const [isEventCreator, setIsEventCreator] = useState(false);

  const [conflictData, setConflictData] = useState(null);
  const [checkingConflicts, setCheckingConflicts] = useState(false);
  const [showConflictSheet, setShowConflictSheet] = useState(false);

  const fileInputRef = useRef(null);

  const goBack = () => navigate("/events");

  useEffect(() => {
    const fetchEventData = async () => {
      try {
        setFetchingEvent(true);

        const [eventRes, deptRes, venueRes] = await Promise.all([
          apiClient.get(`/events/${id}`),
          apiClient.get("/lookups/departments"),
          apiClient.get("/venues"),
        ]);

        const event = eventRes.data.event;

        const { date: startDateStr, time: startTimeStr } = splitISOToLocalParts(
          event.start_datetime,
        );
        const { date: endDateStr, time: endTimeStr } = splitISOToLocalParts(
          event.end_datetime,
        );

        setForm({
          title: event.title || "",
          color: event.color || "#800000",
          visibility: event.visibility || "private",
          method: event.method || "face-to-face",
          link: event.link || "",
          hierarchy: event.hierarchy || "local",
          department_id: event.department_id || "",
          description: event.description || "",
          start_date: startDateStr,
          end_date: endDateStr,
          start_time: startTimeStr,
          end_time: endTimeStr,
          venue_id: event.venue_id || "",
          location_id: event.location_id || "",
          exact_location: event.exact_location || "",
          street: event.street || "",
          map_location: event.map_location || "",
          remind_before_minutes: event.remind_before_minutes || "",
          event_type: event.event_type || "event",
        });

        const attendees = event.attendees || [];
        const collaborators = event.collaborators || [];
        setAttendeeIds(attendees.map((a) => a.user_id));
        setOriginalAttendeeIds(
          attendees.filter((a) => a.is_original).map((a) => a.user_id),
        );
        setCollaboratorIds(collaborators);

        setIsEventCreator(!!event.isCreator);
        setExistingAttachments(event.attachments || []);

        setDepartments(deptRes.data.items || []);
        setVenues(venueRes.data.venues || []);
      } catch (err) {
        console.error("Failed to fetch event:", err);
        setError("Failed to load event data. Please try again.");
      } finally {
        setFetchingEvent(false);
      }
    };

    fetchEventData();
  }, [id]);

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
  const handleRemoveExistingFile = (fileId) => {
    setExistingAttachments((prev) => prev.filter((f) => f.id !== fileId));
  };

  const checkConflicts = useCallback(async () => {
    if (
      !form.start_date ||
      !form.end_date ||
      !form.start_time ||
      !form.end_time
    ) {
      setConflictData(null);
      return;
    }

    const startDateTime = buildLocalDateTimeISO(
      form.start_date,
      form.start_time,
    );
    const endDateTime = buildLocalDateTimeISO(form.end_date, form.end_time);

    if (
      !startDateTime ||
      !endDateTime ||
      new Date(startDateTime) >= new Date(endDateTime)
    ) {
      setConflictData(null);
      return;
    }

    setCheckingConflicts(true);
    try {
      const res = await apiClient.post("/events/check-conflicts", {
        venue_id: form.venue_id || null,
        attendee_ids: attendeeIds,
        creator_id: user.id,
        start_datetime: startDateTime,
        end_datetime: endDateTime,
        exclude_event_id: id,
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
    id,
  ]);

  const debouncedCheck = useCallback(debounce(checkConflicts, 500), [
    checkConflicts,
  ]);

  useEffect(() => {
    debouncedCheck();
    return () => debouncedCheck.cancel();
  }, [debouncedCheck]);

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
      start_datetime: buildLocalDateTimeISO(form.start_date, form.start_time),
      end_datetime: buildLocalDateTimeISO(form.end_date, form.end_time),
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
      event_type: form.event_type,
    };

    try {
      const res = await apiClient.put(`/events/${id}`, payload);
      if (!res.data.ok) {
        setMessage(res.data.message || "Failed to update event");
        showFeedback(res.data.message || "Failed to update event", "error");
        setLoading(false);
        return;
      }

      if (attachments.length > 0) {
        const formData = new FormData();
        attachments.forEach(({ file }) => formData.append("files", file));
        try {
          await apiClient.post(`/attachments/event/${id}`, formData, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        } catch (uploadErr) {
          console.error("File upload failed:", uploadErr);
        }
      }

      showFeedback("Event updated successfully!", "success");
      setTimeout(() => navigate("/events"), 800);
    } catch (err) {
      console.error("Update error:", err);
      const errorMsg =
        err.response?.data?.message || err.message || "Server error";
      setMessage(errorMsg);
      showFeedback(errorMsg, "error");
      setLoading(false);
    }
  };

  const canEditVisibility = role === "officials" && isEventCreator;

  const visibilityOptions = [];
  if (canEditVisibility) {
    visibilityOptions.push({ value: "private", label: "Private" });
    if (hasDepartment) {
      visibilityOptions.push({ value: "department", label: "Department" });
    }
    visibilityOptions.push({ value: "campus", label: "Campus" });
  } else {
    visibilityOptions.push({ value: form.visibility || "private", label: "" });
  }
  const showVisibilityRadio = canEditVisibility && visibilityOptions.length > 1;

  const visibilityLabel = form.visibility
    ? form.visibility.charAt(0).toUpperCase() + form.visibility.slice(1)
    : "Private";

  const hasAnyConflict =
    conflictData &&
    (conflictData.conflicts.venue.has ||
      conflictData.conflicts.attendees.has ||
      conflictData.conflicts.creator.has);

  if (fetchingEvent) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.sectionContent}>
          <p style={{ textAlign: "center", padding: "2rem 0" }}>
            Loading event data...
          </p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.sectionContent}>
          <p className={styles.error}>{error}</p>
          <Button onClick={goBack}>Back to Events</Button>
        </div>
      </div>
    );
  }

  return (
    <div className={styles.pageWrapper}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div
          className={styles.titleSection}
          style={{
            background: form.color,
            color: getReadableTextColor(form.color),
          }}
        >
          <div className={styles.titleWordDisplay}>{form.title || "Title"}</div>
        </div>

        <div className={styles.sectionContent}>
          {/* ── Title ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiType size={16} className={styles.cardHeaderIcon} />
              <span>Title</span>
            </div>
            <InputField
              value={form.title}
              placeholder="Enter title for your event.."
              onChange={(e) => updateField("title", e.target.value)}
            />
          </div>

          {/* ── Event Basics ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiInfo size={16} className={styles.cardHeaderIcon} />
              <span>Event Basics</span>
            </div>

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
                  <span className={styles.label}>
                    VISIBILITY: {visibilityLabel}
                  </span>
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

          {/* ── Classification ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiTag size={16} className={styles.cardHeaderIcon} />
              <span>Classification</span>
            </div>
            <div className={styles.row}>
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
          </div>

          {/* ── Location ── */}
          {form.method !== "online" && (
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <FiMapPin size={16} className={styles.cardHeaderIcon} />
                <span>Location</span>
              </div>
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

          {/* ── Attendees ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiUsers size={16} className={styles.cardHeaderIcon} />
              <span>Attendees</span>
            </div>
            {form.visibility === "department" && (
              <p className={styles.helperText}>
                All users belonging to the selected department will be
                automatically invited.
              </p>
            )}
            {originalAttendeeIds.length > 0 && (
              <p className={styles.helperText}>
                {originalAttendeeIds.length} original attendee(s) cannot be
                removed — you can only add more.
              </p>
            )}
            <button
              type="button"
              className={styles.inviteBtn}
              onClick={() => setShowAttendeeModal(true)}
            >
              <FiUserPlus size={16} />
              Invite Attendees ({attendeeIds.length})
            </button>
          </div>

          {/* ── Date & Time ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiCalendar size={16} className={styles.cardHeaderIcon} />
              <span>Date &amp; Time</span>
            </div>
            <div className={styles.row}>
              <InputField
                label="START DATE"
                type="date"
                autoComplete="off"
                value={form.start_date}
                onChange={(e) => updateField("start_date", e.target.value)}
              />
              <InputField
                label="END DATE"
                type="date"
                autoComplete="off"
                value={form.end_date}
                onChange={(e) => updateField("end_date", e.target.value)}
              />
            </div>
            <div className={styles.row}>
              <InputField
                label="START TIME"
                type="time"
                autoComplete="off"
                value={form.start_time}
                onChange={(e) => updateField("start_time", e.target.value)}
              />
              <InputField
                label="END TIME"
                type="time"
                autoComplete="off"
                value={form.end_time}
                onChange={(e) => updateField("end_time", e.target.value)}
              />
            </div>

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
                    {conflictData.conflicts.venue.has &&
                      "Venue conflict — must be resolved before saving "}
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
              <p className={styles.helperText}>
                Attendees and collaborators are always notified by email when
                invited or when the event changes.
              </p>
            </div>
          </div>

          {/* ── Description ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiFileText size={16} className={styles.cardHeaderIcon} />
              <span>Description</span>
            </div>
            <InputField
              as="textarea"
              rows={3}
              value={form.description}
              onChange={(e) => updateField("description", e.target.value)}
              placeholder="Add details about your event, agenda, or guest list..."
            />
          </div>

          {/* ── Attachments ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiPaperclip size={16} className={styles.cardHeaderIcon} />
              <span>Attachments</span>
            </div>

            {existingAttachments.length > 0 && (
              <div className={styles.existingFiles}>
                <p className={styles.helperText}>Current files:</p>
                {existingAttachments.map((file) => (
                  <div key={file.id} className={styles.existingFile}>
                    <span className={styles.existingFileName}>
                      {file.file_name}
                    </span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExistingFile(file.id)}
                      className={styles.removeFileBtn}
                    >
                      <FiX size={14} /> Remove
                    </button>
                  </div>
                ))}
              </div>
            )}

            <FileAttachment
              files={attachments.map(({ name, size }) => ({ name, size }))}
              onRemove={(file) => {
                const toRemove = attachments.find((f) => f.name === file.name);
                if (toRemove) handleRemoveFile(toRemove);
              }}
              onAdd={handleFileAdd}
            />
          </div>

          {/* ── Collaborators ── */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiUserPlus size={16} className={styles.cardHeaderIcon} />
              <span>Collaborators</span>
            </div>
            <button
              type="button"
              className={styles.collabBtn}
              onClick={() => setShowCollabModal(true)}
            >
              Add Collaborators ({collaboratorIds.length})
            </button>
          </div>

          <div className={styles.submitBar}>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Event"}
            </Button>
            {message && <p className={styles.error}>{message}</p>}
          </div>
        </div>

        <InviteAttendeesModal
          isOpen={showAttendeeModal}
          onClose={() => setShowAttendeeModal(false)}
          selectedIds={attendeeIds}
          onSave={setAttendeeIds}
          lockedIds={originalAttendeeIds}
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
          type="collaborators"
        />

        <input
          type="file"
          multiple
          ref={fileInputRef}
          style={{ display: "none" }}
          onChange={handleFileChange}
        />

        <ConflictCard
          conflictData={conflictData}
          checking={checkingConflicts}
          isOpen={showConflictSheet}
          onClose={() => setShowConflictSheet(false)}
          originalStartISO={buildLocalDateTimeISO(
            form.start_date,
            form.start_time,
          )}
          originalEndISO={buildLocalDateTimeISO(form.end_date, form.end_time)}
          method={form.method}
          onApplyRecommendation={(slot) => {
            if (slot.type === "method_switch") {
              updateField("method", slot.method);
              setShowConflictSheet(false);
              return;
            }
            const { date: startDate, time: startTime } = splitISOToLocalParts(
              slot.start_datetime,
            );
            const { date: endDate, time: endTime } = splitISOToLocalParts(
              slot.end_datetime,
            );
            updateField("start_date", startDate);
            updateField("start_time", startTime);
            updateField("end_date", endDate);
            updateField("end_time", endTime);
            setShowConflictSheet(false);
          }}
        />
      </form>

      <FeedbackModal
        message={feedback.message}
        type={feedback.type}
        onClose={() => setFeedback({ message: "", type: "success" })}
      />
    </div>
  );
}
