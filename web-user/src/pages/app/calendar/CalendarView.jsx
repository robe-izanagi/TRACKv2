import { useState, useMemo, useCallback, useRef, useEffect } from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiX,
  FiChevronDown,
  FiGlobe,
  FiUsers,
  FiLock,
  FiTarget,
} from "react-icons/fi";
import apiClient from "../../../api/client";
import { getInvitations } from "../../../api/notifications"; // ✅ new import
import styles from "./CalendarView.module.css";

// ── Constants ──────────────────────────────────────
const MONTH_NAMES = [
  "January",
  "February",
  "March",
  "April",
  "May",
  "June",
  "July",
  "August",
  "September",
  "October",
  "November",
  "December",
];
const DAY_NAMES = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];

// ── Helpers ────────────────────────────────────────
const generateMonthGrid = (year, month) => {
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startOffset = -firstDayOfMonth;
  const totalCells = 35;
  const grid = [];
  for (let i = 0; i < totalCells; i++) {
    const date = new Date(year, month, 1 + i + startOffset);
    const d = date.getDate();
    const m = date.getMonth();
    const y = date.getFullYear();
    const dateStr = `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
    const isCurrentMonth = m === month && y === year;
    grid.push({ day: d, dateStr, isCurrentMonth });
  }
  return grid;
};

const getWeekDays = (date) => {
  const days = [];
  for (let i = 0; i < 7; i++) {
    const d = new Date(date);
    d.setDate(d.getDate() + i);
    days.push(d);
  }
  return days;
};

const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

const HOUR_HEIGHT = 64;

export default function CalendarView() {
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 1));
  const [selectedDate, setSelectedDate] = useState("2026-06-10");
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeFilters, setActiveFilters] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [duration, setDuration] = useState("month");

  const touchStartX = useRef(0);
  const touchEndX = useRef(0);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const currentYear = new Date().getFullYear();
  const yearOptions = Array.from({ length: 11 }, (_, i) => currentYear - 5 + i);

  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [currentDate]);

  const weekDays = useMemo(() => getWeekDays(weekStart), [weekStart]);
  const monthGrid = useMemo(
    () => generateMonthGrid(year, month),
    [year, month],
  );

  // ── Events state ──────────────────────────────────
  const [holidays, setHolidays] = useState([]);
  const [userEvents, setUserEvents] = useState([]);
  const [pendingEventIds, setPendingEventIds] = useState([]); // ✅ IDs of pending invitations

  const visibleRange = useMemo(() => {
    let start, end;
    if (duration === "day") {
      start = selectedDate;
      end = selectedDate;
    } else if (duration === "week") {
      const d = new Date(weekStart);
      start = d.toISOString().slice(0, 10);
      d.setDate(d.getDate() + 6);
      end = d.toISOString().slice(0, 10);
    } else {
      const firstDay = new Date(year, month, 1);
      const lastDay = new Date(year, month + 1, 0);
      start = firstDay.toISOString().slice(0, 10);
      end = lastDay.toISOString().slice(0, 10);
    }
    return { start, end };
  }, [duration, selectedDate, weekStart, year, month]);

  // ── Fetch holidays ───────────────────────────────
  useEffect(() => {
    fetch("https://trackv2-68rg.onrender.com/data/holidays.json")
      .then((res) => res.json())
      .then((data) => setHolidays(data))
      .catch(() => {});
  }, []);

  // ── Fetch user events ────────────────────────────
  useEffect(() => {
    const fetchEvents = async () => {
      try {
        const res = await apiClient.get("/events", {
          params: { start: visibleRange.start, end: visibleRange.end },
        });
        setUserEvents(res.data.events || []);
      } catch (err) {
        console.error("Failed to fetch events:", err);
      }
    };
    fetchEvents();
  }, [visibleRange.start, visibleRange.end]);

  // ── Fetch pending invitations (to hide them) ─────
  useEffect(() => {
    const fetchPending = async () => {
      try {
        const data = await getInvitations({ response: "pending" });
        const ids = data.events.map((ev) => ev.id);
        setPendingEventIds(ids);
      } catch (err) {
        console.error("Failed to fetch pending invitations:", err);
      }
    };
    fetchPending();
  }, [visibleRange.start, visibleRange.end]); // refetch when range changes

  // ── Combine events, excluding pending ones ──────
  const allEvents = useMemo(() => {
    // Filter out user events that are pending
    const filteredUserEvents = userEvents.filter(
      (ev) => !pendingEventIds.includes(ev.id),
    );
    return [...holidays, ...filteredUserEvents];
  }, [holidays, userEvents, pendingEventIds]);

  const filteredEvents = useMemo(() => {
    if (activeFilters.length === 0) return allEvents;
    return allEvents.filter((e) => activeFilters.includes(e.type));
  }, [activeFilters, allEvents]);

  const eventCounts = useMemo(() => {
    const counts = { all: allEvents.length };
    allEvents.forEach((e) => {
      counts[e.type] = (counts[e.type] || 0) + 1;
    });
    return counts;
  }, [allEvents]);

  const eventsByDate = useMemo(() => {
    const map = {};
    filteredEvents.forEach((ev) => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [filteredEvents]);

  const dailyEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];

  const todayStr = new Date().toISOString().slice(0, 10);

  // ── Navigation ───────────────────────────────────
  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(today.toISOString().slice(0, 10));
  };

  const navigate = (direction) => {
    const date = new Date(currentDate);
    if (duration === "day") {
      date.setDate(date.getDate() + direction);
      setSelectedDate(date.toISOString().slice(0, 10));
    } else if (duration === "week") {
      date.setDate(date.getDate() + direction * 7);
    } else if (duration === "month") {
      date.setMonth(date.getMonth() + direction);
    }
    setCurrentDate(date);
  };

  const goToPrev = () => navigate(-1);
  const goToNext = () => navigate(1);

  const handleTouchStart = (e) => {
    touchStartX.current = e.touches[0].clientX;
  };
  const handleTouchEnd = (e) => {
    touchEndX.current = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX.current;
    if (Math.abs(diff) > 50) diff > 0 ? goToNext() : goToPrev();
  };

  const handleDayClick = useCallback(
    (dateStr) => {
      setSelectedDate(dateStr);
      setSelectedEvent(null);
      if (duration !== "day") setSheetOpen(true);
    },
    [duration],
  );

  const handleEventClick = useCallback((ev) => {
    setSelectedEvent(ev);
    setSheetOpen(true);
  }, []);
  const closeSheet = () => {
    setSheetOpen(false);
    setSelectedEvent(null);
  };

  const headerTitle = useMemo(() => {
    if (duration === "day") {
      return new Date(selectedDate + "T12:00:00").toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
        year: "numeric",
      });
    }
    if (duration === "week") {
      const start = new Date(weekStart);
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      const startStr = start.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
      });
      const endStr = end.toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      });
      return `${startStr} – ${endStr}`;
    }
    return `${MONTH_NAMES[month]} ${year}`;
  }, [duration, selectedDate, weekStart, month, year]);

  const monthOptions = MONTH_NAMES.map((name, idx) => ({
    value: idx,
    label: name,
  }));

  const handleMonthChange = (e) => {
    const newMonth = parseInt(e.target.value, 10);
    const newDate = new Date(currentDate);
    newDate.setMonth(newMonth);
    if (duration === "day") {
      newDate.setDate(1);
      setSelectedDate(newDate.toISOString().slice(0, 10));
    } else if (duration === "week") {
      newDate.setDate(1);
    }
    setCurrentDate(newDate);
  };

  const handleYearChange = (e) => {
    const newYear = parseInt(e.target.value, 10);
    const newDate = new Date(currentDate);
    newDate.setFullYear(newYear);
    if (duration === "day") {
      if (newDate.getMonth() !== month) newDate.setDate(1);
      setSelectedDate(newDate.toISOString().slice(0, 10));
    } else if (duration === "week") {
      newDate.setDate(1);
    }
    setCurrentDate(newDate);
  };

  const toggleFilter = (type) => {
    setActiveFilters((prev) => {
      if (type === "all" || prev.includes("all")) return [];
      if (prev.includes(type)) {
        const next = prev.filter((t) => t !== type);
        return next.length === 0 ? [] : next;
      }
      return [...prev, type];
    });
  };

  return (
    <div className={styles.pageWrapper}>
      <div
        className={styles.container}
        onTouchStart={handleTouchStart}
        onTouchEnd={handleTouchEnd}
      >
        {/* Header */}
        <div className={styles.header}>
          <button onClick={goToPrev} className={styles.navBtn}>
            <FiChevronLeft size={20} />
          </button>
          <h2 className={styles.headerTitle}>{headerTitle}</h2>
          <button onClick={goToNext} className={styles.navBtn}>
            <FiChevronRight size={20} />
          </button>
        </div>

        {/* Controls row */}
        <div className={styles.controlsRow}>
          <button
            className={`${styles.chip} ${styles.todayChip}`}
            onClick={goToToday}
          >
            Today
          </button>
          <select
            className={styles.durationSelect}
            value={duration}
            onChange={(e) => setDuration(e.target.value)}
          >
            <option value="day">Day</option>
            <option value="week">Week</option>
            <option value="month">Month</option>
          </select>
          <select
            className={styles.monthSelect}
            value={month}
            onChange={handleMonthChange}
          >
            {monthOptions.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          <select
            className={styles.yearSelect}
            value={year}
            onChange={handleYearChange}
          >
            {yearOptions.map((y) => (
              <option key={y} value={y}>
                {y}
              </option>
            ))}
          </select>
        </div>

        {/* Filter chips */}
        <div className={`${styles.chipRow} ${styles.scrollableRow}`}>
          <button
            className={`${styles.chip} ${activeFilters.length === 0 ? styles.chipActive : ""}`}
            onClick={() => toggleFilter("all")}
          >
            <FiTarget size={14} style={{ marginRight: 4 }} /> All (
            {eventCounts.all})
          </button>
          <button
            className={`${styles.chip} ${activeFilters.includes("campus") ? styles.chipActive : ""}`}
            onClick={() => toggleFilter("campus")}
          >
            <FiGlobe size={14} style={{ marginRight: 4 }} /> Campus (
            {eventCounts.campus || 0})
          </button>
          <button
            className={`${styles.chip} ${activeFilters.includes("department") ? styles.chipActive : ""}`}
            onClick={() => toggleFilter("department")}
          >
            <FiUsers size={14} style={{ marginRight: 4 }} /> Dept (
            {eventCounts.department || 0})
          </button>
          <button
            className={`${styles.chip} ${activeFilters.includes("personal") ? styles.chipActive : ""}`}
            onClick={() => toggleFilter("personal")}
          >
            <FiLock size={14} style={{ marginRight: 4 }} /> Private (
            {eventCounts.personal || 0})
          </button>
        </div>

        {/* ===== Day / Week / Month views ===== */}
        {duration === "day" && (
          <div className={styles.dailyContainer}>
            <div className={styles.timelineWrapper}>
              {Array.from({ length: 24 }, (_, i) => (
                <div key={i} className={styles.hourSlot}>
                  <span className={styles.hourLabel}>
                    {i === 0
                      ? "12 AM"
                      : i < 12
                        ? `${i} AM`
                        : i === 12
                          ? "12 PM"
                          : `${i - 12} PM`}
                  </span>
                  <div className={styles.hourLine} />
                </div>
              ))}
              {dailyEvents.map((ev) => {
                const startMin = timeToMinutes(ev.time);
                const endMin = timeToMinutes(ev.endTime);
                const top = (startMin / 60) * HOUR_HEIGHT;
                const height = ((endMin - startMin) / 60) * HOUR_HEIGHT;
                return (
                  <div
                    key={ev.id}
                    className={styles.timelineEvent}
                    style={{ backgroundColor: ev.color, top, height }}
                    onClick={() => handleEventClick(ev)}
                  >
                    <span className={styles.eventTitle}>{ev.title}</span>
                    <span className={styles.eventTime}>
                      {ev.time} – {ev.endTime}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {duration === "week" && (
          <div className={styles.weekContainer}>
            <div className={styles.weekGrid}>
              {/* Week day headers – highlight today */}
              <div className={styles.weekDayHeader}>
                {weekDays.map((day, idx) => {
                  const dateStr = day.toISOString().slice(0, 10);
                  const isToday = dateStr === todayStr;
                  return (
                    <div
                      key={idx}
                      className={`${styles.weekDayLabel} ${isToday ? styles.weekDayLabelToday : ""}`}
                    >
                      <span className={styles.weekDayName}>
                        {DAY_NAMES[day.getDay()]}
                      </span>
                      <span className={styles.weekDayNumber}>
                        {day.getDate()}
                      </span>
                    </div>
                  );
                })}
              </div>
              {/* Time rows */}
              <div className={styles.weekTimeline}>
                {Array.from({ length: 24 }, (_, hour) => (
                  <div key={hour} className={styles.weekHourRow}>
                    <span className={styles.weekHourLabel}>
                      {hour === 0
                        ? "12 AM"
                        : hour < 12
                          ? `${hour} AM`
                          : hour === 12
                            ? "12 PM"
                            : `${hour - 12} PM`}
                    </span>
                    <div className={styles.weekHourCells}>
                      {weekDays.map((day, dayIdx) => {
                        const dateStr = day.toISOString().slice(0, 10);
                        const isToday = dateStr === todayStr;
                        const events = eventsByDate[dateStr] || [];
                        const eventsAtHour = events.filter(
                          (ev) => parseInt(ev.time, 10) === hour,
                        );
                        return (
                          <div
                            key={dayIdx}
                            className={`${styles.weekCell} ${isToday ? styles.weekCellToday : ""}`}
                          >
                            {eventsAtHour.map((ev) => (
                              <div
                                key={ev.id}
                                className={styles.weekEvent}
                                style={{ backgroundColor: ev.color }}
                                onClick={() => handleEventClick(ev)}
                              >
                                {ev.title}
                              </div>
                            ))}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {duration === "month" && (
          <div className={styles.calendarGridContainer}>
            <div className={styles.calendarGrid}>
              {DAY_NAMES.map((day) => (
                <div key={day} className={styles.dayHeader}>
                  {day}
                </div>
              ))}
              {monthGrid.map((cell, idx) => {
                const events = eventsByDate[cell.dateStr] || [];
                const isToday = cell.dateStr === todayStr;
                const isSelected = cell.dateStr === selectedDate;
                return (
                  <button
                    key={idx}
                    className={`${styles.dayCell} ${!cell.isCurrentMonth ? styles.otherMonthCell : ""} ${isToday ? styles.todayCell : ""} ${isSelected ? styles.activeCell : ""}`}
                    onClick={() => handleDayClick(cell.dateStr)}
                  >
                    <span
                      className={`${styles.dayNumber} ${!cell.isCurrentMonth ? styles.otherMonthNumber : ""}`}
                    >
                      {cell.day}
                    </span>
                    {cell.isCurrentMonth && events.length > 0 && (
                      <div className={styles.eventPills}>
                        {events.slice(0, 2).map((ev) => (
                          <span
                            key={ev.id}
                            className={styles.eventPill}
                            style={{ backgroundColor: ev.color }}
                            onClick={(e) => {
                              e.stopPropagation();
                              handleEventClick(ev);
                            }}
                          >
                            {ev.title.substring(0, 10)}
                            {ev.title.length > 10 ? "…" : ""}
                          </span>
                        ))}
                        {events.length > 2 && (
                          <span className={styles.morePill}>
                            +{events.length - 2}
                          </span>
                        )}
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>
        )}

        {/* Bottom Sheet */}
        {sheetOpen && (
          <div className={styles.sheetOverlay} onClick={closeSheet}>
            <div className={styles.sheet} onClick={(e) => e.stopPropagation()}>
              <div className={styles.sheetHandle}>
                <FiChevronDown size={20} />
              </div>
              {selectedEvent ? (
                <div className={styles.eventDetail}>
                  <button
                    className={styles.backBtn}
                    onClick={() => setSelectedEvent(null)}
                  >
                    ← Back
                  </button>
                  <h3>{selectedEvent.title}</h3>
                  <div className={styles.meta}>
                    <div>
                      <strong>Date:</strong> {selectedEvent.date}
                    </div>
                    <div>
                      <strong>Time:</strong> {selectedEvent.time} –{" "}
                      {selectedEvent.endTime}
                    </div>
                    <div>
                      <strong>Type:</strong> {selectedEvent.type}
                    </div>
                    {selectedEvent.location && (
                      <div>
                        <strong>Location:</strong> {selectedEvent.location}
                      </div>
                    )}
                  </div>
                  <p className={styles.desc}>{selectedEvent.description}</p>
                </div>
              ) : (
                <div className={styles.agenda}>
                  <h3 className={styles.agendaTitle}>
                    {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { weekday: "long", month: "short", day: "numeric" },
                    )}
                  </h3>
                  {dailyEvents.length === 0 && (
                    <p className={styles.noTasks}>No events</p>
                  )}
                  {dailyEvents.map((ev) => (
                    <div
                      key={ev.id}
                      className={styles.agendaItem}
                      onClick={() => handleEventClick(ev)}
                      style={{ borderLeftColor: ev.color }}
                    >
                      <div className={styles.agendaTime}>
                        {ev.time} – {ev.endTime}
                      </div>
                      <div className={styles.agendaInfo}>
                        <div className={styles.agendaTitle}>{ev.title}</div>
                        <div className={styles.agendaMeta}>
                          {ev.type} · {ev.location}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
              <button className={styles.closeBtn} onClick={closeSheet}>
                <FiX size={20} />
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
