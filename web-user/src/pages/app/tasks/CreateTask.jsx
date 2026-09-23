import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import apiClient from "../../../api/client";
import InputField from "../../../components/common/InputField";
import Button from "../../../components/common/Button";
import RadioGroup from "../../../components/common/RadioGroup";
import TaskColor from "../../../components/tasks/TaskColor";
import InviteAssigneeModal from "../../../components/tasks/InviteAssigneeModal";
import InvitationModal from "../../../components/tasks/InvitationModal";
import FileAttachment from "../../../components/common/FileAttachment";
import FeedbackModal from "../../../components/common/FeedbackModal";
import { getReadableTextColor } from "../../../utils/colorUtils";
import {
  validateAttachmentFiles,
  ACCEPTED_ATTACHMENT_MIME_TYPES,
} from "../../../utils/fileValidation";
import { buildLocalDateTimeISO } from "../../../utils/dateTimeUtils";
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
  FiEdit2,
} from "react-icons/fi";
import { FaRegSquare, FaCheckSquare } from "react-icons/fa";
import styles from "./CreateTask.module.css";

export default function CreateTask() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const role = user?.role || "faculty";
  const hasDepartment = !!user?.department;

  const [currentProfile, setCurrentProfile] = useState(null);

  const [formData, setFormData] = useState({
    title: "",
    color: "#3B82F6",
    priority: "medium",
    visibility: "personal",
    department_id: "",
    deadlineDate: "",
    deadlineTime: "",
    description: "",
    remind_before_minutes: "",
  });

  const [assigneeIds, setAssigneeIds] = useState([]);
  const [collaboratorIds, setCollaboratorIds] = useState([]);
  const [showAssigneeModal, setShowAssigneeModal] = useState(false);
  const [showCollaboratorModal, setShowCollaboratorModal] = useState(false);
  const [attachments, setAttachments] = useState([]);
  const [checklistCards, setChecklistCards] = useState([
    { id: 1, title: "Checklist", items: [], newItemText: "" },
  ]);
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [feedback, setFeedback] = useState({ message: "", type: "success" });
  const showFeedback = (msg, type = "success") =>
    setFeedback({ message: msg, type });

  useEffect(() => {
    apiClient
      .get("/auth/me")
      .then((res) => {
        if (res.data.ok) setCurrentProfile(res.data.user);
      })
      .catch(console.error);
  }, []);

  useEffect(() => {
    if (formData.visibility === "department" && currentProfile?.department_id) {
      setFormData((prev) => ({
        ...prev,
        department_id: currentProfile.department_id,
      }));
    }
  }, [formData.visibility, currentProfile]);

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
    const nextNumber = checklistCards.length + 1;
    const title =
      checklistCards.length === 0 ? "Checklist" : `Checklist_${nextNumber}`;
    setChecklistCards((prev) => [
      ...prev,
      { id: Date.now(), title, items: [], newItemText: "" },
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
    document.getElementById("taskFileInput")?.click();
  };

  const handleFileChange = (e) => {
    const files = Array.from(e.target.files || []);
    const validation = validateAttachmentFiles(files);

    if (!validation.ok) {
      showFeedback(validation.message, "error");
      e.target.value = "";
      return;
    }

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

  // ── Auto-add any text still sitting in an "Add item..." input before
  // building the payload, so unconfirmed typed items never get silently
  // dropped just because the user forgot to press + or Enter. ──
  const flushPendingChecklistItems = (cards) => {
    return cards.map((card) => {
      const pendingText = card.newItemText?.trim();
      if (!pendingText) return card;
      return {
        ...card,
        items: [
          ...card.items,
          {
            id: `${Date.now()}-${Math.random()}`,
            text: pendingText,
            done: false,
          },
        ],
        newItemText: "",
      };
    });
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setStatusMessage("");

    if (!formData.title.trim()) {
      setStatusMessage("Please enter a task title.");
      showFeedback("Please enter a task title.", "error");
      setLoading(false);
      return;
    }
    if (!formData.deadlineDate || !formData.deadlineTime) {
      setStatusMessage("Please select a deadline date and time.");
      showFeedback("Please select a deadline date and time.", "error");
      setLoading(false);
      return;
    }

    const deadline_datetime = buildLocalDateTimeISO(
      formData.deadlineDate,
      formData.deadlineTime,
    );

    const finalCards = flushPendingChecklistItems(checklistCards);
    setChecklistCards(finalCards);

    const checklistItems = [];
    finalCards.forEach((card) => {
      card.items.forEach((item) => {
        checklistItems.push({
          text: item.text,
          card_id: String(card.id),
          card_title: card.title,
          is_completed: item.done,
        });
      });
    });

    const payload = {
      title: formData.title.trim(),
      color: formData.color,
      priority: formData.priority,
      visibility: formData.visibility,
      department_id:
        formData.visibility === "department"
          ? formData.department_id
          : undefined,
      deadline_datetime,
      description: formData.description.trim(),
      remind_before_minutes: formData.remind_before_minutes || null,
      assignee_ids: assigneeIds,
      collaborator_ids: collaboratorIds,
      checklist_items: checklistItems,
    };

    try {
      const res = await apiClient.post("/tasks", payload);
      if (res.data?.ok) {
        const taskId = res.data.task.id;
        if (attachments.length > 0) {
          const formDataObj = new FormData();
          attachments.forEach(({ file }) => formDataObj.append("files", file));
          await apiClient.post(`/attachments/task/${taskId}`, formDataObj, {
            headers: { "Content-Type": "multipart/form-data" },
          });
        }
        setStatusMessage("Task created successfully!");
        showFeedback("Task created successfully!", "success");
        setTimeout(() => navigate("/tasks"), 1000);
      } else {
        setStatusMessage(res.data?.message || "Failed to create task.");
        showFeedback(res.data?.message || "Failed to create task.", "error");
      }
    } catch (error) {
      const msg = error.response?.data?.message || "Server error.";
      setStatusMessage(msg);
      showFeedback(msg, "error");
    } finally {
      setLoading(false);
    }
  };

  const totalCompleted = (items) => items.filter((it) => it.done).length;
  const progressFor = (items) =>
    items.length ? Math.round((totalCompleted(items) / items.length) * 100) : 0;

  return (
    <div className={styles.pageWrapper}>
      <form onSubmit={handleSubmit} className={styles.form}>
        <div
          className={styles.titleSection}
          style={{
            backgroundColor: formData.color,
            color: getReadableTextColor(formData.color),
          }}
        >
          <div className={styles.titleWordDisplay}>
            {formData.title || "Title"}
          </div>
        </div>

        <div className={styles.sectionContent}>
          {/* Title */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiType size={16} className={styles.cardHeaderIcon} />
              <span>Title</span>
            </div>
            <InputField
              name="title"
              value={formData.title}
              placeholder="Enter title for your task.."
              onChange={handleInputChange}
              required
            />
          </div>

          {/* Basics */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiInfo size={16} className={styles.cardHeaderIcon} />
              <span>Task Basics</span>
            </div>
            <TaskColor
              value={formData.color}
              onChange={(color) => setFormData((prev) => ({ ...prev, color }))}
            />
            <RadioGroup
              name="priority"
              label="PRIORITY"
              options={[
                { value: "high", label: "High", color: "#800000" },
                { value: "medium", label: "Medium", color: "#AF4402" },
                { value: "low", label: "Low", color: "#095000" },
              ]}
              value={formData.priority}
              onChange={handleInputChange}
            />
          </div>

          {/* Visibility */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiUsers size={16} className={styles.cardHeaderIcon} />
              <span>Visibility</span>
            </div>
            {role === "officials" ? (
              <RadioGroup
                name="visibility"
                label="VISIBILITY"
                options={[
                  { value: "personal", label: "Personal" },
                  ...(hasDepartment
                    ? [{ value: "department", label: "Department" }]
                    : []),
                  { value: "campus", label: "Campus" },
                ]}
                value={formData.visibility}
                onChange={handleInputChange}
              />
            ) : (
              <div className={styles.staticVisibility}>
                <span className={styles.label}>VISIBILITY: Personal</span>
              </div>
            )}
          </div>

          {/* Assignees & Collaborators */}
          <div className={styles.row}>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <FiUserPlus size={16} className={styles.cardHeaderIcon} />
                <span>Assignees</span>
              </div>
              <button
                type="button"
                className={styles.inviteButton}
                onClick={() => setShowAssigneeModal(true)}
              >
                Add Assignees ({assigneeIds.length})
              </button>
            </div>
            <div className={styles.card}>
              <div className={styles.cardHeader}>
                <FiUsers size={16} className={styles.cardHeaderIcon} />
                <span>Collaborators</span>
              </div>
              <button
                type="button"
                className={styles.collabBtn}
                onClick={() => setShowCollaboratorModal(true)}
              >
                Add Collaborators ({collaboratorIds.length})
              </button>
            </div>
          </div>

          {/* Deadline */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiCalendar size={16} className={styles.cardHeaderIcon} />
              <span>Deadline</span>
            </div>
            <div className={styles.row}>
              <InputField
                label="DATE"
                type="date"
                autoComplete="off"
                name="deadlineDate"
                value={formData.deadlineDate}
                onChange={handleInputChange}
              />
              <InputField
                label="TIME"
                type="time"
                autoComplete="off"
                name="deadlineTime"
                value={formData.deadlineTime}
                onChange={handleInputChange}
              />
            </div>
          </div>

          {/* Checklist */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiList size={16} className={styles.cardHeaderIcon} />
              <span>Checklist</span>
            </div>

            <div className={styles.multiChecklistWrapper}>
              {checklistCards.map((card) => {
                const completed = totalCompleted(card.items);
                const prog = progressFor(card.items);
                return (
                  <div key={card.id} className={styles.checklistCardMulti}>
                    <div className={styles.checklistHeaderRow}>
                      <div className={styles.checklistTitleBlockRow}>
                        <div className={styles.checklistTitleInputWrapper}>
                          <input
                            className={styles.checklistTitleInput}
                            value={card.title}
                            onChange={(e) =>
                              handleEditChecklistTitle(card.id, e.target.value)
                            }
                          />
                          <FiEdit2
                            size={12}
                            className={styles.checklistTitleEditIcon}
                          />
                        </div>
                        <span className={styles.checklistSubtitleSmall}>
                          {card.items.length} items
                        </span>
                      </div>
                      <div className={styles.checklistActions}>
                        <button
                          type="button"
                          className={styles.deleteChecklistBtn}
                          onClick={() => handleDeleteChecklistCard(card.id)}
                        >
                          Delete
                        </button>
                      </div>
                    </div>

                    <div className={styles.progressTrack}>
                      <div
                        className={styles.progressFill}
                        style={{ width: `${prog}%` }}
                      />
                    </div>

                    <div className={styles.checklistList}>
                      {card.items.map((item) => (
                        <div
                          key={item.id}
                          className={`${styles.checklistItem} ${
                            item.done ? styles.checklistItemCompleted : ""
                          }`}
                        >
                          <button
                            type="button"
                            className={styles.checklistToggle}
                            onClick={() =>
                              toggleChecklistItem(card.id, item.id)
                            }
                          >
                            {item.done ? (
                              <FaCheckSquare
                                className={styles.checklistToggleIcon}
                              />
                            ) : (
                              <FaRegSquare
                                className={styles.checklistToggleIcon}
                              />
                            )}
                          </button>
                          <span
                            className={`${styles.checklistText} ${
                              item.done ? styles.checklistTextCompleted : ""
                            }`}
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
                          <FiPlus className={styles.icon} />
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

              <div className={styles.addChecklistCardRow}>
                <button
                  type="button"
                  className={styles.addChecklistCardBtn}
                  onClick={handleAddChecklistCard}
                >
                  + Add checklist card
                </button>
              </div>
            </div>
          </div>

          {/* Description */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiFileText size={16} className={styles.cardHeaderIcon} />
              <span>Description</span>
            </div>
            <InputField
              as="textarea"
              rows={4}
              name="description"
              value={formData.description}
              onChange={handleInputChange}
              placeholder="Add details about your task..."
            />
          </div>

          {/* Attachments */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiPaperclip size={16} className={styles.cardHeaderIcon} />
              <span>Attachments</span>
            </div>
            <FileAttachment
              files={attachments.map(({ name, size }) => ({ name, size }))}
              onRemove={handleRemoveFile}
              onAdd={handleFileAdd}
            />
            <input
              type="file"
              id="taskFileInput"
              multiple
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>

          {/* Reminder */}
          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiClock size={16} className={styles.cardHeaderIcon} />
              <span>Reminder</span>
            </div>
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
              Assignees and collaborators are always notified by email when
              assigned or when the task changes.
            </p>
          </div>

          {/* Submit */}
          <div className={styles.submitBar}>
            <Button type="submit" disabled={loading}>
              {loading ? "Creating..." : "Create Task"}
            </Button>
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
          </div>
        </div>
      </form>

      <InviteAssigneeModal
        isOpen={showAssigneeModal}
        onClose={() => setShowAssigneeModal(false)}
        selectedIds={assigneeIds}
        onSave={setAssigneeIds}
      />

      <InvitationModal
        isOpen={showCollaboratorModal}
        onClose={() => setShowCollaboratorModal(false)}
        selectedIds={collaboratorIds}
        onSave={setCollaboratorIds}
        title="Add Collaborators"
        type="collaborators"
      />

      <FeedbackModal
        message={feedback.message}
        type={feedback.type}
        onClose={() => setFeedback({ message: "", type: "success" })}
      />
    </div>
  );
}
