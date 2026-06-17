import { useState, useMemo, useCallback } from "react";
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
import styles from "./CalendarView.module.css";

// ── Sample events for June 2026 ─────────────────
const SAMPLE_EVENTS = [
  {
    id: 1,
    title: "Campus Orientation",
    date: "2026-06-01",
    time: "08:00",
    endTime: "12:00",
    type: "campus",
    color: "#800000",
    description: "Freshmen orientation program.",
    location: "Gymnasium",
  },
  {
    id: 2,
    title: "Faculty Assembly",
    date: "2026-06-10",
    time: "09:00",
    endTime: "10:30",
    type: "campus",
    color: "#800000",
    description: "Monthly faculty general assembly.",
    location: "Main Auditorium",
  },
  {
    id: 3,
    title: "Thesis Advisory",
    date: "2026-06-10",
    time: "13:00",
    endTime: "14:00",
    type: "personal",
    color: "#1e40af",
    description: "Review student thesis drafts.",
    location: "Office Room 301",
  },
  {
    id: 4,
    title: "Research Abstract",
    date: "2026-06-12",
    time: "10:00",
    endTime: "11:00",
    type: "department",
    color: "#b45309",
    description: "Submit abstract for conference.",
    location: "ICT Dept.",
  },
  {
    id: 5,
    title: "Library Archiving",
    date: "2026-06-15",
    time: "14:00",
    endTime: "17:00",
    type: "campus",
    color: "#047857",
    description: "Archive old publications.",
    location: "Library",
  },
  {
    id: 6,
    title: "Curriculum Planning",
    date: "2026-06-18",
    time: "08:00",
    endTime: "12:00",
    type: "department",
    color: "#b45309",
    description: "Plan next semester subjects.",
    location: "CICS Conference",
  },
  {
    id: 7,
    title: "Consultation Hours",
    date: "2026-06-22",
    time: "15:00",
    endTime: "16:30",
    type: "personal",
    color: "#1e40af",
    description: "Student consultation.",
    location: "Room 301",
  },
  {
    id: 8,
    title: "Dept Meeting",
    date: "2026-06-05",
    time: "09:00",
    endTime: "10:00",
    type: "department",
    color: "#b45309",
    description: "Monthly meeting.",
    location: "Boardroom",
  },
  {
    id: 9,
    title: "Grant Writing",
    date: "2026-06-08",
    time: "11:00",
    endTime: "13:00",
    type: "personal",
    color: "#1e40af",
    description: "Draft proposal.",
    location: "Office",
  },
  // previous month (May) for edge cases
  {
    id: 10,
    title: "Welcome Back",
    date: "2026-05-28",
    time: "09:00",
    endTime: "10:00",
    type: "campus",
    color: "#800000",
    description: "Welcome event.",
    location: "Auditorium",
  },
  {
    id: 11,
    title: "Year‑End Planning",
    date: "2026-05-30",
    time: "13:00",
    endTime: "15:00",
    type: "department",
    color: "#b45309",
    description: "Review reports.",
    location: "Dean's Office",
  },
];

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
const ALL_MONTH_ABBR = [
  "JAN",
  "FEB",
  "MAR",
  "APR",
  "MAY",
  "JUN",
  "JUL",
  "AUG",
  "SEP",
  "OCT",
  "NOV",
  "DEC",
];

const getMonthIndexFromAbbr = (abbr) => {
  const m = {
    JAN: 0,
    FEB: 1,
    MAR: 2,
    APR: 3,
    MAY: 4,
    JUN: 5,
    JUL: 6,
    AUG: 7,
    SEP: 8,
    OCT: 9,
    NOV: 10,
    DEC: 11,
  };
  return m[abbr] ?? 5;
};

// Generate 35 cells for monthly grid
const generateMonthGrid = (year, month) => {
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startOffset = -firstDayOfMonth; // days before 1st
  const totalCells = 35; // 5 weeks * 7 days
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

// ── Daily Timeline Helpers ──────────────────────
const HOUR_HEIGHT = 64; // px per hour
const timeToMinutes = (timeStr) => {
  const [h, m] = timeStr.split(":").map(Number);
  return h * 60 + m;
};

export default function CalendarView() {
  // Current date for month navigation (year/month)
  const [currentDate, setCurrentDate] = useState(new Date(2026, 5, 1)); // June 2026
  const [selectedDate, setSelectedDate] = useState("2026-06-10"); // default selected day
  const [selectedEvent, setSelectedEvent] = useState(null);
  const [activeFilters, setActiveFilters] = useState([]);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [viewMode, setViewMode] = useState("monthly"); // daily, weekly, monthly, yearly

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  // Navigation helpers
  const goToPrevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const goToNextMonth = () => setCurrentDate(new Date(year, month + 1, 1));
  const goToToday = () => {
    const today = new Date(); // actual today: Jun 15, 2026
    setCurrentDate(new Date(today.getFullYear(), today.getMonth(), 1));
    setSelectedDate(today.toISOString().slice(0, 10));
  };
  const goToMonthFromAbbr = (abbr) => {
    const targetMonth = getMonthIndexFromAbbr(abbr);
    setCurrentDate(new Date(2026, targetMonth, 1));
  };

  // Daily navigation
  const goToPrevDay = () => {
    const prev = new Date(selectedDate + "T12:00:00");
    prev.setDate(prev.getDate() - 1);
    setSelectedDate(prev.toISOString().slice(0, 10));
  };
  const goToNextDay = () => {
    const next = new Date(selectedDate + "T12:00:00");
    next.setDate(next.getDate() + 1);
    setSelectedDate(next.toISOString().slice(0, 10));
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

  const filteredEvents = useMemo(() => {
    if (activeFilters.length === 0) return SAMPLE_EVENTS;
    return SAMPLE_EVENTS.filter((e) => activeFilters.includes(e.type));
  }, [activeFilters]);

  const eventCounts = useMemo(() => {
    const counts = { all: SAMPLE_EVENTS.length };
    SAMPLE_EVENTS.forEach((e) => {
      counts[e.type] = (counts[e.type] || 0) + 1;
    });
    return counts;
  }, []);

  const eventsByDate = useMemo(() => {
    const map = {};
    filteredEvents.forEach((ev) => {
      if (!map[ev.date]) map[ev.date] = [];
      map[ev.date].push(ev);
    });
    return map;
  }, [filteredEvents]);

  const monthGrid = useMemo(
    () => generateMonthGrid(year, month),
    [year, month],
  );

  // Handlers
  const handleDayClick = useCallback(
    (dateStr) => {
      setSelectedDate(dateStr);
      setSelectedEvent(null);
      if (viewMode === "daily") {
        // already in daily, just change day
      } else {
        setSheetOpen(true);
      }
    },
    [viewMode],
  );

  const handleEventClick = useCallback((ev) => {
    setSelectedEvent(ev);
    setSheetOpen(true);
  }, []);

  const closeSheet = () => {
    setSheetOpen(false);
    setSelectedEvent(null);
  };

  const agendaEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];
  const todayStr = new Date().toISOString().slice(0, 10); // dynamic today

  // ── Daily timeline: events for selected day ────
  const dailyEvents = eventsByDate[selectedDate] || [];
  const timelineSlots = useMemo(() => {
    return Array.from({ length: 24 }, (_, i) => ({
      hour: i,
      label:
        i === 0
          ? "12 AM"
          : i < 12
            ? `${i} AM`
            : i === 12
              ? "12 PM"
              : `${i - 12} PM`,
    }));
  }, []);

  // ── View mode buttons ─────────────────────────
  const viewButtons = ["Daily", "Weekly", "Monthly", "Yearly"];

  return (
    <div className={styles.container}>
      {/* ── Header ── */}
      {viewMode === "daily" ? (
        <div className={styles.header}>
          <button onClick={goToPrevDay} className={styles.navBtn}>
            <FiChevronLeft size={20} />
          </button>
          <div className={styles.dailyHeaderCenter}>
            <h2 className={styles.dailyDate}>
              {new Date(selectedDate + "T12:00:00").toLocaleDateString(
                "en-US",
                { weekday: "short", month: "short", day: "numeric" },
              )}
            </h2>
          </div>
          <button onClick={goToNextDay} className={styles.navBtn}>
            <FiChevronRight size={20} />
          </button>
        </div>
      ) : (
        <div className={styles.header}>
          <button onClick={goToPrevMonth} className={styles.navBtn}>
            <FiChevronLeft size={20} />
          </button>
          <h2 className={styles.monthTitle}>
            {MONTH_NAMES[month]} {year}
          </h2>
          <button onClick={goToNextMonth} className={styles.navBtn}>
            <FiChevronRight size={20} />
          </button>
        </div>
      )}

      {/* ── View mode + Today button (scrollable row) ── */}
      <div className={`${styles.chipRow} ${styles.scrollableRow}`}>
        <button
          className={`${styles.chip} ${styles.todayChip}`}
          onClick={goToToday}
        >
          Today
        </button>
        {viewButtons.map((v) => (
          <button
            key={v}
            className={`${styles.chip} ${styles.viewChip} ${viewMode === v.toLowerCase() ? styles.chipActive : ""}`}
            onClick={() => setViewMode(v.toLowerCase())}
          >
            {v}
          </button>
        ))}
      </div>

      {/* ── Filter chips (multi‑select) ── */}
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
          <FiLock size={14} style={{ marginRight: 4 }} /> Personal (
          {eventCounts.personal || 0})
        </button>
      </div>

      {/* ── Month shortcut chips ── */}
      {viewMode === "monthly" && (
        <div className={`${styles.chipRow} ${styles.scrollableRow}`}>
          {ALL_MONTH_ABBR.map((abbr) => (
            <button
              key={abbr}
              className={`${styles.chip} ${styles.shortcutChip}`}
              onClick={() => goToMonthFromAbbr(abbr)}
            >
              {abbr}
            </button>
          ))}
        </div>
      )}

      {/* ── Main content ── */}
      {viewMode === "daily" ? (
        <div className={styles.dailyContainer}>
          {/* Timeline */}
          <div className={styles.timelineWrapper}>
            {timelineSlots.map((slot) => (
              <div key={slot.hour} className={styles.hourSlot}>
                <span className={styles.hourLabel}>{slot.label}</span>
                <div className={styles.hourLine} />
              </div>
            ))}
            {/* Events positioned absolutely */}
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
      ) : (
        /* Monthly Grid */
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
              return (
                <button
                  key={idx}
                  className={`${styles.dayCell} ${!cell.isCurrentMonth ? styles.otherMonthCell : ""} ${isToday ? styles.todayCell : ""} ${selectedDate === cell.dateStr ? styles.activeCell : ""}`}
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
                          {ev.title.length > 10
                            ? ev.title.substring(0, 10) + "…"
                            : ev.title}
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

      {/* ── Bottom Sheet ── */}
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
                  {selectedDate &&
                    new Date(selectedDate + "T00:00:00").toLocaleDateString(
                      "en-US",
                      { weekday: "long", month: "short", day: "numeric" },
                    )}
                </h3>
                {agendaEvents.length === 0 && (
                  <p className={styles.noTasks}>No events</p>
                )}
                {agendaEvents.map((ev) => (
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
  );
}
