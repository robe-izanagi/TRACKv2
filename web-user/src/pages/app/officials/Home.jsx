import React, { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import { IoIosArrowForward, IoIosArrowBack } from "react-icons/io";
import apiClient from "../../../api/client";
import { useAuth } from "../../../context/AuthContext";
import styles from "./Home.module.css";

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
  const [upcomingTasks, setUpcomingTasks] = useState([]);
  const [upcomingTasksLoading, setUpcomingTasksLoading] = useState(false);
  const [upcomingTasksOffset, setUpcomingTasksOffset] = useState(0);
  const [upcomingTasksHasMore, setUpcomingTasksHasMore] = useState(true);

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

  // ── Render today's event (FIXED: use flattened creator properties) ──
  const renderTodayEvent = () => {
    if (todayLoading) return <p>Loading today's event...</p>;
    if (!todayEvent) return <p>No events today</p>;

    const creator = todayEvent.creator || {};
    const parts = [
      creator.username,
      creator.position,
      creator.department,
      creator.office,
    ].filter(Boolean);
    const creatorDisplay = parts.join(" | ");

    const participants = todayEvent.participants || {};
    const depts = participants.departments || [];
    const offices = participants.offices || [];

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
        {(depts.length > 0 || offices.length > 0) && (
          <div className={styles.todayParticipants}>
            {depts.length > 0 && <div>Colleges: {depts.join(", ")}</div>}
            {offices.length > 0 && <div>Offices: {offices.join(", ")}</div>}
          </div>
        )}
      </div>
    );
  };

  // ── Render upcoming events list ──
  const renderUpcomingEvents = () => {
    if (upcomingEvents.length === 0 && !upcomingEventsLoading) {
      return <p className={styles.noData}>No upcoming events</p>;
    }
    return (
      <div className={styles.upcomingList}>
        {upcomingEvents.map((ev) => (
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
    if (upcomingTasks.length === 0 && !upcomingTasksLoading) {
      return <p className={styles.noData}>No upcoming tasks</p>;
    }
    return (
      <div className={styles.upcomingList}>
        {upcomingTasks.map((task) => (
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
        <div className={styles.upcomingFilters}>
          <button>This Week</button>
          <button>Next Week</button>
          <button>This Month</button>
          <button>Next Month</button>
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
        <div className={styles.upcomingFilters}>
          <button>All Task</button>
          <button>Personal Task</button>
          <button>Campus Task</button>
          <button>Department Task</button>
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
