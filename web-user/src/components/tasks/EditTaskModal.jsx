import { useState, useEffect } from "react";
import { useAuth } from "../../context/AuthContext";
import apiClient from "../../api/client";
import Modal from "../common/Modal";
import InputField from "../common/InputField";
import Button from "../common/Button";
import RadioGroup from "../common/RadioGroup";
import TaskColor from "./TaskColor";
import FileAttachment from "../common/FileAttachment";
import { getReadableTextColor } from "../../utils/colorUtils";
import {
  buildLocalDateTimeISO,
  splitISOToLocalParts,
} from "../../utils/dateTimeUtils";
import {
  validateAttachmentFiles,
  ACCEPTED_ATTACHMENT_INPUT_TYPES,
} from "../../utils/fileValidation";
import {
  FiCalendar,
  FiClock,
  FiInfo,
  FiType,
  FiList,
  FiPlus,
  FiUserPlus,
  FiUsers,
  FiFileText,
  FiPaperclip,
  FiX,
} from "react-icons/fi";
import { FaRegSquare, FaCheckSquare } from "react-icons/fa";
import styles from "./EditTaskModal.module.css";

export default function EditTaskModal({
  isOpen,
  onClose,
  taskId,
  onTaskUpdated,
}) {
  const { user } = useAuth();
  const [loading, setLoading] = useState(false);
  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [statusMessage, setStatusMessage] = useState("");

  const [formData, setFormData] = useState({
    title: "",
    color: "#3B82F6",
    priority: "medium",
    visibility: "personal",
    deadlineDate: "",
    deadlineTime: "",
    description: "",
    remind_before_minutes: "",
  });

  const [assigneeIds, setAssigneeIds] = useState([]);
  const [collaboratorIds, setCollaboratorIds] = useState([]);
  const [attachments, setAttachments] = useState([]);
  const [existingAttachments, setExistingAttachments] = useState([]);
  const [originalAttachmentCount, setOriginalAttachmentCount] = useState(0);

  const [checklistCards, setChecklistCards] = useState([
    { id: 1, title: "Checklist", items: [], newItemText: "" },
  ]);

  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);

  useEffect(() => {
    if (!isOpen || !taskId) return;

    const fetchTask = async () => {
      setFetching(true);
      setError("");
      try {
        const res = await apiClient.get(`/tasks/${taskId}`);
        if (res.data.ok) {
          const task = res.data.task;
          const { date: dateStr, time: timeStr } = splitISOToLocalParts(
            task.deadline_datetime,
          );

          setFormData({
            title: task.title || "",
            color: task.color || "#3B82F6",
            priority: task.priority || "medium",
            visibility: task.visibility || "personal",
            deadlineDate: dateStr,
            deadlineTime: timeStr,
            description: task.description || "",
            remind_before_minutes: task.remind_before_minutes || "",
          });

          const assignees = (task.assignees || []).map((a) => a.id);
          setAssigneeIds(assignees);

          const collaborators = (task.collaborators || []).map((c) => c.id);
          setCollaboratorIds(collaborators);

          if (task.checklist && task.checklist.length > 0) {
            const items = task.checklist.map((item) => ({
              id: item.id,
              text: item.text,
              done: item.is_completed,
            }));
            setChecklistCards([
              { id: 1, title: "Checklist", items, newItemText: "" },
            ]);
          } else {
            setChecklistCards([
              { id: 1, title: "Checklist", items: [], newItemText: "" },
            ]);
          }

          setExistingAttachments(task.attachments || []);
          setOriginalAttachmentCount(task.attachments?.length || 0);
        } else {
          setError(res.data?.message || "The server did not return this task's details. Refresh the page and try again.");
        }
      } catch (err) {
        console.error("Fetch task error:", err);
        setError(err.response?.data?.message || err.message || "We could not load this task. Check your connection and try again.");
      } finally {
        setFetching(false);
      }
    };

    fetchTask();
  }, [isOpen, taskId]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const toggleChecklistItem = (cardId, itemId) => {
    setChecklistCards((prev) =>
      prev.map((card) =>
        card.id === cardId
          ? {
              ...card,
              items: card.items.map((item) =>
                item.id === itemId ? { ...item, done: !item.done } : item,
              ),
            }
          : card,
      ),
    );
  };

  const handleAddChecklistItem = (cardId) => {
    setChecklistCards((prev) =>
      prev.map((card) => {
        if (card.id !== cardId) return card;
        const text = card.newItemText?.trim();
        if (!text) return card;
        return {
          ...card,
          items: [...card.items, { id: Date.now(), text, done: false }],
          newItemText: "",
        };
      }),
    );
  };

  const handleNewItemTextChange = (cardId, value) => {
    setChecklistCards((prev) =>
      prev.map((card) =>
        card.id === cardId ? { ...card, newItemText: value } : card,
      ),
    );
  };

  const handleAddChecklistCard = () => {
    setChecklistCards((prev) => [
      ...prev,
      { id: Date.now(), title: "Checklist", items: [], newItemText: "" },
    ]);
  };

  const handleDeleteChecklistCard = (cardId) => {
    if (checklistCards.length <= 1) return;
    setChecklistCards((prev) => prev.filter((c) => c.id !== cardId));
  };

  const handleEditChecklistTitle = (cardId, value) => {
    setChecklistCards((prev) =>
      prev.map((c) => (c.id === cardId ? { ...c, title: value } : c)),
    );
  };

  const handleFileAdd = () => {
    document.getElementById("editTaskFileInput")?.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    const validation = validateAttachmentFiles(
      files,
      originalAttachmentCount + attachments.length,
    );
    if (!validation.ok) {
      setStatusMessage(validation.message);
      e.target.value = "";
      return;
    }

    setStatusMessage("");
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage("");

    if (!formData.title.trim()) {
      setStatusMessage("Please enter a task title.");
      setLoading(false);
      return;
    }
    if (!formData.deadlineDate || !formData.deadlineTime) {
      setStatusMessage("Please select a deadline date and time.");
      setLoading(false);
      return;
    }

    const deadline_datetime = buildLocalDateTimeISO(
      formData.deadlineDate,
      formData.deadlineTime,
    );

    const checklistItems = [];
    checklistCards.forEach((card) => {
      card.items.forEach((item) => {
        checklistItems.push({ text: item.text, is_completed: item.done });
      });
    });

    const payload = {
      title: formData.title.trim(),
      color: formData.color,
      priority: formData.priority,
      visibility: formData.visibility,
      deadline_datetime,
      description: formData.description.trim(),
      remind_before_minutes: formData.remind_before_minutes || null,
      assignee_ids: assigneeIds,
      collaborator_ids: collaboratorIds,
      checklist_items: checklistItems,
    };

    try {
      const res = await apiClient.put(`/tasks/${taskId}`, payload);
      if (res.data.ok) {
        if (attachments.length > 0) {
          const formDataObj = new FormData();
          attachments.forEach(({ file }) => formDataObj.append("files", file));
          await apiClient.post(`/attachments/task/${taskId}`, formDataObj, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
        setStatusMessage("Task updated successfully!");
        onTaskUpdated();
        setTimeout(onClose, 800);
      } else {
        setStatusMessage(res.data?.message || "Failed to update task.");
      }
    } catch (error) {
      setStatusMessage(error.response?.data?.message || error.message || "We could not save the task. Review the required fields and try again.");
    } finally {
      setLoading(false);
    }
  };

  const totalCompleted = (items) => items.filter((it) => it.done).length;
  const progressFor = (items) =>
    items.length ? Math.round((totalCompleted(items) / items.length) * 100) : 0;

  if (fetching) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Edit Task">
        <div style={{ padding: "20px", textAlign: "center" }}>
          Loading task...
        </div>
      </Modal>
    );
  }

  if (error) {
    return (
      <Modal isOpen={isOpen} onClose={onClose} title="Edit Task">
        <div style={{ padding: "20px", color: "#dc2626", textAlign: "center" }}>
          {error}
          <button
            onClick={onClose}
            style={{ marginTop: "12px", display: "block", width: "100%" }}
          >
            Close
          </button>
        </div>
      </Modal>
    );
  }

  return (
    <Modal isOpen={isOpen} onClose={onClose} title="Edit Task">
      <div className={styles.modalBody}>
        <div
          className={styles.titlePreview}
          style={{
            background: formData.color,
            color: getReadableTextColor(formData.color),
          }}
        >
          {formData.title || "Title"}
        </div>

        <form onSubmit={handleSubmit} className={styles.form}>
          {/* ── Title ── */}
          <div className={styles.field}>
            <label className={styles.label}>
              <FiType size={13} /> Title *
            </label>
            <input
              type="text"
              name="title"
              value={formData.title}
              onChange={handleInputChange}
              className={styles.input}
              placeholder="Enter task title"
              required
            />
          </div>

          {/* ── Color & Priority ── */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Color</label>
              <TaskColor
                value={formData.color}
                onChange={(color) =>
                  setFormData((prev) => ({ ...prev, color }))
                }
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Priority</label>
              <RadioGroup
                name="priority"
                options={[
                  { value: "high", label: "High", color: "#800000" },
                  { value: "medium", label: "Medium", color: "#AF4402" },
                  { value: "low", label: "Low", color: "#095000" },
                ]}
                value={formData.priority}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {/* ── Visibility ── */}
          <div className={styles.field}>
            <label className={styles.label}>Visibility</label>
            <RadioGroup
              name="visibility"
              options={[
                { value: "personal", label: "Personal" },
                { value: "department", label: "Department" },
                { value: "campus", label: "Campus" },
              ]}
              value={formData.visibility}
              onChange={handleInputChange}
            />
          </div>

          {/* ── Assignees & Collaborators ── */}
          <div className={styles.row}>
            <div className={styles.field}>
              <button
                type="button"
                className={styles.inviteButton}
                onClick={() => setShowAssigneeModal(true)}
              >
                <FiUserPlus /> Assignees ({assigneeIds.length})
              </button>
            </div>
            <div className={styles.field}>
              <button
                type="button"
                className={styles.collabBtn}
                onClick={() => setShowCollaboratorModal(true)}
              >
                <FiUsers /> Collaborators ({collaboratorIds.length})
              </button>
            </div>
          </div>

          {/* ── Deadline ── */}
          <div className={styles.row}>
            <div className={styles.field}>
              <label className={styles.label}>Deadline Date *</label>
              <input
                type="date"
                name="deadlineDate"
                value={formData.deadlineDate}
                onChange={handleInputChange}
                className={styles.input}
                required
              />
            </div>
            <div className={styles.field}>
              <label className={styles.label}>Deadline Time *</label>
              <input
                type="time"
                name="deadlineTime"
                value={formData.deadlineTime}
                onChange={handleInputChange}
                className={styles.input}
                required
              />
            </div>
          </div>

          {/* ── Checklist ── */}
          <div className={styles.field}>
            <label className={styles.label}>Checklist</label>
            <div className={styles.multiChecklistWrapper}>
              {checklistCards.map((card) => {
                const completed = totalCompleted(card.items);
                const prog = progressFor(card.items);
                return (
                  <div key={card.id} className={styles.checklistCard}>
                    <div className={styles.checklistHeader}>
                      <input
                        className={styles.checklistTitleInput}
                        value={card.title}
                        onChange={(e) =>
                          handleEditChecklistTitle(card.id, e.target.value)
                        }
                      />
                      <span className={styles.checklistCount}>
                        {card.items.length} items · {completed} done
                      </span>
                      <button
                        type="button"
                        className={styles.deleteChecklistBtn}
                        onClick={() => handleDeleteChecklistCard(card.id)}
                      >
                        <FiX size={14} />
                      </button>
                    </div>
                    <div className={styles.progressTrack}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${prog}%` }}
                      />
                    </div>
                    <div className={styles.checklistList}>
                      {card.items.map((item) => (
                        <div key={item.id} className={styles.checklistItem}>
                          <button
                            type="button"
                            className={styles.checklistToggle}
                            onClick={() =>
                              toggleChecklistItem(card.id, item.id)
                            }
                          >
                            {item.done ? (
                              <FaCheckSquare className={styles.checkIcon} />
                            ) : (
                              <FaRegSquare className={styles.checkIcon} />
                            )}
                          </button>
                          <span
                            className={
                              item.done ? styles.itemDone : styles.itemText
                            }
                          >
                            {item.text}
                          </span>
                        </div>
                      ))}
                      <div className={styles.checklistAddRow}>
                        <button
                          type="button"
                          className={styles.checklistAddButton}
                          onClick={() => handleAddChecklistItem(card.id)}
                        >
                          <FiPlus />
                        </button>
                        <input
                          className={styles.checklistAddInput}
                          value={card.newItemText}
                          placeholder="Add item..."
                          onChange={(e) =>
                            handleNewItemTextChange(card.id, e.target.value)
                          }
                          onKeyDown={(e) => {
                            if (e.key === "Enter") {
                              e.preventDefault();
                              handleAddChecklistItem(card.id);
                            }
                          }}
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              <button
                type="button"
                className={styles.addChecklistCardBtn}
                onClick={handleAddChecklistCard}
              >
                + Add checklist
              </button>
            </div>
          </div>

          {/* ── Description ── */}
          <div className={styles.field}>
            <label className={styles.label}>Description</label>
            <textarea
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              className={styles.textarea}
              rows={3}
              placeholder="Add details about your task..."
            />
          </div>

          {/* ── Attachments ── */}
          <div className={styles.field}>
            <label className={styles.label}>Attachments</label>
            {existingAttachments.length > 0 && (
              <div className={styles.existingFiles}>
                {existingAttachments.map((file) => (
                  <div key={file.id} className={styles.fileItem}>
                    <span>{file.file_name}</span>
                    <button
                      type="button"
                      onClick={() => handleRemoveExistingFile(file.id)}
                    >
                      <FiX size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
            <FileAttachment
              files={attachments.map(({ name, size }) => ({ name, size }))}
              onRemove={handleRemoveFile}
              onAdd={handleFileAdd}
            />
            <input
              type="file"
              id="editTaskFileInput"
              multiple
              accept={ACCEPTED_ATTACHMENT_INPUT_TYPES}
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>

          {/* ── Reminder ── */}
          <div className={styles.field}>
            <label className={styles.label}>Reminder</label>
            <select
              className={styles.select}
              name="remind_before_minutes"
              value={formData.remind_before_minutes}
              onChange={handleInputChange}
            >
              <option value="">None</option>
              <option value="5">5 min before</option>
              <option value="10">10 min before</option>
              <option value="15">15 min before</option>
              <option value="30">30 min before</option>
              <option value="60">1 hour before</option>
              <option value="1440">1 day before</option>
            </select>
            <p
              className={styles.statusMessage}
              style={{ color: "#6b7280", fontWeight: 400 }}
            >
              Assignees and collaborators are always notified by email.
            </p>
          </div>

          {/* ── Submit ── */}
          <div className={styles.actions}>
            <button
              type="button"
              className={styles.cancelBtn}
              onClick={onClose}
            >
              Cancel
            </button>
            <button type="submit" className={styles.saveBtn} disabled={loading}>
              {loading ? "Saving..." : "Save Changes"}
            </button>
          </div>
          {statusMessage && (
            <p
              className={styles.statusMessage}
              style={{
                color: statusMessage.includes("success")
                  ? "#0f766e"
                  : "#b91c1c",
              }}
            >
              {statusMessage}
            </p>
          )}
        </form>
      </div>
    </Modal>
  );
}
