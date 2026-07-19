import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { IoIosArrowForward, IoIosArrowBack } from "react-icons/io";
import apiClient from "../../../api/client";
import { useAuth } from "../../../context/AuthContext";
import styles from "./Home.module.css";
import { FaCalendarAlt, FaClipboard, FaRegCalendar } from "react-icons/fa";
import CalendarTodayOutlinedIcon from "@mui/icons-material/CalendarTodayOutlined";
import AccessTimeOutlinedIcon from "@mui/icons-material/AccessTimeOutlined";
import LocationOnOutlinedIcon from "@mui/icons-material/LocationOnOutlined";
import GroupOutlinedIcon from "@mui/icons-material/GroupOutlined";
import EventOutlinedIcon from "@mui/icons-material/EventOutlined";
import LocationCityOutlinedIcon from "@mui/icons-material/LocationCityOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import KeyboardArrowDownOutlinedIcon from "@mui/icons-material/KeyboardArrowDownOutlined";
import VisibilityOutlinedIcon from "@mui/icons-material/VisibilityOutlined";
import ChecklistOutlinedIcon from "@mui/icons-material/ChecklistOutlined";

// Helper to format datea
const formatDate = (dateStr) => {
  const d = new Date(dateStr);
  return d.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
};

// Helper returning month and day separately (no year)
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

// ── Small display helpers (UI only, no data/logic changes) ──
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
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
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

// Config for quick-stat cards so the icon/label/color live in one place
const EVENT_STAT_CONFIG = [
  { key: "total", label: "Events", color: styles.statGreen },
  { key: "accepted", label: "Accepted", color: styles.statGreen },
  { key: "declined", label: "Declined", color: styles.statMaroon },
  { key: "missed", label: "Missed", color: styles.statDarkred },
  { key: "pending", label: "Pending", color: styles.statGold },
  { key: "conflicted", label: "Conflicted", color: styles.statMaroon },
];

const TASK_STAT_CONFIG = [
  { key: "completed", label: "Completed", color: styles.statGreen },
  { key: "missed", label: "Missed", color: styles.statDarkred },
  { key: "pending", label: "Pending", color: styles.statGold },
];

// ─── Dummy Tasks Data ──────────────────────────────────
const DUMMY_TASKS = [
  {
    id: "task1",
    title: "Quarterly Editorial Review",
    description:
      "Review all manuscript submissions for the upcoming winter anthology. Coordinate with...",
    start_datetime: new Date(Date.now() + 86400000).toISOString(),
    end_datetime: new Date(Date.now() + 86400000 + 7200000).toISOString(),
    priority: "high",
    type: "personal",
    completed_items: 1,
    total_items: 3,
  },
  {
    id: "task2",
    title: "Visual Identity Sync",
    description:
      "Meeting with the brand conductors to finalize the 'Nocturnal' color palette and...",
    start_datetime: new Date(Date.now() + 172800000).toISOString(),
    end_datetime: new Date(Date.now() + 172800000 + 3600000).toISOString(),
    priority: "medium",
    type: "campus",
    completed_items: 1,
    total_items: 3,
  },
  {
    id: "task3",
    title: "Archive Maintenance",
    description:
      "Backup existing project files to the cold storage server and update the index...",
    start_datetime: new Date(Date.now() + 259200000).toISOString(),
    end_datetime: new Date(Date.now() + 259200000 + 1800000).toISOString(),
    priority: "low",
    type: "personal",
    completed_items: 1,
    total_items: 3,
  },
  {
    id: "task4",
    title: "Faculty Meeting Preparation",
    description: "Prepare slides and agenda for the monthly faculty meeting...",
    start_datetime: new Date(Date.now() + 345600000).toISOString(),
    end_datetime: new Date(Date.now() + 345600000 + 5400000).toISOString(),
    priority: "high",
    type: "department",
    completed_items: 2,
    total_items: 4,
  },
  {
    id: "task5",
    title: "Student Consultation",
    description:
      "Meet with student representatives to discuss upcoming events...",
    start_datetime: new Date(Date.now() + 432000000).toISOString(),
    end_datetime: new Date(Date.now() + 432000000 + 3600000).toISOString(),
    priority: "medium",
    type: "campus",
    completed_items: 0,
    total_items: 2,
  },
  {
    id: "task6",
    title: "Budget Proposal Draft",
    description: "Draft the budget proposal for the next fiscal year...",
    start_datetime: new Date(Date.now() + 518400000).toISOString(),
    end_datetime: new Date(Date.now() + 518400000 + 5400000).toISOString(),
    priority: "low",
    type: "personal",
    completed_items: 0,
    total_items: 5,
  },
];

// Dummy stats for tasks
const DUMMY_TASK_STATS = {
  completed: 8,
  missed: 8,
  pending: 24,
};

function Home() {
  const { user } = useAuth();
  const navigate = useNavigate();

  // ── Fetch full user profile ──
  const [fullUser, setFullUser] = useState(null);
  const [profileLoading, setProfileLoading] = useState(true);

  useEffect(() => {
    const fetchFullProfile = async () => {
      try {
        const { data } = await apiClient.get("/auth/me");
        if (data.ok) {
          setFullUser(data.user);
        } else {
          setFullUser(user);
        }
      } catch (err) {
        console.error("Failed to fetch full profile:", err);
        setFullUser(user);
      } finally {
        setProfileLoading(false);
      }
    };
    fetchFullProfile();
  }, [user]);

  // ── State ──
  const [quickStatType, setQuickStatType] = useState("campus");
  const [quickStats, setQuickStats] = useState(null);
  const [statsLoading, setStatsLoading] = useState(false);
  const [statsRange, setStatsRange] = useState("week");
  const [todayEvent, setTodayEvent] = useState(null);
  const [todayLoading, setTodayLoading] = useState(false);
  const [upcomingEvents, setUpcomingEvents] = useState([]);
  const [upcomingEventsLoading, setUpcomingEventsLoading] = useState(false);
  const [upcomingEventsOffset, setUpcomingEventsOffset] = useState(0);
  const [upcomingEventsHasMore, setUpcomingEventsHasMore] = useState(true);

  // Upcoming Events filters
  const [eventTypeFilter, setEventTypeFilter] = useState("all");
  const [eventDurationFilter, setEventDurationFilter] = useState("all");

  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [upcomingTasksLoading, setUpcomingTasksLoading] = useState(false);
  const [upcomingTasksOffset, setUpcomingTasksOffset] = useState(0);
  const [upcomingTasksHasMore, setUpcomingTasksHasMore] = useState(true);

  // Upcoming Tasks filters
  const [taskTypeFilter, setTaskTypeFilter] = useState("all");
  const [taskDurationFilter, setTaskDurationFilter] = useState("all");

  // ── Quick Stats ──
  const fetchQuickStats = useCallback(async (type, range = "week") => {
    setStatsLoading(true);
    try {
      if (type === "task") {
        setQuickStats(DUMMY_TASK_STATS);
        setStatsLoading(false);
        return;
      }

      const endpoint = `/events/stats?type=${type}&range=${range}`;
      const res = await apiClient.get(endpoint);
      if (res.data.ok) {
        setQuickStats(res.data.stats);
      }
    } catch (err) {
      console.error("Failed to fetch quick stats:", err);
      if (type === "task") {
        setQuickStats(DUMMY_TASK_STATS);
      } else {
        setQuickStats(null);
      }
    } finally {
      setStatsLoading(false);
    }
  }, []);

  // ── Today's Event ──
  const fetchTodayEvent = useCallback(async () => {
    setTodayLoading(true);
    try {
      const res = await apiClient.get("/events/today");
      if (res.data.ok) {
        setTodayEvent(res.data.event);
      }
    } catch (err) {
      console.error("Failed to fetch today's event:", err);
      setTodayEvent(null);
    } finally {
      setTodayLoading(false);
    }
  }, []);

  // ── Upcoming Events ──
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

  // ── Upcoming Tasks (Dummy) ──
  const fetchUpcomingTasks = useCallback(
    async (reset = true) => {
      setUpcomingTasksLoading(true);
      try {
        const start = reset ? 0 : upcomingTasksOffset;
        const limit = 4;
        const dummySlice = DUMMY_TASKS.slice(start, start + limit);
        await new Promise((resolve) => setTimeout(resolve, 300));

        if (reset) {
          setUpcomingTasks(dummySlice);
          setUpcomingTasksOffset(limit);
          setUpcomingTasksHasMore(
            dummySlice.length === limit && DUMMY_TASKS.length > start + limit,
          );
        } else {
          setUpcomingTasks((prev) => [...prev, ...dummySlice]);
          setUpcomingTasksOffset((prev) => prev + limit);
          setUpcomingTasksHasMore(
            dummySlice.length === limit && DUMMY_TASKS.length > start + limit,
          );
        }
      } catch (err) {
        console.error("Failed to fetch dummy tasks:", err);
        if (reset) {
          setUpcomingTasks([]);
          setUpcomingTasksHasMore(false);
        }
      } finally {
        setUpcomingTasksLoading(false);
      }
    },
    [upcomingTasksOffset],
  );

  // ── Initial loads ──
  useEffect(() => {
    fetchQuickStats(quickStatType, statsRange);
    fetchTodayEvent();
    fetchUpcomingEvents(true);
    fetchUpcomingTasks(true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    quickStatType,
    fetchQuickStats,
    fetchTodayEvent,
    fetchUpcomingEvents,
    fetchUpcomingTasks,
  ]);

  // ── Handlers ──
  const handleQuickStatArrow = (direction) => {
    const types = ["campus", "department", "private", "task"];
    const currentIndex = types.indexOf(quickStatType);
    let newIndex = currentIndex + direction;
    if (newIndex < 0) newIndex = types.length - 1;
    if (newIndex >= types.length) newIndex = 0;
    setQuickStatType(types[newIndex]);
  };

  const handleStatsRangeChange = (range) => {
    setStatsRange(range);
    fetchQuickStats(quickStatType, range);
  };

  const handleShowMoreEvents = () => fetchUpcomingEvents(false);
  const handleShowMoreTasks = () => fetchUpcomingTasks(false);

  const gotoCalendar = () => navigate("/calendar");
  const gotoAnalytics = () => navigate("/analytics");
  const gotoTaskLists = () => navigate("/tasks");

  // ── Determine display user ──
  const displayUser = fullUser || user || {};

  // ── Filtering helpers ──
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
    return tasks.filter((task) => new Date(task.start_datetime) <= cutoff);
  };

  const filterTasksByType = (tasks, type) => {
    if (type === "all") return tasks;
    return tasks.filter((task) => task.type === type);
  };

  // ── Render stats numbers ──
  const renderStats = () => {
    if (!quickStats) return <p className={styles.noData}>No data</p>;

    const config =
      quickStatType === "task" ? TASK_STAT_CONFIG : EVENT_STAT_CONFIG;
    const Icon = quickStatType === "task" ? FaClipboard : FaCalendarAlt;

    return (
      <div className={styles.statsGrid}>
        {config.map(({ key, label, color }) => (
          <div className={styles.statItem} key={key}>
            <span className={styles.statIconBox}>
              <FaCalendarAlt />
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
  };

  // ── Render today's event ──
  const renderTodayEvent = () => {
    if (todayLoading)
      return <p className={styles.noData}>Loading today's event...</p>;
    if (!todayEvent) return <p className={styles.noData}>No events today</p>;

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
    const users = participants.users || [];

    return (
      <div className={styles.todayCard}>
        <h3>{todayEvent.title}</h3>
        <p className={styles.todayDesc}>{todayEvent.description}</p>
        <div className={styles.todayMeta}>
          <span className={styles.metaContent}>
            <span className={styles.icon}>
              <CalendarTodayOutlinedIcon fontSize="small" />
            </span>
            {formatDate(todayEvent.start_datetime)} -{" "}
            {formatDate(todayEvent.end_datetime)}
          </span>
          <span className={styles.metaContent}>
            <span className={styles.icon}>
              <AccessTimeOutlinedIcon fontSize="small" />
            </span>
            <strong>
              {formatTime(todayEvent.start_datetime)} -{" "}
              {formatTime(todayEvent.end_datetime)}
            </strong>
          </span>
          <span className={styles.metaContent}>
            <span className={styles.icon}>
              <GroupOutlinedIcon fontSize="small" />
            </span>
            {todayEvent.method}
          </span>
          <span className={styles.metaContent}>
            <span className={styles.icon}>
              <LocationCityOutlinedIcon fontSize="small" />
            </span>
            {todayEvent.hierarchy}
          </span>
          <span className={styles.metaContent}>
            <span className={styles.icon}>
              <EventOutlinedIcon fontSize="small" />
            </span>
            {todayEvent.event_type}
          </span>
          <span className={styles.metaContent}>
            <span className={styles.icon}>
              <LocationOnOutlinedIcon fontSize="small" />
            </span>
            {todayEvent.venue || todayEvent.location || "Online"}
          </span>
          <span className={styles.metaContent}>
            <span className={styles.icon}>
              <PersonOutlinedIcon fontSize="small" />
            </span>
            <span className={styles.creatorLabel}>
              <strong>{creatorName}</strong>
              {creatorSub && (
                <span className={styles.creatorContent}>
                  <span className={styles.creatorSub}>{creatorSub}</span>
                </span>
              )}
            </span>
          </span>
        </div>

        {/* ── Participants Section ── */}
        {(depts.length > 0 || offices.length > 0 || users.length > 0) && (
          <div className={styles.todayParticipants}>
            {depts.length > 0 && (
              <div className={styles.participantGroup}>
                <span className={styles.participantLabel}>
                  Colleges Represented:
                </span>
                <div className={styles.tagRow}>
                  {depts.map((d, i) => (
                    <span key={i} className={styles.tagPill}>
                      {d}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {offices.length > 0 && (
              <div className={styles.participantGroup}>
                <span className={styles.participantLabel}>
                  Offices Represented:
                </span>
                <div className={styles.tagRow}>
                  {offices.map((o, i) => (
                    <span key={i} className={styles.tagPill}>
                      {o}
                    </span>
                  ))}
                </div>
              </div>
            )}
            {users.length > 0 && (
              <div className={styles.participantGroup}>
                <span className={styles.participantLabel}>Attendees:</span>
                <div className={styles.avatarRow}>
                  {users.slice(0, 5).map((u) => {
                    const name =
                      u.full_name || u.username || u.email || "Unknown";
                    return (
                      <span
                        key={u.id}
                        className={styles.avatarCircle}
                        style={{ background: getAvatarColor(name) }}
                        title={`${name}${u.department ? ` (${u.department})` : ""}`}
                      >
                        {getInitials(name)}
                      </span>
                    );
                  })}
                  {users.length > 5 && (
                    <span className={styles.avatarMore}>
                      +{users.length - 5}
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    );
  };

  // ── Render upcoming events list ──
  const renderUpcomingEvents = () => {
    let filtered = filterEventsByType(upcomingEvents, eventTypeFilter);
    filtered = filterEventsByDuration(filtered, eventDurationFilter);

    if (filtered.length === 0 && !upcomingEventsLoading) {
      return <p className={styles.noData}>No upcoming events</p>;
    }
    return (
      <div className={styles.upcomingList}>
        {filtered.map((ev) => (
          <div key={ev.id} className={styles.upcomingItem}>
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
          <button
            className={styles.showMoreBtn}
            onClick={handleShowMoreEvents}
            disabled={upcomingEventsLoading}
          >
            {upcomingEventsLoading ? "Loading..." : "Show More ▼"}
          </button>
        )}
      </div>
    );
  };

  // ── Render upcoming tasks list ──
  const renderUpcomingTasks = () => {
    let filtered = filterTasksByType(upcomingTasks, taskTypeFilter);
    filtered = filterTasksByDuration(filtered, taskDurationFilter);

    if (filtered.length === 0 && !upcomingTasksLoading) {
      return <p className={styles.noData}>No upcoming tasks</p>;
    }
    return (
      <div className={styles.upcomingList}>
        {filtered.map((task) => {
          const pct =
            task.total_items > 0
              ? Math.round((task.completed_items / task.total_items) * 100)
              : 0;
          return (
            <div
              key={task.id}
              className={`${styles.taskCard} ${getPriorityClass(task.priority)}`}
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
                  {formatTime(task.start_datetime)} —{" "}
                  {formatTime(task.end_datetime)}
                </span>
              </div>
              <div className={styles.taskMetaRow}>
                <span className={styles.taskMetaItem}>
                  <VisibilityOutlinedIcon fontSize="small" />
                  {task.type}
                </span>
              </div>

              <p className={styles.taskDesc}>
                {task.description?.substring(0, 60)}...
              </p>

              <div className={styles.checklistRow}>
                <span className={styles.checklistLabel}>
                  <ChecklistOutlinedIcon fontSize="small" />
                  Checklist Progress
                </span>
                <span className={styles.checklistFraction}>
                  {task.completed_items}/{task.total_items}
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
        {upcomingTasksHasMore && (
          <button
            className={styles.showMoreBtn}
            onClick={handleShowMoreTasks}
            disabled={upcomingTasksLoading}
          >
            {upcomingTasksLoading ? (
              "Loading..."
            ) : (
              <span>
                Show More
                <span>
                  <KeyboardArrowDownOutlinedIcon />
                </span>
              </span>
            )}
          </button>
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
              .join(" | ") || "No additional details"}
          </p>
        )}
      </div>

      {/* Quick Stats */}
      <div className={styles.quickStat}>
        <div className={styles.quickTop}>
          <div className={styles.quickTopLeft}>
            <h2>
              Quick Stats,{" "}
              <span className={styles.quickStatType}>
                {quickStatType === "task"
                  ? "Tasks"
                  : quickStatType.charAt(0).toUpperCase() +
                    quickStatType.slice(1) +
                    " Events"}
              </span>
            </h2>
            <div className={styles.quickNav}>
              <div className={styles.filterButtons}>
                <button
                  type="button"
                  className={`${styles.pillBtn} ${statsRange === "week" ? styles.pillBtnActive : ""}`}
                  onClick={() => handleStatsRangeChange("week")}
                >
                  This Week
                </button>
                <button
                  type="button"
                  className={`${styles.pillBtn} ${statsRange === "month" ? styles.pillBtnActive : ""}`}
                  onClick={() => handleStatsRangeChange("month")}
                >
                  This Month
                </button>
              </div>
            </div>
          </div>
          <div className={styles.quickTopRight}>
            <div className={styles.btnContainer}>
              <button
                className={styles.circleArrowButton}
                onClick={() => handleQuickStatArrow(-1)}
              >
                <IoIosArrowBack />
              </button>
              <button
                className={styles.circleArrowButton}
                onClick={() => handleQuickStatArrow(1)}
              >
                <IoIosArrowForward />
              </button>
            </div>
            <button
              type="button"
              className={styles.viewLink}
              onClick={gotoAnalytics}
            >
              View Analytics
            </button>
          </div>
        </div>

        {statsLoading ? (
          <p className={styles.noData}>Loading stats...</p>
        ) : (
          renderStats()
        )}
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
          <div className={styles.subTitle}>
            <h2>{formatDate(new Date())}</h2>
          </div>
        </div>

        <div className={styles.todayContent}>{renderTodayEvent()}</div>
      </div>

      {/* Upcoming Events */}
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

        {/* ─── Pill Filters for Events ─── */}
        <div className={styles.filterRow}>
          {[
            { value: "all", label: "All Types" },
            { value: "campus", label: "Campus" },
            { value: "department", label: "Department" },
            { value: "private", label: "Private" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.pillBtn} ${eventTypeFilter === opt.value ? styles.pillBtnActive : ""}`}
              onClick={() => setEventTypeFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className={styles.filterRow}>
          {[
            { value: "all", label: "All Time" },
            { value: "week", label: "This Week" },
            { value: "month", label: "This Month" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.pillBtn} ${eventDurationFilter === opt.value ? styles.pillBtnActive : ""}`}
              onClick={() => setEventDurationFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className={styles.upcomingContent}>
          {upcomingEventsLoading && upcomingEvents.length === 0 ? (
            <p className={styles.noData}>Loading...</p>
          ) : (
            renderUpcomingEvents()
          )}
        </div>
      </div>

      {/* Upcoming Tasks */}
      <div className={styles.upcomingTask}>
        <div className={styles.upcomingHeader}>
          <h2>Upcoming Tasks</h2>
          <button
            type="button"
            className={styles.viewLink}
            onClick={gotoTaskLists}
          >
            View Task Lists
          </button>
        </div>

        {/* ─── Pill Filters for Tasks ─── */}
        <div className={styles.filterRow}>
          {[
            { value: "all", label: "All Task" },
            { value: "personal", label: "Personal Task" },
            { value: "campus", label: "Campus Task" },
            { value: "department", label: "Department Task" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.pillBtn} ${taskTypeFilter === opt.value ? styles.pillBtnActive : ""}`}
              onClick={() => setTaskTypeFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>
        <div className={styles.filterRow}>
          {[
            { value: "all", label: "All Time" },
            { value: "week", label: "This Week" },
            { value: "month", label: "This Month" },
          ].map((opt) => (
            <button
              key={opt.value}
              type="button"
              className={`${styles.pillBtn} ${taskDurationFilter === opt.value ? styles.pillBtnActive : ""}`}
              onClick={() => setTaskDurationFilter(opt.value)}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className={styles.upcomingContent}>
          {upcomingTasksLoading && upcomingTasks.length === 0 ? (
            <p className={styles.noData}>Loading...</p>
          ) : (
            renderUpcomingTasks()
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
