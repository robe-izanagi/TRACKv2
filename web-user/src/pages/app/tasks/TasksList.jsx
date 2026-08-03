import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../../context/AuthContext";
import apiClient from "../../../api/client";
import {
  IoIosArrowForward,
  IoIosArrowBack,
  IoIosArrowUp,
  IoIosArrowDown,
} from "react-icons/io";
import { FiEye, FiEdit, FiUsers, FiCheckCircle } from "react-icons/fi";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import SearchOutlinedIcon from "@mui/icons-material/SearchOutlined";
import PendingActionsOutlinedIcon from "@mui/icons-material/PendingActionsOutlined";
import TaskOutlinedIcon from "@mui/icons-material/TaskOutlined";
import SelectDropdown from "../../../components/common/SelectDropdown";
import styles from "../officials/Home.module.css";
import taskStyles from "./TaskList.module.css";

// ─── Helper Functions ──────────────────────────────────
const getPriorityClass = (priority) => {
  switch ((priority || "").toLowerCase()) {
    case "high":
      return styles.priorityHigh;
    case "medium":
      return styles.priorityMedium;
    case "low":
      return styles.priorityLow;
    default:
      return styles.priorityDefault;
  }
};

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
  const d = new Date(dateStr);
  return d.toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" });
};

const formatMonthYear = (date) =>
  date.toLocaleString("en-US", { month: "short", year: "numeric" });

const getVisibilityBadge = (visibility) => {
  switch ((visibility || "").toLowerCase()) {
    case "personal":
      return "Personal";
    case "department":
      return "Department";
    case "campus":
      return "Campus";
    default:
      return visibility;
  }
};

const getPriorityBadgeColor = (priority) => {
  switch ((priority || "").toLowerCase()) {
    case "high":
      return "#dc2626";
    case "medium":
      return "#f59e0b";
    case "low":
      return "#10b981";
    default:
      return "#6b7280";
  }
};

export default function TasksList() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ─── Tab Management ────────────────────────────────
  const [activeTab, setActiveTab] = useState("all");
  const [invitedSubTab, setInvitedSubTab] = useState("pending");

  // ─── Task Data States ──────────────────────────────
  const [allTasks, setAllTasks] = useState([]);
  const [createdTasks, setCreatedTasks] = useState([]);
  const [invitedTasks, setInvitedTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // ─── Filter & Search States ───────────────────────
  const [searchTerm, setSearchTerm] = useState("");
  const [labelFilter, setLabelFilter] = useState("all");
  const [completionFilter, setCompletionFilter] = useState("all");
  const [sortDirection, setSortDirection] = useState("asc");
  const [displayDate, setDisplayDate] = useState(new Date());

  // ─── Modal States ─────────────────────────────────
  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskDetailModal, setShowTaskDetailModal] = useState(false);

  // ─── Fetch All Tasks ──────────────────────────────
  const fetchAllTasks = useCallback(async () => {
    try {
      const res = await apiClient.get("/tasks", {
        params: {
          visibility: "all",
        },
      });
      if (res.data?.ok) {
        setAllTasks(res.data.tasks || []);
      }
    } catch (err) {
      console.error("Failed to fetch all tasks:", err);
      setError("Failed to load tasks");
    }
  }, []);

  // ─── Fetch Created Tasks ──────────────────────────
  const fetchCreatedTasks = useCallback(async () => {
    try {
      const res = await apiClient.get("/tasks", {
        params: {
          creator: user?.id,
        },
      });
      if (res.data?.ok) {
        setCreatedTasks(res.data.tasks || []);
      }
    } catch (err) {
      console.error("Failed to fetch created tasks:", err);
    }
  }, [user?.id]);

  // ─── Fetch Invited Tasks ──────────────────────────
  const fetchInvitedTasks = useCallback(async () => {
    try {
      const res = await apiClient.get("/tasks/invited");
      if (res.data?.ok) {
        setInvitedTasks(res.data.tasks || []);
      }
    } catch (err) {
      console.error("Failed to fetch invited tasks:", err);
    }
  }, []);

  // ─── Initial Data Load ─────────────────────────────
  useEffect(() => {
    const loadData = async () => {
      setLoading(true);
      try {
        await Promise.all([
          fetchAllTasks(),
          fetchCreatedTasks(),
          fetchInvitedTasks(),
        ]);
      } catch (err) {
        setError("Failed to load tasks");
      } finally {
        setLoading(false);
      }
    };
    loadData();
  }, [fetchAllTasks, fetchCreatedTasks, fetchInvitedTasks]);

  // ─── Handle View Task Detail ───────────────────────
  const handleViewTask = async (task) => {
    try {
      const res = await apiClient.get(`/tasks/${task.id}`);
      if (res.data?.ok) {
        setSelectedTask(res.data.task);
        setShowTaskDetailModal(true);
      }
    } catch (err) {
      console.error("Failed to fetch task details:", err);
    }
  };

  // ─── Handle Edit Task ──────────────────────────────
  const handleEditTask = (taskId) => {
    navigate(`/edit-task/${taskId}`);
  };

  // ─── Handle Respond to Invitation ──────────────────
  const handleRespondToTask = async (taskId, response) => {
    try {
      const res = await apiClient.put(`/tasks/${taskId}/respond`, {
        response,
      });
      if (res.data?.ok) {
        // Refresh invited tasks
        await fetchInvitedTasks();
      }
    } catch (err) {
      console.error("Failed to respond to task:", err);
    }
  };

  // ─── Handle Delete Task ────────────────────────────
  const handleDeleteTask = async (taskId) => {
    if (!window.confirm("Are you sure you want to delete this task?")) {
      return;
    }
    try {
      const res = await apiClient.delete(`/tasks/${taskId}`);
      if (res.data?.ok) {
        // Refresh task lists
        await Promise.all([
          fetchAllTasks(),
          fetchCreatedTasks(),
          fetchInvitedTasks(),
        ]);
      }
    } catch (err) {
      console.error("Failed to delete task:", err);
    }
  };

  // ─── Filter Tasks ─────────────────────────────────
  const isTaskCompleted = (task) => {
    if (typeof task.is_completed === "boolean") {
      return task.is_completed;
    }
    if (
      Array.isArray(task.checklist_items) &&
      task.checklist_items.length > 0
    ) {
      return task.checklist_items.every((item) => item.is_completed);
    }
    return false;
  };

  const filterTasks = useCallback(
    (tasks) => {
      let filtered = tasks;

      // Search filter
      if (searchTerm.trim()) {
        const value = searchTerm.trim().toLowerCase();
        filtered = filtered.filter(
          (task) =>
            task.title.toLowerCase().includes(value) ||
            task.description?.toLowerCase().includes(value),
        );
      }

      // Completion filter
      if (completionFilter !== "all") {
        const completed = completionFilter === "completed";
        filtered = filtered.filter(
          (task) => isTaskCompleted(task) === completed,
        );
      }

      // Priority filter
      if (labelFilter !== "all") {
        filtered = filtered.filter(
          (task) => (task.priority || "").toLowerCase() === labelFilter,
        );
      }

      // Sort by deadline
      filtered.sort((a, b) => {
        const aDate = new Date(a.deadline_datetime).getTime();
        const bDate = new Date(b.deadline_datetime).getTime();
        if (sortDirection === "asc") {
          return aDate - bDate;
        }
        return bDate - aDate;
      });

      return filtered;
    },
    [searchTerm, completionFilter, labelFilter, sortDirection],
  );

  // ─── Get Current Tasks Based on Tab ────────────────
  const getCurrentTasks = () => {
    switch (activeTab) {
      case "created":
        return filterTasks(createdTasks);
      case "invited":
        return filterTasks(
          invitedTasks.filter((task) => {
            if (invitedSubTab === "pending") {
              return task.response === "pending";
            }
            if (invitedSubTab === "accepted") {
              return task.response === "accepted";
            }
            if (invitedSubTab === "declined") {
              return task.response === "declined";
            }
            return true;
          }),
        );
      case "collaborators":
        return filterTasks(allTasks.filter((task) => task.isCollaborator));
      default:
        return filterTasks(allTasks);
    }
  };

  // ─── Calculate Counts ─────────────────────────────
  const pendingInvitedCount = invitedTasks.filter(
    (t) => t.response === "pending",
  ).length;
  const acceptedInvitedCount = invitedTasks.filter(
    (t) => t.response === "accepted",
  ).length;
  const declinedInvitedCount = invitedTasks.filter(
    (t) => t.response === "declined",
  ).length;
  const collaboratorCount = allTasks.filter(
    (task) => task.isCollaborator,
  ).length;

  const currentTasks = getCurrentTasks();

  // ─── Navigation Handlers ──────────────────────────
  const handlePrevDate = () => {
    const next = new Date(displayDate);
    next.setMonth(next.getMonth() - 1);
    setDisplayDate(next);
  };

  const handleNextDate = () => {
    const next = new Date(displayDate);
    next.setMonth(next.getMonth() + 1);
    setDisplayDate(next);
  };

  // ─── Render Task Card ─────────────────────────────
  const renderTaskCard = (task) => {
    let checklistCompleted = 0;
    let checklistTotal = 0;

    if (task.checklist && Array.isArray(task.checklist)) {
      checklistTotal = task.checklist.length;
      checklistCompleted = task.checklist.filter(
        (item) => item.is_completed,
      ).length;
    }

    const pct =
      checklistTotal > 0
        ? Math.round((checklistCompleted / checklistTotal) * 100)
        : 0;

    return (
      <div
        key={task.id}
        className={`${styles.taskCard} ${getPriorityClass(task.priority)}`}
        onClick={() => handleViewTask(task)}
        style={{ cursor: "pointer" }}
      >
        <div className={styles.taskCardTop}>
          <span className={styles.taskCheckbox} />
          {task.priority && (
            <span
              className={styles.priorityBadge}
              style={{
                backgroundColor: getPriorityBadgeColor(task.priority),
                color: "#fff",
              }}
            >
              {task.priority}
            </span>
          )}
        </div>

        <h4 className={styles.taskTitle}>{task.title}</h4>

        <div className={styles.taskMetaRow}>
          <span className={styles.taskMetaItem}>
            <AccessTimeOutlinedIcon fontSize="small" />
            {formatDate(task.deadline_datetime)}
          </span>
        </div>

        <div className={styles.taskMetaRow}>
          <span className={styles.taskMetaItem}>
            <VisibilityOutlinedIcon fontSize="small" />
            {getVisibilityBadge(task.visibility)}
          </span>
        </div>

        <p className={styles.taskDesc}>
          {task.description?.substring(0, 100)}
          {task.description?.length > 100 ? "..." : ""}
        </p>

        {checklistTotal > 0 && (
          <>
            <div className={styles.checklistRow}>
              <span className={styles.checklistLabel}>
                <ChecklistOutlinedIcon fontSize="small" />
                Checklist Progress
              </span>
              <span className={styles.checklistFraction}>
                {checklistCompleted}/{checklistTotal}
              </span>
            </div>
            <div className={styles.progressBarTrack}>
              <div
                className={styles.progressBarFill}
                style={{ width: `${pct}%` }}
              />
            </div>
          </>
        )}
      </div>
    );
  };

  // ─── Render Content Based on Tab ───────────────────
  const renderContent = () => {
    if (loading) {
      return <p className={styles.noData}>Loading tasks...</p>;
    }

    if (error) {
      return (
        <p className={styles.noData} style={{ color: "#dc2626" }}>
          {error}
        </p>
      );
    }

    if (activeTab === "invited") {
      return (
        <div className={taskStyles.invitedContainer}>
          <div className={taskStyles.invitedTabs}>
            <button
              className={`${taskStyles.invitedTab} ${
                invitedSubTab === "pending" ? taskStyles.activeInvitedTab : ""
              }`}
              onClick={() => setInvitedSubTab("pending")}
            >
              Pending ({pendingInvitedCount})
            </button>
            <button
              className={`${taskStyles.invitedTab} ${
                invitedSubTab === "accepted" ? taskStyles.activeInvitedTab : ""
              }`}
              onClick={() => setInvitedSubTab("accepted")}
            >
              Accepted ({acceptedInvitedCount})
            </button>
            <button
              className={`${taskStyles.invitedTab} ${
                invitedSubTab === "declined" ? taskStyles.activeInvitedTab : ""
              }`}
              onClick={() => setInvitedSubTab("declined")}
            >
              Declined ({declinedInvitedCount})
            </button>
          </div>

          {currentTasks.length === 0 ? (
            <p className={taskStyles.noData}>No tasks in this category</p>
          ) : (
            <div className={styles.upcomingList}>
              {currentTasks.map((task) => (
                <div key={task.id}>
                  {renderTaskCard(task)}
                  {task.response === "pending" && (
                    <div className={taskStyles.invitationActions}>
                      <button
                        className={taskStyles.acceptButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRespondToTask(task.id, "accepted");
                        }}
                      >
                        Accept
                      </button>
                      <button
                        className={taskStyles.declineButton}
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRespondToTask(task.id, "declined");
                        }}
                      >
                        Decline
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      );
    }

    if (currentTasks.length === 0) {
      return <p className={styles.noData}>No tasks available</p>;
    }

    return (
      <div className={styles.upcomingList}>
        {currentTasks.map((task) => renderTaskCard(task))}
      </div>
    );
  };

  return (
    <div className={styles.mainContainer}>
      {/* ─── Tabs ─── */}
      <div className={taskStyles.tabs}>
        <button
          className={`${taskStyles.tab} ${activeTab === "all" ? taskStyles.activeTab : ""}`}
          onClick={() => setActiveTab("all")}
        >
          <FiEye size={16} /> All Tasks
        </button>
        <button
          className={`${taskStyles.tab} ${activeTab === "invited" ? taskStyles.activeTab : ""}`}
          onClick={() => setActiveTab("invited")}
        >
          <FiUsers size={16} /> Invited
        </button>
        <button
          className={`${taskStyles.tab} ${activeTab === "created" ? taskStyles.activeTab : ""}`}
          onClick={() => setActiveTab("created")}
        >
          <FiEdit size={16} /> Created
        </button>
        <button
          className={`${taskStyles.tab} ${activeTab === "collaborators" ? taskStyles.activeTab : ""}`}
          onClick={() => setActiveTab("collaborators")}
        >
          <FiCheckCircle size={16} /> Collaborators ({collaboratorCount})
        </button>
      </div>

      {/* ─── Controls ─── */}
      <div className={taskStyles.taskControls}>
        <div className={taskStyles.searchRow}>
          <div className={taskStyles.searchInputWrapper}>
            <SearchOutlinedIcon className={taskStyles.searchIcon} />
            <input
              type="search"
              placeholder="Search tasks..."
              className={taskStyles.searchInput}
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
        </div>

        <div className={taskStyles.dropdownRow}>
          <div className={taskStyles.selectGroup}>
            <SelectDropdown
              label="Filter by: Label"
              options={[
                { value: "all", label: "All Label" },
                { value: "high", label: "High" },
                { value: "medium", label: "Medium" },
                { value: "low", label: "Low" },
              ]}
              value={labelFilter}
              onChange={(e) => setLabelFilter(e.target.value)}
            />
          </div>
          <div className={taskStyles.selectGroup}>
            <SelectDropdown
              label="Filter by: Status"
              options={[
                { value: "all", label: "All Status" },
                { value: "completed", label: "Completed" },
                { value: "not_completed", label: "Not Completed" },
              ]}
              value={completionFilter}
              onChange={(e) => setCompletionFilter(e.target.value)}
            />
          </div>
          <button
            type="button"
            className={taskStyles.directionToggle}
            onClick={() =>
              setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
            }
          >
            <span className={taskStyles.directionLabel}>
              {sortDirection === "asc" ? "Ascending" : "Descending"}
            </span>
            {sortDirection === "asc" ? <IoIosArrowUp /> : <IoIosArrowDown />}
          </button>
        </div>
      </div>

      {/* ─── Content ─── */}
      {renderContent()}

      {/* ─── Task Detail Modal (Placeholder) ─── */}
      {showTaskDetailModal && selectedTask && (
        <div
          className={taskStyles.modalOverlay}
          onClick={() => setShowTaskDetailModal(false)}
        >
          <div
            className={taskStyles.modalContent}
            onClick={(e) => e.stopPropagation()}
          >
            <div className={taskStyles.modalHeader}>
              <h2>{selectedTask.title}</h2>
              <button
                className={taskStyles.modalCloseButton}
                onClick={() => setShowTaskDetailModal(false)}
              >
                ✕
              </button>
            </div>
            <div className={taskStyles.modalBody}>
              <p>
                <strong>Description:</strong> {selectedTask.description}
              </p>
              <p>
                <strong>Deadline:</strong>{" "}
                {formatDate(selectedTask.deadline_datetime)}
              </p>
              <p>
                <strong>Priority:</strong> {selectedTask.priority}
              </p>
              <p>
                <strong>Visibility:</strong>{" "}
                {getVisibilityBadge(selectedTask.visibility)}
              </p>
            </div>
            <div className={taskStyles.modalFooter}>
              <button
                className={taskStyles.editButton}
                onClick={() => {
                  handleEditTask(selectedTask.id);
                  setShowTaskDetailModal(false);
                }}
              >
                Edit Task
              </button>
              <button
                className={taskStyles.deleteButton}
                onClick={() => {
                  handleDeleteTask(selectedTask.id);
                  setShowTaskDetailModal(false);
                }}
              >
                Delete Task
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
