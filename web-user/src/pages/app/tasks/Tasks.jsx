import { useState, useEffect, useCallback, useMemo } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import { useTasksFilter } from "../../../context/TasksFilterContext";
import apiClient from "../../../api/client";
import {
  FiEdit,
  FiPlus,
  FiClock,
  FiCalendar,
  FiUser,
  FiUsers,
  FiEye,
} from "react-icons/fi";
import styles from "./Tasks.module.css";
import FeedbackModal from "../../../components/common/FeedbackModal";
import TaskCardView from "../../../components/tasks/TaskCardView";
import TaskInvitation from "../../../components/tasks/TaskInvitation";
import {
  getTaskStatus,
  TASK_STATUS_CONFIG,
  isMissedTaskInvitation,
  TASK_STATUS_SORT_ORDER,
} from "../../../utils/taskStatus";

import eventsPageStyles from "../events/Events.module.css";

import { FaRegClipboard } from "react-icons/fa";
import { LuClipboardPlus } from "react-icons/lu";

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
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

const getPriorityColor = (priority) => {
  const map = { high: "#dc2626", medium: "#f59e0b", low: "#10b981" };
  return map[priority] || "#6b7280";
};

const getInitials = (name) => {
  if (!name) return "?";
  const parts = name.trim().split(" ").filter(Boolean);
  if (parts.length > 1) return (parts[0][0] + parts[1][0]).toUpperCase();
  return parts[0]?.slice(0, 2).toUpperCase() || "?";
};

const AVATAR_COLORS = ["#f9a825", "#43a047", "#1e88e5", "#8e24aa"];
const getAvatarColor = (str) => {
  if (!str) return AVATAR_COLORS[0];
  let hash = 0;
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

export default function Tasks() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const { searchTerm, statusFilter, visibilityFilter } = useTasksFilter();

  const [activeTab, setActiveTab] = useState("all");
  const [invitedSubTab, setInvitedSubTab] = useState("pending");

  const [allStatusFilter, setAllStatusFilter] = useState("all");
  const [allPriorityFilter, setAllPriorityFilter] = useState("all");

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const [selectedTask, setSelectedTask] = useState(null);
  const [showViewModal, setShowViewModal] = useState(false);
  const [showInvitationModal, setShowInvitationModal] = useState(false);
  const [invitationMode, setInvitationMode] = useState("invite");

  const [feedback, setFeedback] = useState({ message: "", type: "success" });
  const showFeedback = (msg, type = "success") =>
    setFeedback({ message: msg, type });

  const fetchTasks = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const params = { status: "all" };
      if (searchTerm) params.search = searchTerm;
      if (visibilityFilter && visibilityFilter !== "all")
        params.visibility = visibilityFilter;
      const res = await apiClient.get("/tasks", { params });
      if (res.data.ok) setTasks(res.data.tasks || []);
      else setError("Failed to load tasks.");
    } catch (err) {
      console.error("Failed to fetch tasks:", err);
      setError("Unable to load tasks. Please try again.");
    } finally {
      setLoading(false);
    }
  }, [searchTerm, visibilityFilter]);

  useEffect(() => {
    fetchTasks();
  }, [fetchTasks]);

  const sortByDefaultOrder = (list) => {
    return [...list].sort((a, b) => {
      const rankA = TASK_STATUS_SORT_ORDER[getTaskStatus(a)];
      const rankB = TASK_STATUS_SORT_ORDER[getTaskStatus(b)];
      if (rankA !== rankB) return rankA - rankB;
      return new Date(a.deadline_datetime) - new Date(b.deadline_datetime);
    });
  };

  const filteredTasks = useMemo(() => {
    let filtered = tasks;

    if (activeTab === "created") {
      filtered = filtered.filter((t) => t.isCreator);
    } else if (activeTab === "invited") {
      if (invitedSubTab === "pending")
        filtered = filtered.filter(
          (t) =>
            !t.isCreator &&
            t.response === "pending" &&
            !isMissedTaskInvitation(t),
        );
      else if (invitedSubTab === "declined")
        filtered = filtered.filter(
          (t) => !t.isCreator && t.response === "declined",
        );
      else if (invitedSubTab === "missed")
        filtered = filtered.filter(
          (t) => !t.isCreator && isMissedTaskInvitation(t),
        );
      else filtered = filtered.filter((t) => !t.isCreator);
    } else if (activeTab === "collaboration") {
      filtered = filtered.filter((t) => t.isCollaborator);
    } else if (activeTab === "all") {
      if (allStatusFilter !== "all")
        filtered = filtered.filter((t) => getTaskStatus(t) === allStatusFilter);
      if (allPriorityFilter !== "all")
        filtered = filtered.filter((t) => t.priority === allPriorityFilter);
      filtered = sortByDefaultOrder(filtered);
    }

    return filtered;
  }, [tasks, activeTab, invitedSubTab, allStatusFilter, allPriorityFilter]);

  const handleViewTask = async (task) => {
    try {
      const res = await apiClient.get(`/tasks/${task.id}`);
      if (res.data.ok) setSelectedTask(res.data.task);
      else setSelectedTask(task);
    } catch (err) {
      console.error("Failed to fetch task details:", err);
      setSelectedTask(task);
    } finally {
      setShowViewModal(true);
    }
  };

  const handleViewInvitation = async (task, mode = "invite") => {
    try {
      const res = await apiClient.get(`/tasks/${task.id}`);
      if (res.data.ok) setSelectedTask(res.data.task);
      else setSelectedTask(task);
    } catch (err) {
      console.error("Failed to fetch task details:", err);
      setSelectedTask(task);
    } finally {
      setInvitationMode(mode);
      setShowInvitationModal(true);
    }
  };

  const handleEditTask = (taskId) => navigate(`/edit-task/${taskId}`);

  const handleRespond = async (taskId, response) => {
    try {
      await apiClient.put(`/tasks/${taskId}/respond`, { response });
      fetchTasks();
      setShowInvitationModal(false);
      showFeedback(
        response === "accepted" ? "Task accepted!" : "Task declined.",
        "success",
      );
    } catch (err) {
      console.error("Failed to respond:", err);
      showFeedback("Failed to respond to task.", "error");
    }
  };

  const handleChecklistToggle = async (itemId, isCompleted) => {
    try {
      await apiClient.put(`/tasks/checklist/${itemId}`, {
        is_completed: isCompleted,
      });
      if (selectedTask) {
        const res = await apiClient.get(`/tasks/${selectedTask.id}`);
        if (res.data.ok) setSelectedTask(res.data.task);
      }
      fetchTasks();
    } catch (err) {
      console.error("Failed to toggle checklist:", err);
      showFeedback("Failed to update checklist.", "error");
    }
  };

  const handleAddComment = async (itemId, commentText) => {
    try {
      await apiClient.post(`/tasks/checklist/${itemId}/comments`, {
        comment_text: commentText,
      });
      if (selectedTask) {
        const res = await apiClient.get(`/tasks/${selectedTask.id}`);
        if (res.data.ok) setSelectedTask(res.data.task);
      }
    } catch (err) {
      console.error("Failed to add comment:", err);
      showFeedback("Failed to add comment.", "error");
    }
  };

  const renderTaskCard = (task, variant = "all") => {
    const isCreator = task.isCreator;
    const isCollaborator = task.isCollaborator;
    const isPending = task.response === "pending";
    const isDeclined = task.response === "declined";
    const missed = isMissedTaskInvitation(task);

    const handleCardClick = () => {
      if (isPending) {
        handleViewInvitation(task, "invite");
        return;
      }
      if (isDeclined) {
        handleViewInvitation(task, "revert");
        return;
      }
      handleViewTask(task);
    };

    const showEditIcon =
      (variant === "created" || variant === "collaboration") &&
      (isCreator || isCollaborator);

    const status = getTaskStatus(task);
    const statusCfg = TASK_STATUS_CONFIG[status];

    return (
      <div
        key={task.id}
        className={styles.taskCard}
        onClick={handleCardClick}
        style={{ borderLeftColor: task.color || "#3B82F6" }}
      >
        {showEditIcon && (
          <button
            type="button"
            className={styles.editIconBtn}
            onClick={(e) => {
              e.stopPropagation();
              handleEditTask(task.id);
            }}
          >
            <FiEdit size={14} />
          </button>
        )}

        <div className={styles.cardTitle}>{task.title}</div>

        <div className={styles.cardMeta}>
          <span
            className={styles.priorityBadge}
            style={{ color: getPriorityColor(task.priority) }}
          >
            {task.priority}
          </span>
          <span className={styles.visibilityBadge}>{task.visibility}</span>
          <span
            className={`${styles.statusBadgeSmall} ${styles[statusCfg.className]}`}
          >
            {statusCfg.label}
          </span>
          {missed && (
            <span className={styles.missedBadge}>Missed Invitation</span>
          )}
        </div>

        <div className={styles.cardDetails}>
          <span>
            <FiCalendar size={14} /> {formatDate(task.deadline_datetime)}
          </span>
          <span>
            <FiClock size={14} /> {formatTime(task.deadline_datetime)}
          </span>
        </div>

        {task.assignees && task.assignees.length > 0 && (
          <div className={styles.assigneeBlock}>
            <FiUsers size={14} />
            <div className={styles.assigneeAvatars}>
              {task.assignees.slice(0, 3).map((a) => {
                const name = a.full_name || a.username || "?";
                return (
                  <span
                    key={a.id}
                    className={styles.avatarSmall}
                    style={{ background: getAvatarColor(name) }}
                  >
                    {getInitials(name)}
                  </span>
                );
              })}
              {task.assignees.length > 3 && (
                <span className={styles.avatarMore}>
                  +{task.assignees.length - 3}
                </span>
              )}
            </div>
          </div>
        )}

        <div className={styles.cardFooter}>
          {task.creator && (
            <span className={styles.creatorInfo}>
              <FiUser size={12} />{" "}
              {task.creator.full_name || task.creator.username}
            </span>
          )}
          {variant === "invited" && isPending && (
            <span className={styles.pendingBadge}>Pending</span>
          )}
        </div>
      </div>
    );
  };

  const renderContent = () => {
    if (loading) return <p className={styles.loading}>Loading tasks...</p>;
    if (error) return <p className={styles.error}>{error}</p>;

    if (activeTab === "invited") {
      const invitedAll = tasks.filter((t) => !t.isCreator);
      return (
        <div className={styles.invitedContainer}>
          <div className={styles.invitedTabs}>
            <button
              className={`${styles.invitedTab} ${invitedSubTab === "pending" ? styles.activeInvitedTab : ""}`}
              onClick={() => setInvitedSubTab("pending")}
            >
              Pending (
              {
                invitedAll.filter(
                  (t) => t.response === "pending" && !isMissedTaskInvitation(t),
                ).length
              }
              )
            </button>
            <button
              className={`${styles.invitedTab} ${invitedSubTab === "all" ? styles.activeInvitedTab : ""}`}
              onClick={() => setInvitedSubTab("all")}
            >
              All ({invitedAll.length})
            </button>
            <button
              className={`${styles.invitedTab} ${invitedSubTab === "declined" ? styles.activeInvitedTab : ""}`}
              onClick={() => setInvitedSubTab("declined")}
            >
              Declined (
              {invitedAll.filter((t) => t.response === "declined").length})
            </button>
            <button
              className={`${styles.invitedTab} ${invitedSubTab === "missed" ? styles.activeInvitedTab : ""}`}
              onClick={() => setInvitedSubTab("missed")}
            >
              Missed (
              {invitedAll.filter((t) => isMissedTaskInvitation(t)).length})
            </button>
          </div>
          <div className={styles.taskList}>
            {filteredTasks.length === 0 ? (
              <div className={eventsPageStyles.emptyStateBox}>
                <LuClipboardPlus size={40} />
                <p>No {invitedSubTab} task invitations.</p>
              </div>
            ) : (
              filteredTasks.map((task) => renderTaskCard(task, "invited"))
            )}
          </div>
        </div>
      );
    }

    return (
      <>
        {activeTab === "all" && (
          <div className={styles.subFilterRow}>
            <select
              className={styles.subFilterSelect}
              value={allStatusFilter}
              onChange={(e) => setAllStatusFilter(e.target.value)}
            >
              <option value="all">All Status</option>
              <option value="ongoing">Ongoing</option>
              <option value="completed">Completed</option>
              <option value="missed">Missed</option>
            </select>
            <select
              className={styles.subFilterSelect}
              value={allPriorityFilter}
              onChange={(e) => setAllPriorityFilter(e.target.value)}
            >
              <option value="all">All Priority</option>
              <option value="high">High</option>
              <option value="medium">Medium</option>
              <option value="low">Low</option>
            </select>
          </div>
        )}

        {filteredTasks.length === 0 ? (
          <div className={eventsPageStyles.emptyStateBox}>
            <FaRegClipboard size={40} />
            <p>No tasks found.</p>
            <button
              className={styles.createBtn}
              onClick={() => navigate("/create-task")}
            >
              <FiPlus size={18} /> Create Task
            </button>
          </div>
        ) : (
          <div className={styles.taskList}>
            {filteredTasks.map((task) => renderTaskCard(task, activeTab))}
          </div>
        )}
      </>
    );
  };

  return (
    <div className={styles.container}>
      <div className={styles.tabs}>
        <button
          className={`${styles.tab} ${activeTab === "all" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("all")}
        >
          <FiEye size={16} /> All
        </button>
        <button
          className={`${styles.tab} ${activeTab === "invited" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("invited")}
        >
          <FiCalendar size={16} /> Invited
        </button>
        <button
          className={`${styles.tab} ${activeTab === "created" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("created")}
        >
          <FiEdit size={16} /> Created
        </button>
        <button
          className={`${styles.tab} ${activeTab === "collaboration" ? styles.activeTab : ""}`}
          onClick={() => setActiveTab("collaboration")}
        >
          <FiUsers size={16} />
          Collaboration
        </button>
      </div>

      <div className={styles.content}>{renderContent()}</div>

      <TaskCardView
        isOpen={showViewModal}
        onClose={() => {
          setShowViewModal(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onChecklistToggle={handleChecklistToggle}
        onAddComment={handleAddComment}
        currentUserId={user?.id}
      />

      <TaskInvitation
        isOpen={showInvitationModal}
        onClose={() => {
          setShowInvitationModal(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onRespond={handleRespond}
        mode={invitationMode}
      />

      <FeedbackModal
        message={feedback.message}
        type={feedback.type}
        onClose={() => setFeedback({ message: "", type: "success" })}
      />
    </div>
  );
}
