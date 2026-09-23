import { useState, useEffect, useRef } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { useAuth } from "../../context/AuthContext";
import InputField from "../common/InputField";
import Button from "../common/Button";
import RadioGroup from "../common/RadioGroup";
import TaskColor from "../tasks/TaskColor";
import InviteAssigneeModal from "../tasks/InviteAssigneeModal";
import InvitationModal from "../tasks/InvitationModal";
import FileAttachment from "../common/FileAttachment";
import FeedbackModal from "../common/FeedbackModal";
import apiClient from "../../api/client";
import { getReadableTextColor } from "../../utils/colorUtils";
import {
  validateAttachmentFiles,
  ACCEPTED_ATTACHMENT_MIME_TYPES,
} from "../../utils/fileValidation";
import {
  buildLocalDateTimeISO,
  splitISOToLocalParts,
} from "../../utils/dateTimeUtils";
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
  FiEdit2,
} from "react-icons/fi";
import { FaRegSquare, FaCheckSquare } from "react-icons/fa";
import styles from "../../pages/app/tasks/CreateTask.module.css";

export default function EditTask() {
  const { id } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const role = user?.role || "faculty";
  const hasDepartment = !!user?.department;

  const [fetching, setFetching] = useState(true);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [statusMessage, setStatusMessage] = useState("");

  const [isTaskCreator, setIsTaskCreator] = useState(false);

  const [feedback, setFeedback] = useState({ message: "", type: "success" });
  const showFeedback = (msg, type = "success") =>
    setFeedback({ message: msg, type });

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
  const [existingAttachments, setExistingAttachments] = useState([]);

  const [checklistCards, setChecklistCards] = useState([
    { id: 1, title: "Checklist", items: [], newItemText: "" },
  ]);

  const fileInputRef = useRef(null);

  const goBack = () => navigate("/tasks");

  useEffect(() => {
    const fetchTask = async () => {
      setFetching(true);
      setError("");
      try {
        const res = await apiClient.get(`/tasks/${id}`);
        if (res.data.ok) {
          const task = res.data.task;
          const { date: deadlineDate, time: deadlineTime } =
            splitISOToLocalParts(task.deadline_datetime);

          setFormData({
            title: task.title || "",
            color: task.color || "#3B82F6",
            priority: task.priority || "medium",
            visibility: task.visibility || "personal",
            department_id: task.department_id || "",
            deadlineDate,
            deadlineTime,
            description: task.description || "",
            remind_before_minutes: task.remind_before_minutes || "",
          });

          setAssigneeIds((task.assignees || []).map((a) => a.id));
          setCollaboratorIds((task.collaborators || []).map((c) => c.id));
          setIsTaskCreator(!!task.isCreator);

          if (task.checklist && task.checklist.length > 0) {
            const grouped = {};
            const order = [];
            task.checklist.forEach((item) => {
              const cid = item.card_id || "default";
              if (!grouped[cid]) {
                grouped[cid] = {
                  id: cid,
                  title: item.card_title || "Checklist",
                  items: [],
                  newItemText: "",
                };
                order.push(cid);
              }
              grouped[cid].items.push({
                id: item.id,
                text: item.text,
                done: item.is_completed,
              });
            });
            const cards = order.map((cid) => grouped[cid]);
            setChecklistCards(
              cards.length > 0
                ? cards
                : [{ id: 1, title: "Checklist", items: [], newItemText: "" }],
            );
          }

          if (task.attachments) setExistingAttachments(task.attachments);
        } else {
          setError("Failed to load task.");
        }
      } catch (err) {
        console.error("Fetch task error:", err);
        setError("Unable to load task.");
      } finally {
        setFetching(false);
      }
    };

    fetchTask();
  }, [id]);

  const updateField = (field, value) =>
    setFormData((prev) => ({ ...prev, [field]: value }));

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    updateField(name, value);
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

  const handleFileAdd = () => fileInputRef.current?.click();
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
  const handleRemoveFile = (fileToRemove) =>
    setAttachments((prev) => prev.filter((f) => f !== fileToRemove));
  const handleRemoveExistingFile = (fileId) =>
    setExistingAttachments((prev) => prev.filter((f) => f.id !== fileId));

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
      const res = await apiClient.put(`/tasks/${id}`, payload);
      if (res.data.ok) {
        if (attachments.length > 0) {
          const formDataObj = new FormData();
          attachments.forEach(({ file }) => formDataObj.append("files", file));
          try {
            await apiClient.post(`/attachments/task/${id}`, formDataObj, {
              headers: { "Content-Type": "multipart/form-data" },
            });
          } catch (uploadErr) {
            console.error("File upload failed:", uploadErr);
          }
        }
        showFeedback("Task updated successfully!", "success");
        setTimeout(() => navigate("/tasks"), 800);
      } else {
        setStatusMessage(res.data?.message || "Failed to update task.");
        showFeedback(res.data?.message || "Failed to update task.", "error");
        setLoading(false);
      }
    } catch (err) {
      const msg = err.response?.data?.message || "Server error.";
      setStatusMessage(msg);
      showFeedback(msg, "error");
      setLoading(false);
    }
  };

  const totalCompleted = (items) => items.filter((it) => it.done).length;
  const progressFor = (items) =>
    items.length ? Math.round((totalCompleted(items) / items.length) * 100) : 0;

  if (fetching) {
    return (
      <div className={styles.pageWrapper}>
        <div className={styles.sectionContent}>
          <p style={{ textAlign: "center", padding: "2rem 0" }}>
            Loading task data...
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
          <Button onClick={goBack}>Back to Tasks</Button>
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
            backgroundColor: formData.color,
            color: getReadableTextColor(formData.color),
          }}
        >
          <div className={styles.titleWordDisplay}>
            {formData.title || "Title"}
          </div>
        </div>

        <div className={styles.sectionContent}>
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

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiInfo size={16} className={styles.cardHeaderIcon} />
              <span>Task Basics</span>
            </div>
            <TaskColor
              value={formData.color}
              onChange={(color) => updateField("color", color)}
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

          <div className={styles.card}>
            <div className={styles.cardHeader}>
              <FiUsers size={16} className={styles.cardHeaderIcon} />
              <span>Visibility</span>
            </div>
            {role === "officials" && isTaskCreator ? (
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
                <span className={styles.label}>
                  VISIBILITY:{" "}
                  {formData.visibility.charAt(0).toUpperCase() +
                    formData.visibility.slice(1)}
                </span>
              </div>
            )}
          </div>

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
                          {card.items.length} items · {completed} done
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
                          className={`${styles.checklistItem} ${item.done ? styles.checklistItemCompleted : ""}`}
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
                            className={`${styles.checklistText} ${item.done ? styles.checklistTextCompleted : ""}`}
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
            <input
              type="file"
              multiple
              accept={`${ACCEPTED_ATTACHMENT_MIME_TYPES.join(",")},.pdf,.docx`}
              ref={fileInputRef}
              style={{ display: "none" }}
              onChange={handleFileChange}
            />
          </div>

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
              Assignees and collaborators are always notified by email.
            </p>
          </div>

          <div className={styles.submitBar}>
            <Button type="submit" disabled={loading}>
              {loading ? "Updating..." : "Update Task"}
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
