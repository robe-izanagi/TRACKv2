import { useState, useMemo } from "react";
import {
  FiX,
  FiCheck,
  FiCalendar,
  FiUser,
  FiUsers,
  FiPaperclip,
  FiDownload,
  FiPlus,
  FiSend,
} from "react-icons/fi";
import styles from "./TaskCardView.module.css";

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
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export default function TaskCardView({
  isOpen,
  onClose,
  task,
  onChecklistToggle,
  onAddComment,
  currentUserId,
}) {
  const [commentInputs, setCommentInputs] = useState({});
  const [showCommentInput, setShowCommentInput] = useState({});

  const groupedChecklist = useMemo(() => {
    if (!task?.checklist) return [];
    const map = {};
    const order = [];
    task.checklist.forEach((item) => {
      const cid = item.card_id || "default";
      if (!map[cid]) {
        map[cid] = {
          id: cid,
          title: item.card_title || "Checklist",
          items: [],
        };
        order.push(cid);
      }
      map[cid].items.push(item);
    });
    return order.map((cid) => map[cid]);
  }, [task]);

  if (!isOpen || !task) return null;

  const formatDate = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  };
  const formatTime = (dateStr) => {
    if (!dateStr) return "";
    const d = new Date(dateStr);
    return d.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getInitials = (name) => {
    if (!name) return "?";
    const parts = name.trim().split(" ").filter(Boolean);
    if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
    return parts[0]?.slice(0, 2).toUpperCase() || "?";
  };

  const isAssignee = task.assignees?.some((a) => a.id === currentUserId);
  const isCollaborator = task.collaborators?.some(
    (c) => c.id === currentUserId,
  );
  const isCreator = task.creator?.id === currentUserId;
  const canModifyChecklist = isAssignee || isCreator || isCollaborator;

  const getTextColor = (hexColor) => {
    if (!hexColor) return "#111827";
    const r = parseInt(hexColor.slice(1, 3), 16);
    const g = parseInt(hexColor.slice(3, 5), 16);
    const b = parseInt(hexColor.slice(5, 7), 16);
    const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
    return luminance > 0.5 ? "#111827" : "#ffffff";
  };

  const handleToggle = (itemId, currentStatus) => {
    if (canModifyChecklist) onChecklistToggle(itemId, !currentStatus);
  };

  const handleCommentToggle = (itemId) => {
    setShowCommentInput((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  };

  const handleCommentChange = (itemId, value) => {
    setCommentInputs((prev) => ({ ...prev, [itemId]: value }));
  };

  const handleCommentSubmit = (itemId) => {
    const comment = commentInputs[itemId]?.trim();
    if (comment && canModifyChecklist) {
      onAddComment(itemId, comment);
      setCommentInputs((prev) => ({ ...prev, [itemId]: "" }));
      setShowCommentInput((prev) => ({ ...prev, [itemId]: false }));
    }
  };

  const handleKeyDown = (e, itemId) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleCommentSubmit(itemId);
    }
  };

  const textColor = getTextColor(task.color);

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        <button className={styles.closeBtn} onClick={onClose}>
          <FiX size={24} />
        </button>

        <div
          className={styles.header}
          style={{ backgroundColor: task.color || "#3B82F6", color: textColor }}
        >
          <h2 className={styles.title} style={{ color: textColor }}>
            {task.title}
          </h2>
          <div className={styles.metaBadges}>
            <span
              className={styles.priorityBadge}
              style={{ color: textColor, borderColor: textColor }}
            >
              {task.priority}
            </span>
            <span
              className={styles.visibilityBadge}
              style={{ color: textColor, borderColor: textColor }}
            >
              {task.visibility}
            </span>
            {task.is_completed ? (
              <span
                className={styles.completedBadge}
                style={{ color: textColor, borderColor: textColor }}
              >
                Completed
              </span>
            ) : (
              <span
                className={styles.ongoingBadge}
                style={{ color: textColor, borderColor: textColor }}
              >
                Ongoing
              </span>
            )}
          </div>
        </div>

        <div className={styles.details}>
          <div className={styles.detailRow}>
            <FiCalendar size={16} />
            <span>
              Deadline: {formatDate(task.deadline_datetime)} at{" "}
              {formatTime(task.deadline_datetime)}
            </span>
          </div>
          {task.creator && (
            <div className={styles.detailRow}>
              <FiUser size={16} />
              <span>
                Created by: {task.creator.full_name || task.creator.username}
              </span>
            </div>
          )}
        </div>

        <div className={styles.assigneesSection}>
          <h4 className={styles.assigneesTitle}>
            <FiUsers size={14} /> Assignees
          </h4>
          {task.assignees && task.assignees.length > 0 ? (
            <div className={styles.assigneeList}>
              {task.assignees.map((a) => {
                const name = a.full_name || a.username || a.email || "Unknown";
                return (
                  <div key={a.id} className={styles.assigneeRow}>
                    <div
                      className={styles.assigneeAvatar}
                      style={{ background: getAvatarColor(name) }}
                    >
                      {getInitials(name)}
                    </div>
                    <div className={styles.assigneeInfo}>
                      <span className={styles.assigneeName}>{name}</span>
                      {a.email && (
                        <span className={styles.assigneeEmail}>{a.email}</span>
                      )}
                    </div>
                    {a.response && (
                      <span
                        className={`${styles.assigneeResponseBadge} ${styles[`resp_${a.response}`]}`}
                      >
                        {a.response}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <p className={styles.noAssignees}>No assignees assigned.</p>
          )}
        </div>

        {task.description && (
          <div className={styles.description}>
            <p>{task.description}</p>
          </div>
        )}

        {task.attachments && task.attachments.length > 0 && (
          <div className={styles.attachmentsSection}>
            <h4 className={styles.attachmentsTitle}>
              <FiPaperclip size={16} /> Attachments
            </h4>
            <div className={styles.attachmentList}>
              {task.attachments.map((file) => (
                <a
                  key={file.id}
                  href={`/attachments/download/${file.id}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={styles.attachmentItem}
                  download
                >
                  <FiPaperclip size={14} />
                  <span className={styles.attachmentName}>
                    {file.file_name}
                  </span>
                  <FiDownload size={14} className={styles.downloadIcon} />
                </a>
              ))}
            </div>
          </div>
        )}

        <div className={styles.checklistSection}>
          <h3>Checklist</h3>
          {groupedChecklist.length > 0 ? (
            groupedChecklist.map((group) => (
              <div key={group.id} className={styles.checklistGroup}>
                {groupedChecklist.length > 1 && (
                  <h4 className={styles.checklistGroupTitle}>{group.title}</h4>
                )}
                <div className={styles.checklist}>
                  {group.items.map((item) => (
                    <div key={item.id} className={styles.checklistItem}>
                      <div className={styles.checklistTop}>
                        <button
                          className={styles.checkToggle}
                          onClick={() =>
                            handleToggle(item.id, item.is_completed)
                          }
                          disabled={!canModifyChecklist}
                        >
                          <span
                            className={`${styles.checkboxBox} ${item.is_completed ? styles.checkboxBoxChecked : ""}`}
                          >
                            {item.is_completed && (
                              <FiCheck
                                size={14}
                                className={styles.checkboxCheckIcon}
                              />
                            )}
                          </span>
                        </button>
                        <span
                          className={
                            item.is_completed
                              ? styles.itemDone
                              : styles.itemText
                          }
                        >
                          {item.text}
                        </span>
                      </div>
                      {item.is_completed && item.completed_by && (
                        <div className={styles.completedByRow}>
                          <span className={styles.completedBy}>
                            ✓ Checked by{" "}
                            {item.completed_by.full_name ||
                              item.completed_by.username}
                          </span>
                        </div>
                      )}

                      <div className={styles.checklistSeparator} />

                      {item.comments && item.comments.length > 0 && (
                        <div className={styles.commentsThread}>
                          {item.comments.map((comment) => (
                            <div
                              key={comment.id}
                              className={styles.commentDisplay}
                            >
                              <div className={styles.commentAvatar}>
                                {getInitials(
                                  comment.author?.full_name ||
                                    comment.author?.username,
                                )}
                              </div>
                              <div className={styles.commentBubble}>
                                <div className={styles.commentHeader}>
                                  <span className={styles.commentAuthor}>
                                    {comment.author?.full_name ||
                                      comment.author?.username ||
                                      "Unknown"}
                                  </span>
                                  <span className={styles.commentTime}>
                                    {comment.created_at
                                      ? new Date(
                                          comment.created_at,
                                        ).toLocaleDateString()
                                      : ""}
                                  </span>
                                </div>
                                <div className={styles.commentText}>
                                  {comment.text}
                                </div>
                              </div>
                            </div>
                          ))}
                          <div className={styles.checklistSeparator} />
                        </div>
                      )}

                      {canModifyChecklist && !showCommentInput[item.id] && (
                        <div className={styles.commentAction}>
                          <button
                            className={styles.addCommentBtn}
                            onClick={() => handleCommentToggle(item.id)}
                          >
                            <FiPlus size={14} />
                            Add comment
                          </button>
                        </div>
                      )}

                      {canModifyChecklist && showCommentInput[item.id] && (
                        <div className={styles.commentInputWrapper}>
                          <div className={styles.commentInputRow}>
                            <textarea
                              className={styles.commentTextarea}
                              placeholder="Write a comment..."
                              value={commentInputs[item.id] || ""}
                              onChange={(e) =>
                                handleCommentChange(item.id, e.target.value)
                              }
                              onKeyDown={(e) => handleKeyDown(e, item.id)}
                              rows={2}
                            />
                          </div>
                          <div className={styles.commentActions}>
                            <button
                              className={styles.cancelCommentBtn}
                              onClick={() => {
                                setShowCommentInput((prev) => ({
                                  ...prev,
                                  [item.id]: false,
                                }));
                                setCommentInputs((prev) => ({
                                  ...prev,
                                  [item.id]: "",
                                }));
                              }}
                            >
                              Cancel
                            </button>
                            <button
                              className={styles.submitCommentBtn}
                              onClick={() => handleCommentSubmit(item.id)}
                            >
                              <FiSend size={14} /> Comment
                            </button>
                          </div>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            ))
          ) : (
            <p className={styles.noChecklist}>No checklist items.</p>
          )}
        </div>

        <button className={styles.closeModalBtn} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}
