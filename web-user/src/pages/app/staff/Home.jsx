import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { IoIosArrowForward, IoIosArrowBack } from "react-icons/io";
import apiClient from "../../../api/client";
import { useAuth } from "../../../context/AuthContext";
import styles from "./Home.module.css";
import { FaCalendarAlt, FaClipboard } from "react-icons/fa";
import {
  FiLink,
  FiCopy,
  FiAlertTriangle,
  FiChevronDown,
  FiCalendar,
  FiClock,
} from "react-icons/fi";

import CalendarTodayIcon from "@mui/icons-material/CalendarToday";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";
import CheckCircleOutlineOutlinedIcon from "@mui/icons-material/CheckCircleOutlineOutlined";
import CancelOutlinedIcon from "@mui/icons-material/CancelOutlined";
import EventBusyOutlinedIcon from "@mui/icons-material/EventBusyOutlined";
import EventRepeatOutlinedIcon from "@mui/icons-material/EventRepeatOutlined";
import ReportProblemOutlinedIcon from "@mui/icons-material/ReportProblemOutlined";
import TrendingUpOutlinedIcon from "@mui/icons-material/TrendingUpOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import InsertChartOutlinedIcon from "@mui/icons-material/InsertChartOutlined";
import SelectDropdown from "../../../components/common/SelectDropdown";

import EventCardView from "../../../components/events/EventCardView";
import AttendeesModal from "../../../components/events/AttendeesModal";
import ConflictCardEvent from "../../../components/events/ConflictCardEvent";
import TaskCardView from "../../../components/tasks/TaskCardView";
import {
  getEventStatus,
  EVENT_STATUS_CONFIG,
} from "../../../utils/eventStatus";

// ── Helpers ──
const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

const formatMonthDay = (dateStr) => {
  const d = new Date(dateStr);
  const month = d.toLocaleString("en-US", { month: "short" });
  const day = d.getDate();
  return { month, day };
};

const formatTime = (dateStr) => {
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
  for (let i = 0; i < str.length; i++)
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  return AVATAR_COLORS[Math.abs(hash) % AVATAR_COLORS.length];
};

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

const EVENT_STAT_CONFIG = [
  {
    key: "active_events",
    label: "Active Events",
    color: styles.statGreen,
    Icon: CalendarTodayIcon,
  },
  {
    key: "accepted",
    label: "Accepted",
    color: styles.statGreen,
    Icon: CheckCircleOutlineOutlinedIcon,
  },
  {
    key: "declined",
    label: "Declined",
    color: styles.statMaroon,
    Icon: CancelOutlinedIcon,
  },
  {
    key: "missed",
    label: "Missed",
    color: styles.statDarkred,
    Icon: EventBusyOutlinedIcon,
  },
  {
    key: "pending",
    label: "Pending",
    color: styles.statGold,
    Icon: EventRepeatOutlinedIcon,
  },
  {
    key: "conflicted",
    label: "Conflicted",
    color: styles.statMaroon,
    Icon: ReportProblemOutlinedIcon,
  },
];

const TASK_STAT_CONFIG = [
  { key: "completed", label: "Completed", color: styles.statGreen },
  { key: "missed", label: "Missed", color: styles.statDarkred },
  { key: "pending", label: "Pending", color: styles.statGold },
];

const STAT_TYPE_OPTIONS = [
  { value: "all", label: "All" },
  { value: "campus", label: "Campus" },
  { value: "department", label: "Department" },
  { value: "private", label: "Private" },
  { value: "task", label: "Tasks" },
];

// ── Reusable empty state (icon + title + subtitle) instead of a bare
// "No data" text string. ──
const EmptyState = ({ icon: Icon, title, subtitle }) => (
  <div className={styles.emptyState}>
    <div className={styles.emptyStateIconWrap}>
      <Icon fontSize="medium" />
    </div>
    <p className={styles.emptyStateTitle}>{title}</p>
    {subtitle && <p className={styles.emptyStateSubtitle}>{subtitle}</p>}
  </div>
);

// ── Real spinning loader (replaces the plain "Loading..." text) ──
const Spinner = ({ size = 14, light = false, className = "" }) => (
  <span
    role="status"
    aria-label="Loading"
    className={`${styles.spinner} ${light ? styles.spinnerLight : ""} ${className}`}
    style={{ width: size, height: size }}
  />
);

// ── Skeleton building blocks — shimmer placeholders shaped like the real
// content, shown instead of the word "Loading...". ──
const SkeletonBar = ({
  w = "100%",
  h = 14,
  r = 8,
  style,
  tone = "default",
}) => (
  <div
    className={`${styles.skeleton} ${tone === "light" ? styles.skeletonLight : ""}`}
    style={{ width: w, height: h, borderRadius: r, ...style }}
  />
);

// Mirrors a single .statItem (icon box + label + number)
const StatItemSkeleton = () => (
  <div className={styles.statItem}>
    <SkeletonBar w={40} h={40} r={11} style={{ flexShrink: 0 }} />
    <div className={styles.statTextWrap} style={{ width: "100%" }}>
      <SkeletonBar w="65%" h={9} />
      <SkeletonBar w={40} h={18} style={{ marginTop: 6 }} />
    </div>
  </div>
);

// Mirrors the whole Quick Stats block — either the event layout
// (primary card + Responses / Action Needed / Post Event sections)
// or the simple 3-card task layout — depending on the active filter.
const StatsSkeleton = ({ type }) => {
  if (type === "task") {
    return (
      <div className={styles.statsGrid}>
        <StatItemSkeleton />
        <StatItemSkeleton />
        <StatItemSkeleton />
      </div>
    );
  }

  return (
    <div className={styles.statsGridWrapper}>
      <div className={`${styles.statItem} ${styles.statPrimary}`}>
        <SkeletonBar
          w={40}
          h={40}
          r={11}
          tone="light"
          style={{ flexShrink: 0 }}
        />
        <div className={styles.statTextWrap} style={{ width: "100%" }}>
          <SkeletonBar w={120} h={9} tone="light" />
          <SkeletonBar w={64} h={22} tone="light" style={{ marginTop: 8 }} />
        </div>
        <SkeletonBar
          w={34}
          h={34}
          r={10}
          tone="light"
          style={{ flexShrink: 0 }}
        />
      </div>

      <div className={styles.sectionContainer}>
        <SkeletonBar w={86} h={10} style={{ marginBottom: 10 }} />
        <div className={styles.twoColGrid}>
          <StatItemSkeleton />
          <StatItemSkeleton />
        </div>
      </div>

      <div className={styles.sectionContainer}>
        <SkeletonBar w={112} h={10} style={{ marginBottom: 10 }} />
        <div className={styles.twoColGrid}>
          <StatItemSkeleton />
          <StatItemSkeleton />
        </div>
      </div>

      <div className={styles.sectionContainer}>
        <SkeletonBar w={94} h={10} style={{ marginBottom: 10 }} />
        <div className={styles.oneColGrid}>
          <StatItemSkeleton />
        </div>
      </div>
    </div>
  );
};

// Mirrors the featured Today's Event card: badges row + title,
// description lines, the 3-box info grid, and the action button.
const TodayEventSkeleton = () => (
  <div className={styles.featuredCard}>
    <div className={styles.badgesStatus}>
      <div className={styles.badgeRow}>
        <SkeletonBar w={72} h={22} r={999} />
        <SkeletonBar w={58} h={22} r={999} />
        <SkeletonBar w={66} h={22} r={999} />
        <SkeletonBar w={54} h={22} r={999} />
        <SkeletonBar w={78} h={22} r={999} />
      </div>
      <SkeletonBar w="55%" h={26} style={{ marginTop: 2 }} />
    </div>

    <div className={styles.featuredCardContent}>
      <div className={styles.titleDescription}>
        <SkeletonBar w="95%" h={12} style={{ marginBottom: 6 }} />
        <SkeletonBar w="72%" h={12} />
      </div>

      <div className={styles.container8}>
        <div className={styles.whenWhereGroup}>
          <div className={styles.sectionHeader}>
            <SkeletonBar w={16} h={16} r={4} />
            <SkeletonBar w={92} h={10} />
          </div>
          <div className={styles.infoGrid}>
            <SkeletonBar h={56} r={11} />
            <SkeletonBar h={56} r={11} />
            <SkeletonBar h={56} r={11} />
          </div>
        </div>

        <div className={styles.organizerSection}>
          <div className={styles.sectionHeader}>
            <SkeletonBar w={16} h={16} r={4} />
            <SkeletonBar w={78} h={10} />
          </div>
          <div className={styles.organizerRow}>
            <SkeletonBar w={44} h={44} r={13} style={{ flexShrink: 0 }} />
            <div
              style={{
                flex: 1,
                minWidth: 0,
                display: "flex",
                flexDirection: "column",
                gap: 6,
              }}
            >
              <SkeletonBar w="70%" h={12} />
              <SkeletonBar w="50%" h={10} />
            </div>
          </div>
          <SkeletonBar w="100%" h={32} r={9} />
          <SkeletonBar w="100%" h={32} r={9} />
        </div>

        <div className={styles.audienceSection}>
          <div className={styles.sectionHeader}>
            <SkeletonBar w={16} h={16} r={4} />
            <SkeletonBar w={68} h={10} />
          </div>
          <div className={styles.audienceRow}>
            <div style={{ display: "flex" }}>
              <SkeletonBar
                w={32}
                h={32}
                r={999}
                style={{ border: "2px solid #fff" }}
              />
              <SkeletonBar
                w={32}
                h={32}
                r={999}
                style={{ marginLeft: -9, border: "2px solid #fff" }}
              />
              <SkeletonBar
                w={32}
                h={32}
                r={999}
                style={{ marginLeft: -9, border: "2px solid #fff" }}
              />
            </div>
            <SkeletonBar w="60%" h={10} />
          </div>
          <SkeletonBar w="100%" h={38} r={10} />
        </div>
      </div>

      <SkeletonBar w="100%" h={42} r={10} style={{ marginTop: "0.9rem" }} />
    </div>
  </div>
);

// Mirrors a single .upcomingItem row (date card + title/desc/meta + chevron)
const EventRowSkeleton = () => (
  <div className={styles.upcomingItem}>
    <SkeletonBar w={52} h={58} r={11} style={{ flexShrink: 0 }} />
    <div
      style={{
        flex: 1,
        minWidth: 0,
        display: "flex",
        flexDirection: "column",
        gap: 6,
      }}
    >
      <SkeletonBar w="55%" h={13} />
      <SkeletonBar w="85%" h={11} />
      <div style={{ display: "flex", gap: 10 }}>
        <SkeletonBar w={48} h={10} />
        <SkeletonBar w={64} h={10} />
        <SkeletonBar w={42} h={10} />
      </div>
    </div>
    <SkeletonBar w={28} h={28} r={9} style={{ flexShrink: 0 }} />
  </div>
);

// Mirrors a single .taskCard (checkbox + priority badge, title, meta rows,
// checklist row + progress bar)
const TaskCardSkeleton = () => (
  <div className={styles.taskCard} style={{ cursor: "default" }}>
    <div className={styles.taskCardTop}>
      <SkeletonBar w={19} h={19} r={999} />
      <SkeletonBar w={74} h={18} r={999} />
    </div>
    <SkeletonBar w="75%" h={13} style={{ marginTop: 2 }} />
    <SkeletonBar w="55%" h={10} />
    <SkeletonBar w="40%" h={10} />
    <SkeletonBar w="90%" h={10} />
    <div
      style={{
        display: "flex",
        alignItems: "center",
        justifyContent: "space-between",
        marginTop: "auto",
      }}
    >
      <SkeletonBar w={100} h={9} />
      <SkeletonBar w={28} h={9} />
    </div>
    <SkeletonBar w="100%" h={6} r={999} />
  </div>
);

function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [fullUser, setFullUser] = useState(null);

  useEffect(() => {
    const fetchFullProfile = async () => {
      try {
        const { data } = await apiClient.get("/auth/me");
        if (data.ok) setFullUser(data.user);
        else setFullUser(user);
      } catch (err) {
        console.error("Failed to fetch full profile:", err);
        setFullUser(user);
      }
    };
    fetchFullProfile();
  }, [user]);

  // ── Quick Stats ──
  const [statTypeFilter, setStatTypeFilter] = useState("all");
  const [quickStats, setQuickStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);

  // ── Today's Events ──
  const [todayEvents, setTodayEvents] = useState([]);
  const [todayLoading, setTodayLoading] = useState(false);
  const [currentTodayIndex, setCurrentTodayIndex] = useState(0);
  const [todayTouchStartX, setTodayTouchStartX] = useState(0);
  const [copiedLinkId, setCopiedLinkId] = useState(null);

  // ── Upcoming Events ──
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [upcomingEventsLoading, setUpcomingEventsLoading] = useState(false);
  const [upcomingEventsOffset, setUpcomingEventsOffset] = useState(0);
  const [upcomingEventsHasMore, setUpcomingEventsHasMore] = useState(true);
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [eventDurationFilter, setEventDurationFilter] = useState("all");

  // ── Ongoing Tasks (real data) ──
  const [allOngoingTasks, setAllOngoingTasks] = useState([]);
  const [upcomingTasksLoading, setUpcomingTasksLoading] = useState(false);
  const [upcomingTasksLimit, setUpcomingTasksLimit] = useState(4);
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [taskDurationFilter, setTaskDurationFilter] = useState("all");

  // ── Modals ──
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [showEventModal, setShowEventModal] = useState(false);
  const [showAttendeesModal, setShowAttendeesModal] = useState(false);
  const [conflictEvent, setConflictEvent] = useState(null);
  const [showConflictModal, setShowConflictModal] = useState(false);

  const [selectedTask, setSelectedTask] = useState(null);
  const [showTaskModal, setShowTaskModal] = useState(false);

  // ── Quick Stats fetch ──
  const fetchQuickStats = useCallback(async (type) => {
    setStatsLoading(true);
    try {
      if (type === "task") {
        const res = await apiClient.get("/tasks", {
          params: { status: "all" },
        });
        if (res.data.ok) {
          const tasks = res.data.tasks || [];
          const completed = tasks.filter((t) => t.is_completed).length;
          const missed = tasks.filter(
            (t) =>
              !t.is_completed && new Date(t.deadline_datetime) < new Date(),
          ).length;
          const pending = tasks.filter(
            (t) =>
              !t.is_completed && new Date(t.deadline_datetime) >= new Date(),
          ).length;
          setQuickStats({ completed, missed, pending });
        }
        setStatsLoading(false);
        return;
      }
      const res = await apiClient.get(`/events/stats?type=${type}`);
      if (res.data.ok) setQuickStats(res.data.stats);
    } catch (err) {
      console.error("Failed to fetch quick stats:", err);
      setQuickStats(null);
    } finally {
      setStatsLoading(false);
    }
  }, []);

  const fetchTodayEvents = useCallback(async () => {
    setTodayLoading(true);
    try {
      const res = await apiClient.get("/events/today");
      if (res.data.ok) {
        setTodayEvents(res.data.events || []);
        setCurrentTodayIndex(0);
      } else setTodayEvents([]);
    } catch (err) {
      console.error("Failed to fetch today's events:", err);
      setTodayEvents([]);
    } finally {
      setTodayLoading(false);
    }
  }, []);

  const fetchUpcomingEvents = useCallback(
    async (reset = true) => {
      const offset = reset ? 0 : upcomingEventsOffset;
      setUpcomingEventsLoading(true);
      try {
        const res = await apiClient.get(
          `/events/upcoming?limit=4&offset=${offset}`,
        );
        if (res.data.ok) {
          if (reset) {
            setUpcomingEvents(res.data.events);
            setUpcomingEventsOffset(4);
            setUpcomingEventsHasMore(res.data.events.length === 4);
          } else {
            setUpcomingEvents((prev) => [...prev, ...res.data.events]);
            setUpcomingEventsOffset((prev) => prev + 4);
            setUpcomingEventsHasMore(res.data.events.length === 4);
          }
        }
      } catch (err) {
        console.error("Failed to fetch upcoming events:", err);
        if (reset) {
          setUpcomingEvents([]);
          setUpcomingEventsHasMore(false);
        }
      } finally {
        setUpcomingEventsLoading(false);
      }
    },
    [upcomingEventsOffset],
  );

  const fetchOngoingTasks = useCallback(async () => {
    setUpcomingTasksLoading(true);
    try {
      const res = await apiClient.get("/tasks", {
        params: { status: "ongoing" },
      });
      if (res.data.ok) {
        setAllOngoingTasks(res.data.tasks || []);
        setUpcomingTasksLimit(4);
      } else {
        setAllOngoingTasks([]);
      }
    } catch (err) {
      console.error("Failed to fetch ongoing tasks:", err);
      setAllOngoingTasks([]);
    } finally {
      setUpcomingTasksLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchQuickStats(statTypeFilter);
  }, [statTypeFilter, fetchQuickStats]);

  useEffect(() => {
    fetchTodayEvents();
    fetchUpcomingEvents(true);
    fetchOngoingTasks();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleShowMoreEvents = () => fetchUpcomingEvents(false);
  const handleShowMoreTasks = () => setUpcomingTasksLimit((prev) => prev + 4);

  const gotoCalendar = () => navigate("/calendar");
  const gotoAnalytics = () => navigate("/profile");
  const gotoTaskLists = () => navigate("/tasks");

  const handleTodayPrev = () =>
    setCurrentTodayIndex((prev) =>
      prev === 0 ? todayEvents.length - 1 : prev - 1,
    );
  const handleTodayNext = () =>
    setCurrentTodayIndex((prev) =>
      prev === todayEvents.length - 1 ? 0 : prev + 1,
    );
  const handleTodayTouchStart = (e) =>
    setTodayTouchStartX(e.touches[0].clientX);
  const handleTodayTouchEnd = (e) => {
    const endX = e.changedTouches[0].clientX;
    const diff = todayTouchStartX - endX;
    if (Math.abs(diff) > 50) {
      if (diff > 0) handleTodayNext();
      else handleTodayPrev();
    }
  };

  const handleCopyLink = (id, link) => {
    if (!link) return;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopiedLinkId(id);
        setTimeout(() => setCopiedLinkId(null), 1500);
      })
      .catch(() => {});
  };

  const handleViewEventDetails = async (event) => {
    try {
      const res = await apiClient.get(`/events/${event.id}`);
      if (res.data.ok) setSelectedEvent(res.data.event);
      else setSelectedEvent(event);
    } catch (err) {
      console.error("Failed to fetch event details:", err);
      setSelectedEvent(event);
    } finally {
      setShowEventModal(true);
    }
  };

  const handleViewAttendees = (event) => {
    setSelectedEvent(event);
    setShowAttendeesModal(true);
  };

  const handleShowConflict = (event) => {
    setConflictEvent(event);
    setShowConflictModal(true);
  };

  // ── Ongoing Task click → TaskCardView modal ──
  const handleViewTask = async (task) => {
    try {
      const res = await apiClient.get(`/tasks/${task.id}`);
      if (res.data.ok) setSelectedTask(res.data.task);
      else setSelectedTask(task);
    } catch (err) {
      console.error("Failed to fetch task details:", err);
      setSelectedTask(task);
    } finally {
      setShowTaskModal(true);
    }
  };

  const handleTaskChecklistToggle = async (itemId, isCompleted) => {
    try {
      await apiClient.put(`/tasks/checklist/${itemId}`, {
        is_completed: isCompleted,
      });
      if (selectedTask) {
        const res = await apiClient.get(`/tasks/${selectedTask.id}`);
        if (res.data.ok) setSelectedTask(res.data.task);
      }
      fetchOngoingTasks();
    } catch (err) {
      console.error("Failed to toggle checklist:", err);
    }
  };

  const handleTaskAddComment = async (itemId, commentText) => {
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
    }
  };

  const displayUser = fullUser || user || {};

  // ── Filters ──
  const filterEventsByDuration = (events, duration) => {
    if (duration === "all") return events;
    const now = new Date();
    const days = duration === "week" ? 7 : 30;
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return events.filter((ev) => new Date(ev.start_datetime) <= cutoff);
  };

  const filterEventsByType = (events, type) => {
    if (type === "all") return events;
    return events.filter((ev) => ev.type === type || ev.visibility === type);
  };

  const filterTasksByDuration = (tasks, duration) => {
    if (duration === "all") return tasks;
    const now = new Date();
    const days = duration === "week" ? 7 : 30;
    const cutoff = new Date(now.getTime() + days * 24 * 60 * 60 * 1000);
    return tasks.filter((t) => new Date(t.deadline_datetime) <= cutoff);
  };

  const filterTasksByType = (tasks, type) => {
    if (type === "all") return tasks;
    return tasks.filter((t) => t.visibility === type);
  };

  // ── Render Quick Stats ──
  const renderStats = () => {
    if (!quickStats)
      return (
        <EmptyState
          icon={InsertChartOutlinedIcon}
          title="No data available"
          subtitle="Stats will appear once there's activity to show"
        />
      );
    const config =
      statTypeFilter === "task" ? TASK_STAT_CONFIG : EVENT_STAT_CONFIG;
    const getCfg = (k) => config.find((c) => c.key === k) || {};

    if (statTypeFilter === "task") {
      return (
        <div className={styles.statsGrid}>
          {config.map(({ key, label, color }) => (
            <div className={styles.statItem} key={key}>
              <span className={styles.statIconBox}>
                <FaClipboard />
              </span>
              <div className={styles.statTextWrap}>
                <span className={styles.statCardLabel}>{label}</span>
                <span className={`${styles.statNumber} ${color}`}>
                  {quickStats[key] || 0}
                </span>
              </div>
            </div>
          ))}
        </div>
      );
    }

    const activeCfg = getCfg("active_events");
    const acceptedCfg = getCfg("accepted");
    const declinedCfg = getCfg("declined");
    const pendingCfg = getCfg("pending");
    const conflictedCfg = getCfg("conflicted");
    const missedCfg = getCfg("missed");

    const getIconClass = (cfg) => {
      if (!cfg || !cfg.color) return "";
      if (cfg.color === styles.statGreen) return styles.statIconGreen;
      if (cfg.color === styles.statMaroon) return styles.statIconMaroon;
      if (cfg.color === styles.statDarkred) return styles.statIconDarkred;
      if (cfg.color === styles.statGold) return styles.statIconGold;
      return "";
    };

    const renderCard = (cfg, k) => {
      const iconCls = getIconClass(cfg);
      return (
        <div className={styles.statItem} key={k}>
          <span className={`${styles.statIconBox} ${iconCls}`}>
            {cfg.Icon ? (
              <cfg.Icon fontSize="small" />
            ) : (
              <FaCalendarAlt style={{ color: "inherit" }} />
            )}
          </span>
          <div className={styles.statTextWrap}>
            <span className={styles.statCardLabel}>{cfg.label}</span>
            <span className={`${styles.statNumber} ${cfg.color}`}>
              {quickStats[k] || 0}
            </span>
          </div>
        </div>
      );
    };

    return (
      <div className={styles.statsGridWrapper}>
        <div className={`${styles.statItem} ${styles.statPrimary}`}>
          <span className={`${styles.statIconBox} ${styles.statIconPrimary}`}>
            {activeCfg.Icon ? (
              <activeCfg.Icon fontSize="small" />
            ) : (
              <FaCalendarAlt style={{ color: "inherit" }} />
            )}
          </span>
          <div className={styles.statTextWrap}>
            <span className={styles.statCardLabel}>
              {activeCfg.label || "Active Events"}
            </span>
            <span
              className={`${styles.statNumber} ${styles.statNumberPrimary}`}
            >
              {quickStats["active_events"] || 0}
            </span>
          </div>
          <span className={styles.statTrailingIcon}>
            <TrendingUpOutlinedIcon fontSize="small" />
          </span>
        </div>

        <div className={styles.sectionContainer}>
          <h4 className={styles.sectionTitle}>Responses</h4>
          <div className={styles.twoColGrid}>
            {renderCard(acceptedCfg, "accepted")}
            {renderCard(declinedCfg, "declined")}
          </div>
        </div>

        <div className={styles.sectionContainer}>
          <h4 className={styles.sectionTitle}>Action Needed</h4>
          <div className={styles.twoColGrid}>
            {renderCard(pendingCfg, "pending")}
            {renderCard(conflictedCfg, "conflicted")}
          </div>
        </div>

        <div className={styles.sectionContainer}>
          <h4 className={styles.sectionTitle}>Post Event</h4>
          <div className={styles.oneColGrid}>
            {renderCard(missedCfg, "missed")}
          </div>
        </div>
      </div>
    );
  };

  // ── Render a single Today's Event ──
  const renderTodayEvent = (todayEvent) => {
    if (!todayEvent) return null;

    const creator = todayEvent.creator || {};
    const creatorName = creator.full_name || creator.username || "Unknown";
    const creatorPosition = creator.position || "";
    const creatorAffiliation = [creator.department, creator.office]
      .filter(Boolean)
      .join(" | ");
    const creatorSub = [creatorPosition, creatorAffiliation]
      .filter(Boolean)
      .join(" | ");

    const participants = todayEvent.participants || {};
    const depts = participants.departments || [];
    const offices = participants.offices || [];
    const allUsers = participants.users || [];
    const acceptedUsers = allUsers.filter((u) => u.response === "accepted");

    const status = getEventStatus(todayEvent);
    const statusCfg = EVENT_STATUS_CONFIG[status];
    const conflict = todayEvent.conflict || {};

    return (
      <div className={styles.featuredEventSection}>
        <div className={styles.featuredContainer}>
          <div className={styles.featuredCard}>
            <div className={styles.badgesStatus}>
              <div className={styles.badgeRow}>
                <div className={styles.badgePill}>
                  {todayEvent.hierarchy || "Unknown Hierarchy"}
                </div>
                <div className={styles.badgePill}>
                  {todayEvent.method || "Unknown Method"}
                </div>
                <div className={styles.badgePill}>
                  {todayEvent.visibility || "Unknown Visibility"}
                </div>
                <div className={styles.badgePill}>
                  {todayEvent.event_type || "Unknown Type"}
                </div>
                <div
                  className={`${styles.statusBadgeSmall} ${styles[statusCfg.className]}`}
                >
                  {statusCfg.label}
                </div>
              </div>
              <div className={styles.heading2}>
                <div className={styles.featuredTitle}>{todayEvent.title}</div>
              </div>
            </div>

            <div className={styles.featuredCardContent}>
              <div className={styles.titleDescription}>
                <div className={styles.descriptionText}>
                  {todayEvent.description}
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
                        {formatDate(todayEvent.start_datetime)} —{" "}
                        {formatDate(todayEvent.end_datetime)}
                      </div>
                    </div>
                    <div className={styles.infoBlock}>
                      <div className={styles.infoLabel}>TIME</div>
                      <div className={styles.infoValue}>
                        {formatTime(todayEvent.start_datetime)} —{" "}
                        {formatTime(todayEvent.end_datetime)}
                      </div>
                    </div>
                    <div className={styles.infoBlock}>
                      <div className={styles.infoLabel}>LOCATION</div>
                      <div className={styles.infoValue}>
                        {todayEvent.venue || todayEvent.location || "Online"}
                      </div>
                    </div>
                  </div>
                  {todayEvent.method === "online" && todayEvent.link && (
                    <div className={styles.linkSection}>
                      <FiLink size={14} />
                      <span className={styles.linkText}>{todayEvent.link}</span>
                      <button
                        type="button"
                        className={styles.copyLinkBtn}
                        onClick={() =>
                          handleCopyLink(todayEvent.id, todayEvent.link)
                        }
                      >
                        <FiCopy size={12} />
                        {copiedLinkId === todayEvent.id ? "Copied!" : "Copy"}
                      </button>
                    </div>
                  )}
                </div>

                <div className={styles.organizerSection}>
                  <div className={styles.sectionHeader}>
                    <PersonOutlinedIcon fontSize="small" />
                    <div className={styles.heading4}>
                      <div className={styles.text7}>ORGANIZER</div>
                    </div>
                  </div>
                  <div className={styles.organizerRow}>
                    <div className={styles.organizerAvatar}>
                      {getInitials(creatorName)}
                    </div>
                    <div className={styles.organizerDetails}>
                      <div className={styles.organizerName}>{creatorName}</div>
                      <div className={styles.organizerTitle}>
                        {creatorSub || "Organizer"}
                      </div>
                    </div>
                  </div>
                  <div className={styles.participatingBlock}>
                    <div className={styles.infoLabel}>
                      PARTICIPATING DEPARTMENTS
                    </div>
                    <div className={styles.deptBadges}>
                      {depts.length > 0 ? (
                        depts.slice(0, 4).map((dept) => (
                          <div key={dept} className={styles.deptBadge}>
                            {dept}
                          </div>
                        ))
                      ) : (
                        <span className={styles.noData}>No departments</span>
                      )}
                    </div>
                  </div>
                  <div className={styles.participatingBlock}>
                    <div className={styles.infoLabel}>
                      PARTICIPATING OFFICES
                    </div>
                    <div className={styles.deptBadges}>
                      {offices.length > 0 ? (
                        offices.slice(0, 4).map((office) => (
                          <div key={office} className={styles.deptBadge}>
                            {office}
                          </div>
                        ))
                      ) : (
                        <span className={styles.noData}>No offices</span>
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
                          >
                            {getInitials(name)}
                          </div>
                        );
                      })}
                      {acceptedUsers.length >= 5 && (
                        <div className={styles.attendeeMore}>
                          +{acceptedUsers.length - 4}
                        </div>
                      )}
                    </div>
                    <div className={styles.audienceText}>
                      {acceptedUsers.length > 0
                        ? `${acceptedUsers[0].full_name || acceptedUsers[0].username || acceptedUsers[0].email} and ${acceptedUsers.length - 1} others attending`
                        : "No attendees yet"}
                    </div>
                  </div>
                  <button
                    type="button"
                    className={styles.viewAttendeesButton}
                    onClick={() => handleViewAttendees(todayEvent)}
                  >
                    <VisibilityOutlinedIcon fontSize="small" />
                    View Attendees
                  </button>
                </div>
              </div>

              <div className={styles.actionsRow}>
                <button
                  type="button"
                  className={styles.viewEventButton}
                  onClick={() => handleViewEventDetails(todayEvent)}
                >
                  View Event Details
                </button>
              </div>

              {conflict.isConflicted && (
                <button
                  type="button"
                  className={`${styles.conflictBtn} ${conflict.isPriority ? styles.conflictBtnPriority : styles.conflictBtnWarning}`}
                  onClick={() => handleShowConflict(todayEvent)}
                >
                  <FiAlertTriangle size={13} />
                  {conflict.isPriority ? "Priority Event" : "Conflicted"} — View
                  details
                </button>
              )}
            </div>
          </div>
        </div>
      </div>
    );
  };

  const renderTodayEventsCarousel = () => {
    if (todayLoading) return <TodayEventSkeleton />;
    if (todayEvents.length === 0)
      return (
        <EmptyState
          icon={EventBusyOutlinedIcon}
          title="No events today"
          subtitle="Enjoy your free day!"
        />
      );

    return (
      <div
        className={styles.todayCarouselWrapper}
        onTouchStart={handleTodayTouchStart}
        onTouchEnd={handleTodayTouchEnd}
      >
        <div
          className={styles.todayCarouselTrack}
          style={{ transform: `translateX(-${currentTodayIndex * 100}%)` }}
        >
          {todayEvents.map((ev) => (
            <div key={ev.id} className={styles.todayCarouselSlide}>
              {renderTodayEvent(ev)}
            </div>
          ))}
        </div>
        {todayEvents.length > 1 && (
          <>
            <button
              type="button"
              className={`${styles.todayCarouselArrow} ${styles.todayCarouselArrowLeft}`}
              onClick={handleTodayPrev}
            >
              <IoIosArrowBack />
            </button>
            <button
              type="button"
              className={`${styles.todayCarouselArrow} ${styles.todayCarouselArrowRight}`}
              onClick={handleTodayNext}
            >
              <IoIosArrowForward />
            </button>
            <div className={styles.todayDotsContainer}>
              {todayEvents.map((_, idx) => (
                <span
                  key={idx}
                  className={`${styles.todayDot} ${idx === currentTodayIndex ? styles.todayDotActive : ""}`}
                  onClick={() => setCurrentTodayIndex(idx)}
                />
              ))}
            </div>
          </>
        )}
      </div>
    );
  };

  const renderUpcomingEvents = () => {
    if (upcomingEventsLoading && upcomingEvents.length === 0) {
      return (
        <div className={styles.upcomingList}>
          <EventRowSkeleton />
          <EventRowSkeleton />
          <EventRowSkeleton />
        </div>
      );
    }

    let filtered = filterEventsByType(upcomingEvents, eventTypeFilter);
    filtered = filterEventsByDuration(filtered, eventDurationFilter);

    if (filtered.length === 0)
      return (
        <EmptyState
          icon={EventBusyOutlinedIcon}
          title="No upcoming events"
          subtitle="New events will show up here once they're scheduled"
        />
      );
    return (
      <div className={styles.upcomingList}>
        {filtered.map((ev) => (
          <div
            key={ev.id}
            className={styles.upcomingItem}
            onClick={() => handleViewEventDetails(ev)}
          >
            <div className={styles.upcomingDate}>
              <div className={styles.dateCard}>
                <span className={styles.dateMonth}>
                  {formatMonthDay(ev.start_datetime).month}
                </span>
                <span className={styles.dateDay}>
                  {formatMonthDay(ev.start_datetime).day}
                </span>
              </div>
            </div>
            <div className={styles.upcomingInfo}>
              <h4>{ev.title}</h4>
              <p>{ev.description?.substring(0, 60)}...</p>
              <div className={styles.upcomingMeta}>
                <span className={styles.upcomingMetaContent}>
                  <span className={styles.icon}>
                    <AccessTimeOutlinedIcon fontSize="small" />
                  </span>
                  <span>{formatTime(ev.start_datetime)}</span>
                </span>
                <span className={styles.upcomingMetaContent}>
                  <span className={styles.icon}>
                    <LocationOnOutlinedIcon fontSize="small" />
                  </span>
                  <span>{ev.venue || ev.location || "Online"}</span>
                </span>
                <span className={styles.upcomingMetaContent}>
                  <span className={styles.icon}>
                    <GroupOutlinedIcon fontSize="small" />
                  </span>
                  <span>{ev.event_type}</span>
                </span>
              </div>
            </div>
            <span className={styles.chevron}>
              <IoIosArrowForward />
            </span>
          </div>
        ))}
        {upcomingEventsHasMore && (
          <div className={styles.showMoreWrapper}>
            <button
              className={styles.showMoreBtn}
              onClick={handleShowMoreEvents}
              disabled={upcomingEventsLoading}
            >
              {upcomingEventsLoading ? (
                <>
                  <Spinner size={13} /> Loading
                </>
              ) : (
                <>
                  Show More
                  <FiChevronDown size={14} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  const renderUpcomingTasks = () => {
    if (upcomingTasksLoading && allOngoingTasks.length === 0) {
      return (
        <div className={styles.upcomingList}>
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
          <TaskCardSkeleton />
        </div>
      );
    }

    let filtered = filterTasksByType(allOngoingTasks, taskTypeFilter);
    filtered = filterTasksByDuration(filtered, taskDurationFilter);

    const visible = filtered.slice(0, upcomingTasksLimit);
    const hasMore = filtered.length > upcomingTasksLimit;

    if (visible.length === 0)
      return (
        <EmptyState
          icon={ChecklistOutlinedIcon}
          title="No ongoing tasks"
          subtitle="You're all caught up!"
        />
      );

    return (
      <div className={styles.upcomingList}>
        {visible.map((task) => {
          const checklist = task.checklist_items || [];
          const completed = checklist.filter((i) => i.is_completed).length;
          const total = checklist.length;
          const pct = total > 0 ? Math.round((completed / total) * 100) : 0;
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
                  <span className={styles.priorityBadge}>
                    {task.priority} priority
                  </span>
                )}
              </div>

              <h4 className={styles.taskTitle}>{task.title}</h4>

              <div className={styles.taskMetaRow}>
                <span className={styles.taskMetaItem}>
                  <AccessTimeOutlinedIcon fontSize="small" />
                  Due {formatDate(task.deadline_datetime)} ·{" "}
                  {formatTime(task.deadline_datetime)}
                </span>
              </div>
              <div className={styles.taskMetaRow}>
                <span className={styles.taskMetaItem}>
                  <VisibilityOutlinedIcon fontSize="small" />
                  {task.visibility}
                </span>
              </div>

              {task.description && (
                <p className={styles.taskDesc}>
                  {task.description.substring(0, 60)}...
                </p>
              )}

              <div className={styles.checklistRow}>
                <span className={styles.checklistLabel}>
                  <ChecklistOutlinedIcon fontSize="small" />
                  Checklist Progress
                </span>
                <span className={styles.checklistFraction}>
                  {completed}/{total}
                </span>
              </div>
              <div className={styles.progressBarTrack}>
                <div
                  className={styles.progressBarFill}
                  style={{ width: `${pct}%` }}
                />
              </div>
            </div>
          );
        })}
        {hasMore && (
          <div className={styles.showMoreWrapper}>
            <button
              className={styles.showMoreBtn}
              onClick={handleShowMoreTasks}
              disabled={upcomingTasksLoading}
            >
              {upcomingTasksLoading ? (
                <>
                  <Spinner size={13} /> Loading
                </>
              ) : (
                <>
                  Show More
                  <FiChevronDown size={14} />
                </>
              )}
            </button>
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.mainContainer}>
      {/* Welcome Header */}
      <div className={styles.introContent}>
        <h1>
          Welcome,{" "}
          <span className={styles.introName}>
            {displayUser?.full_name || displayUser?.username || "User"}
          </span>
        </h1>
        {displayUser && (
          <p>
            {[displayUser.position, displayUser.office, displayUser.department]
              .filter(Boolean)
              .join(" | ") || ""}
          </p>
        )}
      </div>

      {/* Quick Stats */}
      <div className={styles.quickStat}>
        <div className={styles.quickTop}>
          <h2>Quick Stats</h2>
        </div>
        <div className={styles.quickTopRow}>
          <div className={styles.quickTopLeft}>
            <h3 className={styles.quickStatType}>
              {statTypeFilter === "task"
                ? "Tasks"
                : statTypeFilter.charAt(0).toUpperCase() +
                  statTypeFilter.slice(1) +
                  " Events"}
            </h3>
          </div>
          <div className={styles.quickTopRight}>
            <button
              type="button"
              className={styles.viewLink}
              onClick={gotoAnalytics}
            >
              View Analytics
            </button>
          </div>
        </div>

        <div className={styles.statsTypeFilterRow}>
          <label className={styles.selectLabel} htmlFor="quick-stats-type">
            View by
          </label>
          <div className={styles.selectWrap}>
            <select
              id="quick-stats-type"
              className={styles.statsTypeSelect}
              value={statTypeFilter}
              onChange={(e) => setStatTypeFilter(e.target.value)}
            >
              {STAT_TYPE_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>
                  {opt.label}
                </option>
              ))}
            </select>
            <FiChevronDown
              className={styles.selectChevron}
              size={16}
              aria-hidden="true"
            />
          </div>
        </div>

        {statsLoading ? <StatsSkeleton type={statTypeFilter} /> : renderStats()}
      </div>

      {/* Today's Event */}
      <div className={styles.todaysEvent}>
        <div className={styles.titleContainer}>
          <div className={styles.titleContent}>
            <h1>Today's Event</h1>
            <button
              type="button"
              className={styles.viewLink}
              onClick={gotoCalendar}
            >
              View Calendar
            </button>
          </div>
        </div>
        <div className={styles.todayContent}>{renderTodayEventsCarousel()}</div>
      </div>

      {/* Upcoming Events + Ongoing Tasks */}
      <div className={styles.dashboardLowerGrid}>
        <div className={styles.upcomingEvent}>
          <div className={styles.upcomingHeader}>
            <h2>Upcoming Events</h2>
            <button
              type="button"
              className={styles.viewLink}
              onClick={gotoCalendar}
            >
              View Calendar
            </button>
          </div>

          <div className={styles.filterRow}>
            <SelectDropdown
              label="Event Type"
              options={[
                { value: "all", label: "All Types" },
                { value: "campus", label: "Campus" },
                { value: "department", label: "Department" },
                { value: "private", label: "Private" },
              ]}
              value={eventTypeFilter}
              onChange={(e) => setEventTypeFilter(e.target.value)}
            />
            <SelectDropdown
              label="Time Range"
              options={[
                { value: "all", label: "All Time" },
                { value: "week", label: "This Week" },
                { value: "month", label: "This Month" },
              ]}
              value={eventDurationFilter}
              onChange={(e) => setEventDurationFilter(e.target.value)}
            />
          </div>

          <div className={styles.upcomingContent}>{renderUpcomingEvents()}</div>
        </div>

        <div className={styles.upcomingTask}>
          <div className={styles.upcomingHeader}>
            <h2>Ongoing Tasks</h2>
            <button
              type="button"
              className={styles.viewLink}
              onClick={gotoTaskLists}
            >
              View Task Lists
            </button>
          </div>

          <div className={styles.filterRow}>
            <SelectDropdown
              label="Task Type"
              options={[
                { value: "all", label: "All Tasks" },
                { value: "personal", label: "Personal Task" },
                { value: "campus", label: "Campus Task" },
                { value: "department", label: "Department Task" },
              ]}
              value={taskTypeFilter}
              onChange={(e) => setTaskTypeFilter(e.target.value)}
            />
            <SelectDropdown
              label="Time Range"
              options={[
                { value: "all", label: "All Time" },
                { value: "week", label: "This Week" },
                { value: "month", label: "This Month" },
              ]}
              value={taskDurationFilter}
              onChange={(e) => setTaskDurationFilter(e.target.value)}
            />
          </div>

          <div className={styles.upcomingContent}>{renderUpcomingTasks()}</div>
        </div>
      </div>

      <EventCardView
        isOpen={showEventModal}
        onClose={() => {
          setShowEventModal(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
      />
      <AttendeesModal
        isOpen={showAttendeesModal}
        onClose={() => {
          setShowAttendeesModal(false);
          setSelectedEvent(null);
        }}
        event={selectedEvent}
      />
      <ConflictCardEvent
        isOpen={showConflictModal}
        onClose={() => {
          setShowConflictModal(false);
          setConflictEvent(null);
        }}
        event={conflictEvent}
      />

      <TaskCardView
        isOpen={showTaskModal}
        onClose={() => {
          setShowTaskModal(false);
          setSelectedTask(null);
        }}
        task={selectedTask}
        onChecklistToggle={handleTaskChecklistToggle}
        onAddComment={handleTaskAddComment}
        currentUserId={user?.id}
      />
    </div>
  );
}

export default Home;
