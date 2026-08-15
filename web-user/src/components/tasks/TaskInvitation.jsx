import React, { useState } from "react";
import Modal from "../common/Modal";
import styles from "./TaskInvitation.module.css";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import { FiCheck, FiX, FiMail, FiAlertTriangle } from "react-icons/fi";

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

export default function TaskInvitation({
  isOpen,
  onClose,
  task,
  onRespond,
  mode = "invite",
}) {
  const [responding, setResponding] = useState(false);
  const [showRevertConfirm, setShowRevertConfirm] = useState(false);

  if (!task) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Invitation">
        <div className={styles.emptyState}>No task selected.</div>
      </Modal>
    );
  }

  const creator = task.creator || {};
  const creatorName = creator.full_name || creator.username || "Unknown";
  const creatorPosition = creator.position || "";
  const creatorAffiliation = [creator.department, creator.office]
    .filter(Boolean)
    .join(" | ");
  const creatorSub = [creatorPosition, creatorAffiliation]
    .filter(Boolean)
    .join(" | ");

  const handleResponse = async (response) => {
    setResponding(true);
    try {
      await onRespond(task.id, response);
    } catch (err) {
      console.error("Failed to respond:", err);
    } finally {
      setResponding(false);
      setShowRevertConfirm(false);
    }
  };

  const modalTitle =
    mode === "revert" ? "Revert Declined Task" : "Task Invitation";

  const headerColor = task.color || "#3B82F6";
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
                {task.priority || "Unknown"} priority
              </div>
              <div className={styles.badgePill}>
                {task.visibility || "Unknown"}
              </div>
            </div>
            <div className={styles.heading2}>
              <div
                className={styles.featuredTitle}
                style={{ color: headerTextColor }}
              >
                {task.title}
              </div>
            </div>
          </div>

          <div className={styles.featuredCardContent}>
            <div className={styles.titleDescription}>
              <div className={styles.descriptionText}>
                {task.description || "No description provided."}
              </div>
            </div>

            <div className={styles.container8}>
              <div className={styles.whenWhereGroup}>
                <div className={styles.sectionHeader}>
                  <EventNoteOutlinedIcon fontSize="small" />
                  <div className={styles.heading4}>
                    <div className={styles.text7}>DEADLINE</div>
                  </div>
                </div>
                <div className={styles.infoGrid}>
                  <div className={styles.infoBlock}>
                    <div className={styles.infoLabel}>DATE</div>
                    <div className={styles.infoValue}>
                      {formatDate(task.deadline_datetime)}
                    </div>
                  </div>
                  <div className={styles.infoBlock}>
                    <div className={styles.infoLabel}>TIME</div>
                    <div className={styles.infoValue}>
                      {formatTime(task.deadline_datetime)}
                    </div>
                  </div>
                </div>
              </div>

              <div className={styles.organizerSection}>
                <div className={styles.sectionHeader}>
                  <PersonOutlinedIcon fontSize="small" />
                  <div className={styles.heading4}>
                    <div className={styles.text7}>CREATED BY</div>
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
                      {creatorSub || "Task creator"}
                    </div>
                    {creator.email && (
                      <div className={styles.organizerEmail}>
                        <FiMail size={12} /> {creator.email}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            <div className={styles.responseSection}>
              {mode === "revert" ? (
                showRevertConfirm ? (
                  <div className={styles.revertConfirmBox}>
                    <FiAlertTriangle
                      size={20}
                      className={styles.revertConfirmIcon}
                    />
                    <p className={styles.revertConfirmText}>
                      Are you sure? You already declined this task.
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
                      You previously declined this task. Would you like to
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
                    You have been assigned to this task. Accept or Decline?
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
