import React, { useState } from "react";
import Modal from "../common/Modal";
import styles from "./EventInvitation.module.css";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import { FiCheck, FiX, FiMail, FiUsers, FiAlertTriangle } from "react-icons/fi";

const formatDate = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatTime = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() || "?";
};

const AVATAR_COLORS = [
  "#f9a825",
  "#43a047",
  "#1e88e5",
  "#8e24aa",
  "#fb8c00",
  "#00897b",
  "#5e35b1",
];
const getAvatarColor = (str) => {
  if (!str) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i += 1)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

const getContrastTextColor = (hexColor) => {
  if (!hexColor || !/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hexColor)) {
    return "#ffffff";
  }
  let hex = hexColor.replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#1f2937" : "#ffffff";
};

export default function EventInvitation({
  isOpen,
  onClose,
  event,
  onRespond,
  mode = "invite",
}) {
  const [responding, setResponding] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  if (!event) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Invitation">
        <div className={styles.emptyState}>No invitation selected.</div>
      </Modal>
    );
  }

  const creator = event.creator || {};
  const creatorName = creator.full_name || creator.username || "Unknown";
  const creatorPosition = creator.position || "";
  const creatorAffiliation = [creator.department, creator.office]
    .filter(Boolean)
    .join(" | ");
  const creatorSub = [creatorPosition, creatorAffiliation]
    .filter(Boolean)
    .join(" | ");

  const participants = event.participants || {};
  const depts = participants.departments || [];
  const offices = participants.offices || [];
  const allUsers = participants.users || [];
  const acceptedUsers = allUsers.filter((u) => u.response === "accepted");

  const locationDisplay = event.venue || event.location || "Online";

  const handleResponse = async (response) => {
    setResponding(true);
    try {
      await onRespond(event.id, response);
    } catch (err) {
      console.error("Failed to respond:", err);
    } finally {
      setResponding(false);
      setShowRevertConfirm(false);
    }
  };

  const modalTitle =
    mode === "revert" ? "Revert Declined Invitation" : "Event Invitation";

  const headerColor = event.color || "#800000";
  const headerTextColor = getContrastTextColor(headerColor);

  return (
    <Modal isOpen={isOpen} onClose={onClose} title={modalTitle}>
      <div className={styles.mainContent}>
        <div className={styles.featuredCard}>
          <div
            className={styles.badgesStatus}
            style={{ background: headerColor, color: headerTextColor }}
          >
            <div className={styles.badgeRow}>
              <div className={styles.badgePill}>
                {event.hierarchy || "Unknown Hierarchy"}
              </div>
              <div className={styles.badgePill}>
                {event.method || "Unknown Method"}
              </div>
              <div className={styles.badgePill}>
                {event.visibility || "Unknown Visibility"}
              </div>
              <div className={styles.badgePill}>
                {event.event_type || "Unknown Type"}
              </div>
            </div>
            <div className={styles.heading2}>
              <div
                className={styles.featuredTitle}
                style={{ color: headerTextColor }}
              >
                {event.title}
              </div>
            </div>
          </div>

          <div className={styles.featuredCardContent}>
            <div className={styles.titleDescription}>
              <div className={styles.descriptionText}>
                {event.description || "No description provided."}
              </div>
            </div>

            <div className={styles.container8}>
              <div className={styles.whenWhereGroup}>
                <div className={styles.sectionHeader}>
                  <EventNoteOutlinedIcon fontSize="small" />
                  <div className={styles.heading4}>
                    <div className={styles.text7}>WHEN &amp; WHERE</div>
                  </div>
                </div>
                <div className={styles.infoGrid}>
                  <div className={styles.infoBlock}>
                    <div className={styles.infoLabel}>DATE RANGE</div>
                    <div className={styles.infoValue}>
                      {formatDate(event.start_datetime)} —{" "}
                      {formatDate(event.end_datetime)}
                    </div>
                  </div>
                  <div className={styles.infoBlock}>
                    <div className={styles.infoLabel}>TIME</div>
                    <div className={styles.infoValue}>
                      {formatTime(event.start_datetime)} —{" "}
                      {formatTime(event.end_datetime)}
                    </div>
                  </div>
                  <div className={styles.infoBlock}>
                    <div className={styles.infoLabel}>LOCATION</div>
                    <div className={styles.infoValue}>{locationDisplay}</div>
                  </div>
                </div>
                <p className={styles.hiddenNote}>
                  Event link will be visible once you accept.
                </p>
              </div>

              <div className={styles.organizerSection}>
                <div className={styles.sectionHeader}>
                  <PersonOutlinedIcon fontSize="small" />
                  <div className={styles.heading4}>
                    <div className={styles.text7}>ORGANIZER</div>
                  </div>
                </div>
                <div className={styles.organizerRow}>
                  <div
                    className={styles.organizerAvatar}
                    style={{ background: getAvatarColor(creatorName) }}
                  >
                    {getInitials(creatorName)}
                  </div>
                  <div className={styles.organizerDetails}>
                    <div className={styles.organizerName}>{creatorName}</div>
                    <div className={styles.organizerTitle}>
                      {creatorSub || "Organizer"}
                    </div>
                    {creator.email && (
                      <div className={styles.organizerEmail}>
                        <FiMail size={12} /> {creator.email}
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.participatingBlock}>
                  <div className={styles.infoLabel}>
                    PARTICIPATING DEPARTMENTS
                  </div>
                  <div className={styles.deptBadges}>
                    {depts.slice(0, 4).map((dept) => (
                      <div key={dept} className={styles.deptBadge}>
                        {dept}
                      </div>
                    ))}
                    {depts.length > 4 && (
                      <div className={styles.deptBadge}>
                        +{depts.length - 4}
                      </div>
                    )}
                  </div>
                </div>
                <div className={styles.participatingBlock}>
                  <div className={styles.infoLabel}>PARTICIPATING OFFICES</div>
                  <div className={styles.deptBadges}>
                    {offices.slice(0, 4).map((office) => (
                      <div key={office} className={styles.deptBadge}>
                        {office}
                      </div>
                    ))}
                    {offices.length > 4 && (
                      <div className={styles.deptBadge}>
                        +{offices.length - 4}
                      </div>
                    )}
                  </div>
                </div>
              </div>

              <div className={styles.audienceSection}>
                <div className={styles.sectionHeader}>
                  <GroupsOutlinedIcon fontSize="small" />
                  <div className={styles.heading4}>
                    <div className={styles.text7}>AUDIENCE</div>
                  </div>
                </div>
                <div className={styles.audienceRow}>
                  <div className={styles.attendeeStack}>
                    {acceptedUsers.slice(0, 4).map((u) => {
                      const name =
                        u.full_name || u.username || u.email || "Unknown";
                      return (
                        <div
                          key={u.id}
                          className={styles.attendeeAvatar}
                          style={{ background: getAvatarColor(name) }}
                          title={name}
                        >
                          {getInitials(name)}
                        </div>
                      );
                    })}
                    {acceptedUsers.length > 4 && (
                      <div className={styles.attendeeMore}>
                        +{acceptedUsers.length - 4}
                      </div>
                    )}
                  </div>
                  <div className={styles.audienceText}>
                    {acceptedUsers.length > 0
                      ? acceptedUsers.length === 1
                        ? `${acceptedUsers[0].full_name || acceptedUsers[0].username || acceptedUsers[0].email} attending`
                        : `${acceptedUsers[0].full_name || acceptedUsers[0].username || acceptedUsers[0].email} and ${acceptedUsers.length - 1} others attending`
                      : "No attendees yet"}
                  </div>
                </div>
              </div>

              <div className={styles.audienceSection}>
                <div className={styles.sectionHeader}>
                  <FiUsers size={16} />
                  <div className={styles.heading4}>
                    <div className={styles.text7}>INVITED ATTENDEES</div>
                  </div>
                </div>
                <div className={styles.audienceRow}>
                  <div className={styles.attendeeStack}>
                    {allUsers.slice(0, 4).map((u) => {
                      const name =
                        u.full_name || u.username || u.email || "Unknown";
                      return (
                        <div
                          key={u.id}
                          className={styles.attendeeAvatar}
                          style={{ background: getAvatarColor(name) }}
                          title={name}
                        >
                          {getInitials(name)}
                        </div>
                      );
                    })}
                    {allUsers.length > 4 && (
                      <div className={styles.attendeeMore}>
                        +{allUsers.length - 4}
                      </div>
                    )}
                  </div>
                  <div className={styles.audienceText}>
                    {allUsers.length > 0
                      ? `${allUsers.length} ${allUsers.length === 1 ? "person" : "people"} invited in total`
                      : "No one invited yet"}
                  </div>
                </div>
              </div>
            </div>

            {/* ─── Response Buttons ─── */}
            <div className={styles.responseSection}>
              {mode === "revert" ? (
                showRevertConfirm ? (
                  <div className={styles.revertConfirmBox}>
                    <FiAlertTriangle
                      size={20}
                      className={styles.revertConfirmIcon}
                    />
                    <p className={styles.revertConfirmText}>
                      Are you sure? You already declined this invitation.
                    </p>
                    <div className={styles.responseBtns}>
                      <button
                        type="button"
                        className={styles.acceptBtn}
                        onClick={() => handleResponse("accepted")}
                        disabled={responding}
                      >
                        <FiCheck size={18} /> Yes, Accept
                      </button>
                      <button
                        type="button"
                        className={styles.declineBtn}
                        onClick={() => setShowRevertConfirm(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className={styles.responseText}>
                      You previously declined this invitation. Would you like to
                      accept it now?
                    </p>
                    <div className={styles.responseBtns}>
                      <button
                        type="button"
                        className={styles.acceptBtn}
                        onClick={() => setShowRevertConfirm(true)}
                      >
                        <FiCheck size={18} /> Accept
                      </button>
                    </div>
                  </>
                )
              ) : (
                <>
                  <p className={styles.responseText}>
                    You have been invited to this event. Accept or Decline?
                  </p>
                  <div className={styles.responseBtns}>
                    <button
                      type="button"
                      className={styles.acceptBtn}
                      onClick={() => handleResponse("accepted")}
                      disabled={responding}
                    >
                      <FiCheck size={18} /> Accept
                    </button>
                    <button
                      type="button"
                      className={styles.declineBtn}
                      onClick={() => handleResponse("declined")}
                      disabled={responding}
                    >
                      <FiX size={18} /> Decline
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        </div>
      </div>
    </Modal>
  );
}
