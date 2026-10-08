import React, { useState } from "react";
import Modal from "../common/Modal";
import styles from "./EventModalView.module.css";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import {
  FiMail,
  FiPaperclip,
  FiDownload,
  FiLink,
  FiCopy,
  FiAlertTriangle,
} from "react-icons/fi";
import { getReadableTextColor } from "../../utils/colorUtils";
import { downloadAttachment } from "../../utils/downloadAttachment";
import ConflictCardEvent from "./ConflictCardEvent";

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

const formatFileSize = (bytes) => {
  if (!bytes && bytes !== 0) return "";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
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

export default function EventModalView({ isOpen, onClose, event }) {
  const [copied, setCopied] = useState(false);
  const [showConflictModal, setShowConflictModal] = useState(false);

  if (!event) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Event Details">
        <div className={styles.emptyState}>No event selected.</div>
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
  const attachments = event.attachments || [];
  const conflict = event.conflict || {};
  const accepted = event.viewerResponse === "accepted" || event.isCreator;

  const titleBg = event.color || "#800000";
  const titleTextColor = getReadableTextColor(titleBg);

  const handleCopyLink = () => {
    if (!event.link) return;
    navigator.clipboard
      .writeText(event.link)
      .then(() => {
        setCopied(true);
        setTimeout(() => setCopied(false), 1500);
      })
      .catch(() => {});
  };

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Event Details">
      <div className={styles.mainContent}>
        <div className={styles.featuredCard}>
          <div
            className={styles.badgesStatus}
            style={{ background: titleBg, color: titleTextColor }}
          >
            <div className={styles.badgeRow}>
              <div className={styles.badgePill}>
                {event.hierarchy || "Unknown Hierarchy"}
              </div>
              <div className={styles.badgePill}>
                {event.method || "Unknown Method"}
              </div>
              <div className={styles.badgePill}>
                {event.visibility || "Unknown Event Visibility"}
              </div>
              <div className={styles.badgePill}>
                {event.event_type || "Unknown Event Type"}
              </div>
            </div>
            <div className={styles.heading2}>
              <div
                className={styles.featuredTitle}
                style={{ color: titleTextColor }}
              >
                {event.title}
              </div>
            </div>
          </div>

          <div className={styles.featuredCardContent}>
            <div className={styles.titleDescription}>
              <div className={styles.descriptionText}>{event.description}</div>
            </div>

            <div className={styles.container8}>
              {/* WHEN & WHERE */}
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
                    <div className={styles.infoValue}>
                      {event.venue || event.location || "Online"}
                    </div>
                  </div>
                </div>
                {event.method === "online" && event.link && accepted && (
                  <div className={styles.linkSection}>
                    <FiLink size={14} />
                    <span className={styles.linkText}>{event.link}</span>
                    <button
                      type="button"
                      className={styles.copyLinkBtn}
                      onClick={handleCopyLink}
                    >
                      <FiCopy size={12} /> {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                )}
              </div>

              {/* ORGANIZER — creator identity only */}
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
              </div>

              {/* PARTICIPATING — separate section for departments/offices */}
              <div className={styles.participatingSection}>
                <div className={styles.sectionHeader}>
                  <GroupsOutlinedIcon fontSize="small" />
                  <div className={styles.heading4}>
                    <div className={styles.text7}>PARTICIPATING</div>
                  </div>
                </div>
                <div className={styles.participatingBlock}>
                  <div className={styles.infoLabel}>DEPARTMENTS</div>
                  <div className={styles.deptBadges}>
                    {depts.length > 0 ? (
                      depts.slice(0, 4).map((dept) => (
                        <div key={dept} className={styles.deptBadge}>
                          {dept}
                        </div>
                      ))
                    ) : (
                      <span className={styles.noDataText}>No departments</span>
                    )}
                  </div>
                </div>
                <div className={styles.participatingBlock}>
                  <div className={styles.infoLabel}>OFFICES</div>
                  <div className={styles.deptBadges}>
                    {offices.length > 0 ? (
                      offices.slice(0, 4).map((office) => (
                        <div key={office} className={styles.deptBadge}>
                          {office}
                        </div>
                      ))
                    ) : (
                      <span className={styles.noDataText}>No offices</span>
                    )}
                  </div>
                </div>
              </div>

              {/* AUDIENCE */}
              <div className={styles.audienceSection}>
                <div className={styles.sectionHeader}>
                  <GroupsOutlinedIcon fontSize="small" />
                  <div className={styles.heading4}>
                    <div className={styles.text7}>AUDIENCE</div>
                  </div>
                </div>
                <div className={styles.audienceRow}>
                  <div className={styles.attendeeStack}>
                    {acceptedUsers.slice(0, 4).map((u, index) => {
                      const name =
                        u.full_name || u.username || u.email || "Unknown";
                      return (
                        <div
                          key={u.id || `${u.email}-${index}`}
                          className={styles.attendeeAvatar}
                          style={{ background: getAvatarColor(name) }}
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
                <button type="button" className={styles.viewAttendeesButton}>
                  <VisibilityOutlinedIcon fontSize="small" />
                  View Attendees
                </button>
              </div>

              {/* ATTACHMENTS — accepted-only */}
              {attachments.length > 0 && accepted && (
                <div className={styles.attachmentsSection}>
                  <div className={styles.sectionHeader}>
                    <FiPaperclip size={16} />
                    <div className={styles.heading4}>
                      <div className={styles.text7}>ATTACHMENTS</div>
                    </div>
                  </div>
                  <div className={styles.attachList}>
                    {attachments.map((file) => (
                      <a
                        key={file.id}
                        href="#"
                        download
                        onClick={(clickEvent) => {
                          clickEvent.preventDefault();
                          downloadAttachment(file);
                        }}
                        className={styles.attachItem}
                      >
                        <FiDownload size={14} />
                        <span className={styles.attachName}>
                          {file.file_name}
                        </span>
                        {(file.file_size || file.file_size === 0) && (
                          <span className={styles.attachSize}>
                            {formatFileSize(file.file_size)}
                          </span>
                        )}
                      </a>
                    ))}
                  </div>
                </div>
              )}

              {/* CONFLICT EVENT — 100% width section, own title */}
              {conflict.isConflicted && (
                <div className={styles.conflictSection}>
                  <div className={styles.sectionHeader}>
                    <FiAlertTriangle size={16} />
                    <div className={styles.heading4}>
                      <div className={styles.text7}>CONFLICT EVENT</div>
                    </div>
                  </div>
                  <p className={styles.conflictSummary}>
                    {conflict.isPriority
                      ? "This event takes priority over a conflicting event."
                      : "This event conflicts with another event on your schedule."}
                  </p>
                  <button
                    type="button"
                    className={`${styles.conflictDetailsBtn} ${conflict.isPriority ? styles.conflictDetailsBtnPriority : styles.conflictDetailsBtnWarning}`}
                    onClick={() => setShowConflictModal(true)}
                  >
                    <FiAlertTriangle size={13} />
                    {conflict.isPriority ? "Priority Event" : "Conflicted"} —
                    View details
                  </button>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>

      <ConflictCardEvent
        isOpen={showConflictModal}
        onClose={() => setShowConflictModal(false)}
        event={event}
      />
    </Modal>
  );
}
