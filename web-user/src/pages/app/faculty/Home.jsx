import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { IoIosArrowForward, IoIosArrowBack } from "react-icons/io";
import apiClient from "../../../api/client";
import { useAuth } from "../../../context/AuthContext";
// import styles from "./Home.module.css";

// Helper to format date
const formatDate = (dateStr) => {
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
    fetchQuickStats(quickStatType);
    fetchTodayEvent();
    fetchUpcomingEvents(true);
    fetchUpcomingTasks(true);
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
    if (!quickStats) return <p>No data</p>;
    if (quickStatType === "task") {
      return (
        <div className={styles.statsGrid}>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>
              {quickStats.completed || 0}
            </span>
            <span className={styles.statLabel}>Completed</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{quickStats.missed || 0}</span>
            <span className={styles.statLabel}>Missed</span>
          </div>
          <div className={styles.statItem}>
            <span className={styles.statNumber}>{quickStats.pending || 0}</span>
            <span className={styles.statLabel}>Pending</span>
          </div>
        </div>
      );
    }
    return (
      <div className={styles.statsGrid}>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{quickStats.total || 0}</span>
          <span className={styles.statLabel}>Events</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{quickStats.accepted || 0}</span>
          <span className={styles.statLabel}>Accepted</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{quickStats.declined || 0}</span>
          <span className={styles.statLabel}>Declined</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{quickStats.missed || 0}</span>
          <span className={styles.statLabel}>Missed</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>{quickStats.pending || 0}</span>
          <span className={styles.statLabel}>Pending</span>
        </div>
        <div className={styles.statItem}>
          <span className={styles.statNumber}>
            {quickStats.conflicted || 0}
          </span>
          <span className={styles.statLabel}>Conflicted</span>
        </div>
      </div>
    );
  };

  // ── Render today's event ──
  const renderTodayEvent = () => {
    if (todayLoading) return <p>Loading today's event...</p>;
    if (!todayEvent) return <p>No events today</p>;

    const creator = todayEvent.creator || {};
    const creatorName = creator.full_name || creator.username || "Unknown";
    const parts = [
      creatorName,
      creator.position,
      creator.department,
      creator.office,
    ].filter(Boolean);
    const creatorDisplay = parts.join(" | ");

    const participants = todayEvent.participants || {};
    const depts = participants.departments || [];
    const offices = participants.offices || [];
    const users = participants.users || [];

    return (
      <div className={styles.todayCard}>
        <h3>{todayEvent.title}</h3>
        <p className={styles.todayDesc}>{todayEvent.description}</p>
        <div className={styles.todayMeta}>
          <span>
            📅 {formatDate(todayEvent.start_datetime)} -{" "}
            {formatDate(todayEvent.end_datetime)}
          </span>
          <span>
            ⏰ {formatTime(todayEvent.start_datetime)} -{" "}
            {formatTime(todayEvent.end_datetime)}
          </span>
          <span>📍 {todayEvent.venue || todayEvent.location || "Online"}</span>
        </div>
        <div className={styles.todayTags}>
          <span className={styles.tag}>{todayEvent.method}</span>
          <span className={styles.tag}>{todayEvent.hierarchy}</span>
          <span className={styles.tag}>{todayEvent.event_type}</span>
        </div>
        <div className={styles.todayCreator}>
          <strong>{creatorDisplay}</strong>
        </div>

        {/* ── Participants Section ── */}
        {(depts.length > 0 || offices.length > 0 || users.length > 0) && (
          <div className={styles.todayParticipants}>
            {depts.length > 0 && (
              <div className={styles.participantGroup}>
                <span className={styles.participantLabel}>Colleges:</span>
                <span>{depts.join(", ")}</span>
              </div>
            )}
            {offices.length > 0 && (
              <div className={styles.participantGroup}>
                <span className={styles.participantLabel}>Offices:</span>
                <span>{offices.join(", ")}</span>
              </div>
            )}
            {users.length > 0 && (
              <div className={styles.participantGroup}>
                <span className={styles.participantLabel}>Attendees:</span>
                <div className={styles.userList}>
                  {users.slice(0, 5).map((u) => (
                    <span key={u.id} className={styles.userTag}>
                      {u.full_name || u.username || u.email || "Unknown"}
                      {u.department && ` (${u.department})`}
                    </span>
                  ))}
                  {users.length > 5 && (
                    <span className={styles.moreTag}>
                      +{users.length - 5} more
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
              <span className={styles.monthDay}>
                {formatDate(ev.start_datetime)}
              </span>
            </div>
            <div className={styles.upcomingInfo}>
              <h4>{ev.title}</h4>
              <p>{ev.description?.substring(0, 60)}...</p>
              <div className={styles.upcomingMeta}>
                <span>{formatTime(ev.start_datetime)}</span>
                <span>{ev.venue || ev.location || "Online"}</span>
                <span>{ev.event_type}</span>
              </div>
            </div>
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
        {filtered.map((task) => (
          <div key={task.id} className={styles.upcomingItem}>
            <div className={styles.upcomingInfo}>
              <h4>{task.title}</h4>
              <p>{task.description?.substring(0, 60)}...</p>
              <div className={styles.upcomingMeta}>
                <span>{formatTime(task.start_datetime)}</span>
                <span>{task.type}</span>
                <span
                  className={`${styles.priority} ${styles[task.priority?.toLowerCase()]}`}
                >
                  {task.priority}
                </span>
              </div>
              <div className={styles.taskProgress}>
                <span>
                  Checklist: {task.completed_items}/{task.total_items}
                </span>
              </div>
            </div>
          </div>
        ))}
        {upcomingTasksHasMore && (
          <button
            className={styles.showMoreBtn}
            onClick={handleShowMoreTasks}
            disabled={upcomingTasksLoading}
          >
            {upcomingTasksLoading ? "Loading..." : "Show More ▼"}
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
          Welcome, {displayUser?.full_name || displayUser?.username || "User"}
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
          <h2>
            Quick Stats,{" "}
            {quickStatType === "task"
              ? "Tasks"
              : quickStatType.charAt(0).toUpperCase() +
                quickStatType.slice(1) +
                " Events"}
          </h2>
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
        </div>
        <div className={styles.quickNav}>
          <div className={styles.filterButtons}>
            <button
              type="button"
              onClick={() => fetchQuickStats(quickStatType, "week")}
            >
              This Week
            </button>
            <button
              type="button"
              onClick={() => fetchQuickStats(quickStatType, "month")}
            >
              This Month
            </button>
          </div>
          <button type="button" onClick={gotoAnalytics}>
            View Analytics
          </button>
        </div>
        {statsLoading ? <p>Loading stats...</p> : renderStats()}
      </div>

      {/* Today's Event */}
      <div className={styles.todaysEvent}>
        <div className={styles.titleContainer}>
          <div className={styles.titleContent}>
            <h1>Today's Event</h1>
          </div>
          <div className={styles.subTitle}>
            <h2>{formatDate(new Date())}</h2>
            <button type="button" onClick={gotoCalendar}>
              View Calendar
            </button>
          </div>
        </div>
        <div className={styles.todayContent}>{renderTodayEvent()}</div>
      </div>

      {/* Upcoming Events */}
      <div className={styles.upcomingEvent}>
        <div className={styles.upcomingHeader}>
          <h2>Upcoming Events</h2>
          <button type="button" onClick={gotoCalendar}>
            View Calendar
          </button>
        </div>

        {/* ─── Dropdown Filters for Events ─── */}
        <div className={styles.filterRow}>
          <select
            className={styles.filterSelect}
            value={eventTypeFilter}
            onChange={(e) => {
              setEventTypeFilter(e.target.value);
              // Optionally reset pagination if needed
            }}
          >
            <option value="all">All Types</option>
            <option value="campus">Campus</option>
            <option value="department">Department</option>
            <option value="private">Private</option>
          </select>

          <select
            className={styles.filterSelect}
            value={eventDurationFilter}
            onChange={(e) => setEventDurationFilter(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        <div className={styles.upcomingContent}>
          {upcomingEventsLoading && upcomingEvents.length === 0 ? (
            <p>Loading...</p>
          ) : (
            renderUpcomingEvents()
          )}
        </div>
      </div>

      {/* Upcoming Tasks */}
      <div className={styles.upcomingTask}>
        <div className={styles.upcomingHeader}>
          <h2>Upcoming Tasks</h2>
          <button type="button" onClick={gotoTaskLists}>
            View Task Lists
          </button>
        </div>

        {/* ─── Dropdown Filters for Tasks ─── */}
        <div className={styles.filterRow}>
          <select
            className={styles.filterSelect}
            value={taskTypeFilter}
            onChange={(e) => setTaskTypeFilter(e.target.value)}
          >
            <option value="all">All Types</option>
            <option value="personal">Personal</option>
            <option value="campus">Campus</option>
            <option value="department">Department</option>
          </select>

          <select
            className={styles.filterSelect}
            value={taskDurationFilter}
            onChange={(e) => setTaskDurationFilter(e.target.value)}
          >
            <option value="all">All Time</option>
            <option value="week">This Week</option>
            <option value="month">This Month</option>
          </select>
        </div>

        <div className={styles.upcomingContent}>
          {upcomingTasksLoading && upcomingTasks.length === 0 ? (
            <p>Loading...</p>
          ) : (
            renderUpcomingTasks()
          )}
        </div>
      </div>
    </div>
  );
}

export default Home;
