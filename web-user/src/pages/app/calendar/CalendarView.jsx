import {
  useState,
  useMemo,
  useCallback,
  useRef,
  useEffect,
  useLayoutEffect,
} from "react";
import {
  FiChevronLeft,
  FiChevronRight,
  FiChevronDown,
  FiLink,
  FiCopy,
  FiPaperclip,
  FiDownload,
} from "react-icons/fi";
import EventNoteOutlinedIcon from "@mui/icons-material/EventNoteOutlined";
import PersonOutlinedIcon from "@mui/icons-material/PersonOutlined";
import GroupsOutlinedIcon from "@mui/icons-material/GroupsOutlined";
import apiClient from "../../../api/client";
import { downloadAttachment } from "../../../utils/downloadAttachment";
import { getInvitations } from "../../../api/notifications";
import { useCalendar } from "../../../context/CalendarContext";
import {
  getEventStatus,
  EVENT_STATUS_CONFIG,
} from "../../../utils/eventStatus";
import styles from "./CalendarView.module.css";

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

const generateMonthGrid = (year, month) => {
  const firstDayOfMonth = new Date(year, month, 1).getDay();
  const startOffset = -firstDayOfMonth;
  const totalCells = 42;
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

const formatHour = (i) =>
  i === 0 ? "12 AM" : i < 12 ? `${i} AM` : i === 12 ? "12 PM" : `${i - 12} PM`;

const formatTimeFull = (dateStr) => {
  if (!dateStr) return "-";
  const d = new Date(dateStr);
  if (isNaN(d.getTime())) return "-";
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

/* ── Local-date helper ──
   `Date.prototype.toISOString()` always returns the date in UTC. For any
   local time before 8 AM here (UTC+8), slicing that string gives the WRONG
   calendar day (it rolls back to the previous day). That mismatch is what
   was pushing events onto the wrong date in the day/week filters. Every
   place that used to build a "YYYY-MM-DD" key now goes through this
   local-timezone-safe formatter instead. */
const toLocalDateStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const MINUTES_IN_DAY = 24 * 60;

/* ── Resolves an event into an absolute { start, end } Date range.
   Prefers full ISO datetimes (start_datetime/end_datetime) when present —
   those are timezone-aware and always resolve to the correct local hour.
   Falls back to the lightweight date/time/endTime string fields (treated
   as local wall-clock time) for events that don't carry full datetimes. */
const getEventRange = (ev) => {
  if (ev.start_datetime) {
    const start = new Date(ev.start_datetime);
    if (isNaN(start.getTime())) return null;
    let end = ev.end_datetime ? new Date(ev.end_datetime) : null;
    if (!end || isNaN(end.getTime()) || end <= start) {
      end = new Date(start.getTime() + 60 * 60 * 1000);
    }
    return { start, end, allDay: false };
  }

  if (!ev.date) return null;

  // All-day event (e.g. holidays) — no time component at all.
  if (!ev.time) {
    const endDateStr = ev.endDate || ev.end_date || ev.date;
    const start = new Date(`${ev.date}T00:00:00`);
    const end = new Date(`${endDateStr}T23:59:59.999`);
    if (isNaN(start.getTime())) return null;
    return { start, end, allDay: true };
  }

  const endDateStr = ev.endDate || ev.end_date || ev.date;
  const start = new Date(`${ev.date}T${ev.time}`);
  if (isNaN(start.getTime())) return null;
  let end = new Date(`${endDateStr}T${ev.endTime || ev.time}`);
  if (isNaN(end.getTime()) || end <= start) {
    // Crosses midnight (e.g. 11:00 PM → 3:00 AM) — roll the end over to the
    // next calendar day instead of collapsing the event to zero length.
    end = new Date(`${ev.date}T${ev.endTime || ev.time}`);
    end.setDate(end.getDate() + 1);
  }
  return { start, end, allDay: false };
};

/* ── Splits an event into segments — one per calendar day it actually
   occupies.
   - Multi-day events (start date ≠ end date) REPEAT THE SAME TIME-OF-DAY
     window on every date in range (e.g. 2:28 PM – 5:28 PM on Aug 13, then
     again on Aug 14, 15, 16, 17) instead of blocking out each day
     completely — only that daily time slot is occupied, not the whole day.
   - A single-day event that crosses midnight (e.g. 11:00 PM – 3:00 AM)
     still produces two segments on two adjacent days, so it renders as two
     separate cards.
   - All-day events (e.g. holidays, no time component) still occupy the
     full day on every date they span. */
const getEventDaySegments = (ev) => {
  const range = getEventRange(ev);
  if (!range) return [];
  const { start, end, allDay } = range;

  const startDateOnly = new Date(
    start.getFullYear(),
    start.getMonth(),
    start.getDate(),
  );
  const endDateOnly = new Date(
    end.getFullYear(),
    end.getMonth(),
    end.getDate(),
  );

  const segments = [];

  if (allDay) {
    let cursor = new Date(startDateOnly);
    while (cursor <= endDateOnly) {
      segments.push({
        ev,
        dateStr: toLocalDateStr(cursor),
        startMin: 0,
        endMin: MINUTES_IN_DAY,
        allDay: true,
      });
      cursor.setDate(cursor.getDate() + 1);
    }
    return segments;
  }

  const dailyStartMin = start.getHours() * 60 + start.getMinutes();
  const dailyEndMin = end.getHours() * 60 + end.getMinutes();
  const isMultiDay = startDateOnly.getTime() !== endDateOnly.getTime();
  const crossesMidnight = dailyEndMin <= dailyStartMin;

  if (!isMultiDay) {
    // Single-day event, possibly crossing midnight into the next day.
    if (!crossesMidnight) {
      segments.push({
        ev,
        dateStr: toLocalDateStr(startDateOnly),
        startMin: dailyStartMin,
        endMin: dailyEndMin,
        allDay: false,
      });
    } else {
      segments.push({
        ev,
        dateStr: toLocalDateStr(startDateOnly),
        startMin: dailyStartMin,
        endMin: MINUTES_IN_DAY,
        allDay: false,
      });
      const nextDay = new Date(startDateOnly);
      nextDay.setDate(nextDay.getDate() + 1);
      segments.push({
        ev,
        dateStr: toLocalDateStr(nextDay),
        startMin: 0,
        endMin: dailyEndMin,
        allDay: false,
      });
    }
    return segments;
  }

  // Multi-day: repeat the same daily time-of-day window on every date in
  // the range instead of filling whole days in between.
  let cursor = new Date(startDateOnly);
  while (cursor <= endDateOnly) {
    if (!crossesMidnight) {
      segments.push({
        ev,
        dateStr: toLocalDateStr(cursor),
        startMin: dailyStartMin,
        endMin: dailyEndMin,
        allDay: false,
      });
    } else {
      // Daily window itself crosses midnight (e.g. 11 PM – 3 AM every
      // night of the range) — split the same way each night.
      segments.push({
        ev,
        dateStr: toLocalDateStr(cursor),
        startMin: dailyStartMin,
        endMin: MINUTES_IN_DAY,
        allDay: false,
      });
      const nextDay = new Date(cursor);
      nextDay.setDate(nextDay.getDate() + 1);
      segments.push({
        ev,
        dateStr: toLocalDateStr(nextDay),
        startMin: 0,
        endMin: dailyEndMin,
        allDay: false,
      });
    }
    cursor.setDate(cursor.getDate() + 1);
  }
  return segments;
};

/* ── Contrast helper: dark event colors → white text, light colors → dark
   text. Used for the day/week timeline cards and the sheet title header. */
const getContrastTextColor = (hexColor) => {
  if (!hexColor || !/^#?([0-9a-fA-F]{3}|[0-9a-fA-F]{6})$/.test(hexColor)) {
    return "#ffffff";
  }
  let hex = hexColor.replace("#", "");
  if (hex.length === 3) {
    hex = hex
      .split("")
      .map((c) => c + c)
      .join("");
  }
  const r = parseInt(hex.substring(0, 2), 16);
  const g = parseInt(hex.substring(2, 4), 16);
  const b = parseInt(hex.substring(4, 6), 16);
  const luminance = (0.299 * r + 0.587 * g + 0.114 * b) / 255;
  return luminance > 0.55 ? "#1f2937" : "#ffffff";
};

/* ── Priority score used to order conflicting events. Checks a few likely
   field names so this keeps working whatever the backend calls it —
   adjust here if your API uses a different field. */
const minutesToLabel = (mins) => {
  const clamped = Math.max(0, Math.min(mins, MINUTES_IN_DAY));
  const h24 = Math.floor(clamped / 60) % 24;
  const m = Math.round(clamped % 60);
  const period = h24 < 12 ? "AM" : "PM";
  const h12 = h24 === 0 ? 12 : h24 > 12 ? h24 - 12 : h24;
  return `${h12}:${String(m).padStart(2, "0")} ${period}`;
};

const getPriorityScore = (ev) => {
  if (typeof ev.priority === "number") return ev.priority;
  if (ev.isPriority) return 1;
  if (ev.conflict?.isPriority) return 1;
  return 0;
};

/* ── Lays out overlapping segments SIDE-BY-SIDE instead of one fully
   covering another. Higher-priority events get the left-most column and a
   higher stacking order, so priority is still respected — but no event is
   ever completely hidden underneath another one anymore. */
const layoutSegments = (segments) => {
  if (segments.length === 0) return [];
  const sorted = [...segments].sort((a, b) => {
    if (a.startMin !== b.startMin) return a.startMin - b.startMin;
    return getPriorityScore(b.ev) - getPriorityScore(a.ev);
  });

  const columns = [];
  const placed = [];

  sorted.forEach((seg) => {
    let colIndex = columns.findIndex(
      (col) => col[col.length - 1].endMin <= seg.startMin,
    );
    if (colIndex === -1) {
      colIndex = columns.length;
      columns.push([]);
    }
    columns[colIndex].push(seg);
    placed.push({ ...seg, col: colIndex });
  });

  const totalCols = columns.length || 1;

  return placed.map((seg) => {
    let span = 1;
    for (let c = seg.col + 1; c < totalCols; c++) {
      const overlapsColumn = placed.some(
        (other) =>
          other.col === c &&
          other.startMin < seg.endMin &&
          other.endMin > seg.startMin,
      );
      if (overlapsColumn) break;
      span++;
    }
    return {
      ...seg,
      totalCols,
      span,
      zIndex: 10 + getPriorityScore(seg.ev) - seg.col,
    };
  });
};

/* ── Formats a start/end into a date range string for the sheet.
   Single day → "Aug 13, 2026". Multi-day → "Aug 13, 2026 to Aug 17,
   2026". Accepts Date objects or datetime strings. */
const formatDateRange = (startVal, endVal) => {
  if (!startVal) return "-";
  const s = startVal instanceof Date ? startVal : new Date(startVal);
  if (isNaN(s.getTime())) return "-";
  const e = endVal ? (endVal instanceof Date ? endVal : new Date(endVal)) : s;
  const eValid = !isNaN(e.getTime()) ? e : s;

  const fmt = (d) =>
    d.toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });

  const sDateStr = toLocalDateStr(s);
  const eDateStr = toLocalDateStr(eValid);

  if (sDateStr === eDateStr) return fmt(s);
  return `${fmt(s)} to ${fmt(eValid)}`;
};

const HOUR_HEIGHT = 64;
const SWIPE_THRESHOLD_RATIO = 0.2;
const SWIPE_ANIM_MS = 250;
const DRAG_CLOSE_THRESHOLD = 90;

export default function CalendarView() {
  const {
    currentDate,
    setCurrentDate,
    selectedDate,
    setSelectedDate,
    duration,
    activeFilters,
  } = useCalendar();

  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetIndex, setSheetIndex] = useState(0);
  const [holidays, setHolidays] = useState([]);
  const [userEvents, setUserEvents] = useState([]);
  const [pendingEventIds, setPendingEventIds] = useState([]);
  const [detailedEventsMap, setDetailedEventsMap] = useState({});
  const [detailsLoading, setDetailsLoading] = useState(false);
  const [copiedLink, setCopiedLink] = useState(false);

  const viewportRef = useRef(null);
  const [containerWidth, setContainerWidth] = useState(0);
  const [dragX, setDragX] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const dragStateRef = useRef({
    startX: 0,
    startY: 0,
    width: 0,
    locked: null,
    dragging: false,
  });
  const navigateRef = useRef(() => {});

  // ── Sheet drag-to-close (handle only) ──
  const [sheetDragY, setSheetDragY] = useState(0);
  const [sheetDragging, setSheetDragging] = useState(false);
  const sheetDragRef = useRef({ startY: 0 });

  // ── Sheet event carousel swipe (left/right) ──
  const [carouselTouchStartX, setCarouselTouchStartX] = useState(0);

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const weekStart = useMemo(() => {
    const d = new Date(currentDate);
    d.setDate(d.getDate() - d.getDay());
    return d;
  }, [currentDate]);

  const monthGrid = useMemo(
    () => generateMonthGrid(year, month),
    [year, month],
  );

  const visibleRange = useMemo(() => {
    let start, end;
    if (duration === "day") {
      const d = new Date(selectedDate + "T00:00:00");
      d.setDate(d.getDate() - 1);
      start = toLocalDateStr(d);
      d.setDate(d.getDate() + 2);
      end = toLocalDateStr(d);
    } else if (duration === "week") {
      const s = new Date(weekStart);
      s.setDate(s.getDate() - 7);
      start = toLocalDateStr(s);
      const e = new Date(weekStart);
      e.setDate(e.getDate() + 13);
      end = toLocalDateStr(e);
    } else {
      const firstDay = new Date(year, month - 1, 1);
      const lastDay = new Date(year, month + 2, 0);
      start = toLocalDateStr(firstDay);
      end = toLocalDateStr(lastDay);
    }
    return { start, end };
  }, [duration, selectedDate, weekStart, year, month]);

  useEffect(() => {
    fetch("https://trackv2-68rg.onrender.com/data/holidays.json")
      .then((res) => res.json())
      .then((data) => setHolidays(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    let cancelled = false;

    const fetchCalendarData = async () => {
      try {
        const [eventsRes, invitationsData] = await Promise.all([
          apiClient.get("/events", {
            params: { start: visibleRange.start, end: visibleRange.end },
          }),
          getInvitations({ response: "pending" }),
        ]);

        if (cancelled) return;

        const pendingIds = (invitationsData.events || []).map((ev) => ev.id);
        const allFetchedEvents = eventsRes.data.events || [];

        setPendingEventIds(pendingIds);
        setUserEvents(allFetchedEvents);
      } catch (err) {
        console.error("Failed to fetch calendar data:", err);
      }
    };

    fetchCalendarData();

    return () => {
      cancelled = true;
    };
  }, [visibleRange.start, visibleRange.end]);

  const allEvents = useMemo(() => {
    const filteredUserEvents = userEvents.filter(
      (ev) => !pendingEventIds.includes(ev.id),
    );
    return [...holidays, ...filteredUserEvents];
  }, [holidays, userEvents, pendingEventIds]);

  const filteredEvents = useMemo(() => {
    if (activeFilters.length === 0) return allEvents;
    return allEvents.filter((e) => activeFilters.includes(e.type));
  }, [activeFilters, allEvents]);

  // ── Every event exploded into per-day, time-clipped segments. This is
  // the single source of truth for multi-day expansion, overnight
  // splitting, and correct local start/end minutes. ──
  const eventSegmentsByDate = useMemo(() => {
    const map = {};
    filteredEvents.forEach((ev) => {
      getEventDaySegments(ev).forEach((seg) => {
        if (!map[seg.dateStr]) map[seg.dateStr] = [];
        map[seg.dateStr].push(seg);
      });
    });
    return map;
  }, [filteredEvents]);

  // ── Unique events per date (dedup'd from the segments above). Used by
  // the month view pills and the bottom sheet's event list. ──
  const eventsByDate = useMemo(() => {
    const map = {};
    Object.entries(eventSegmentsByDate).forEach(([dateStr, segs]) => {
      const seen = new Set();
      map[dateStr] = segs
        .map((s) => s.ev)
        .filter((ev) => {
          if (seen.has(ev.id)) return false;
          seen.add(ev.id);
          return true;
        });
    });
    return map;
  }, [eventSegmentsByDate]);

  const dailyEvents = selectedDate ? eventsByDate[selectedDate] || [] : [];
  const todayStr = toLocalDateStr(new Date());
  const todayWeekday = new Date().getDay();
  const todayNumber = new Date().getDate();
  const todayMonthAbbr = MONTH_NAMES[new Date().getMonth()]
    .slice(0, 3)
    .toUpperCase();

  const navigate = useCallback(
    (direction) => {
      const date = new Date(currentDate);
      if (duration === "day") {
        date.setDate(date.getDate() + direction);
        setSelectedDate(toLocalDateStr(date));
      } else if (duration === "week") {
        date.setDate(date.getDate() + direction * 7);
      } else if (duration === "month") {
        date.setMonth(date.getMonth() + direction);
      }
      setCurrentDate(date);
    },
    [currentDate, duration, setCurrentDate, setSelectedDate],
  );

  useEffect(() => {
    navigateRef.current = navigate;
  }, [navigate]);

  const goToPrev = () => navigate(-1);
  const goToNext = () => navigate(1);

  const goToToday = () => {
    const today = new Date();
    setCurrentDate(today);
    setSelectedDate(toLocalDateStr(today));
  };

  const handleMonthChange = (e) => {
    const newMonth = parseInt(e.target.value, 10);
    const d = new Date(currentDate);
    d.setMonth(newMonth);
    setCurrentDate(d);
    if (duration === "day") {
      const dayDate = new Date(d);
      dayDate.setDate(1);
      setSelectedDate(toLocalDateStr(dayDate));
    }
  };

  useLayoutEffect(() => {
    const measure = () =>
      setContainerWidth(viewportRef.current?.offsetWidth || 0);
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [duration]);

  // ── Native touch listeners for date-navigation swipe (month/week/day panels) ──
  useEffect(() => {
    const el = viewportRef.current;
    if (!el) return;

    const onTouchStart = (e) => {
      const t = e.touches[0];
      dragStateRef.current = {
        startX: t.clientX,
        startY: t.clientY,
        width: el.offsetWidth,
        locked: null,
        dragging: true,
      };
    };
    const onTouchMove = (e) => {
      const state = dragStateRef.current;
      if (!state.dragging) return;
      const t = e.touches[0];
      const deltaX = t.clientX - state.startX;
      const deltaY = t.clientY - state.startY;
      if (!state.locked) {
        if (Math.abs(deltaX) > 8 || Math.abs(deltaY) > 8) {
          state.locked = Math.abs(deltaX) > Math.abs(deltaY) ? "x" : "y";
        }
      }
      if (state.locked === "x") {
        e.preventDefault();
        setDragX(deltaX);
      }
    };
    const onTouchEnd = () => {
      const state = dragStateRef.current;
      if (!state.dragging) return;
      state.dragging = false;
      if (state.locked === "x") {
        setDragX((current) => {
          const threshold = state.width * SWIPE_THRESHOLD_RATIO;
          if (Math.abs(current) > threshold) {
            const dir = current < 0 ? 1 : -1;
            setIsAnimating(true);
            const target = dir === 1 ? -state.width : state.width;
            setTimeout(() => {
              navigateRef.current(dir);
              setIsAnimating(false);
              setDragX(0);
            }, SWIPE_ANIM_MS);
            return target;
          }
          setIsAnimating(true);
          setTimeout(() => setIsAnimating(false), SWIPE_ANIM_MS * 0.8);
          return 0;
        });
      }
      state.locked = null;
    };

    el.addEventListener("touchstart", onTouchStart, { passive: true });
    el.addEventListener("touchmove", onTouchMove, { passive: false });
    el.addEventListener("touchend", onTouchEnd, { passive: true });
    el.addEventListener("touchcancel", onTouchEnd, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onTouchStart);
      el.removeEventListener("touchmove", onTouchMove);
      el.removeEventListener("touchend", onTouchEnd);
      el.removeEventListener("touchcancel", onTouchEnd);
    };
  }, []);

  const closeSheet = () => {
    setSheetOpen(false);
    setSheetIndex(0);
  };

  const handleDayClick = useCallback(
    (dateStr) => {
      setSelectedDate(dateStr);
      setSheetIndex(0);
      if (duration !== "day") setSheetOpen(true);
    },
    [duration, setSelectedDate],
  );

  // `dateStr` is the calendar day the user actually tapped (important for
  // multi-day events, which can be clicked from any date they span — not
  // just their original start date).
  const handleEventClick = useCallback(
    (ev, dateStr) => {
      const targetDate = dateStr || ev.date;
      const dayList = eventsByDate[targetDate] || [ev];
      const idx = dayList.findIndex((e) => e.id === ev.id);
      setSelectedDate(targetDate);
      setSheetIndex(idx >= 0 ? idx : 0);
      setSheetOpen(true);
    },
    [eventsByDate, setSelectedDate],
  );

  // ── Fetch full details of the event currently shown in the sheet ──
  useEffect(() => {
    if (!sheetOpen) return;
    if (dailyEvents.length === 0) {
      setDetailedEventsMap({});
      return;
    }
    let cancelled = false;
    setDetailsLoading(true);
    const idsToFetch = dailyEvents.filter((ev) => ev.id).map((ev) => ev.id);
    Promise.all(
      idsToFetch.map((id) =>
        apiClient
          .get(`/events/${id}`)
          .then((res) => (res.data.ok ? res.data.event : null))
          .catch(() => null),
      ),
    )
      .then((results) => {
        if (cancelled) return;
        const map = {};
        results.forEach((detail, idx) => {
          if (detail) map[idsToFetch[idx]] = detail;
        });
        setDetailedEventsMap(map);
      })
      .finally(() => {
        if (!cancelled) setDetailsLoading(false);
      });
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sheetOpen, selectedDate]);

  // ── Sheet drag-to-close handlers (grab handle only) ──
  const handleHandleTouchStart = (e) => {
    sheetDragRef.current.startY = e.touches[0].clientY;
    setSheetDragging(true);
  };
  const handleHandleTouchMove = (e) => {
    const delta = e.touches[0].clientY - sheetDragRef.current.startY;
    if (delta > 0) setSheetDragY(delta);
  };
  const handleHandleTouchEnd = () => {
    if (sheetDragY > DRAG_CLOSE_THRESHOLD) {
      closeSheet();
    }
    setSheetDragY(0);
    setSheetDragging(false);
  };

  // ── Sheet event carousel horizontal swipe ──
  const handleCarouselTouchStart = (e) =>
    setCarouselTouchStartX(e.touches[0].clientX);
  const handleCarouselTouchEnd = (e) => {
    const endX = e.changedTouches[0].clientX;
    const diff = carouselTouchStartX - endX;
    if (Math.abs(diff) > 50 && dailyEvents.length > 1) {
      if (diff > 0)
        setSheetIndex((prev) =>
          prev === dailyEvents.length - 1 ? 0 : prev + 1,
        );
      else
        setSheetIndex((prev) =>
          prev === 0 ? dailyEvents.length - 1 : prev - 1,
        );
    }
  };

  const handleCopyLink = (link) => {
    if (!link) return;
    navigator.clipboard
      .writeText(link)
      .then(() => {
        setCopiedLink(true);
        setTimeout(() => setCopiedLink(false), 1500);
      })
      .catch(() => {});
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

  /* ---------- Panel renderers ---------- */
  const renderMonthPanel = (offset) => {
    const d = new Date(year, month + offset, 1);
    const grid = generateMonthGrid(d.getFullYear(), d.getMonth());
    return (
      <div className={styles.calendarGridContainer}>
        <div className={styles.calendarGrid}>
          {DAY_NAMES.map((day, idx) => (
            <div
              key={day}
              className={`${styles.dayHeader} ${idx === todayWeekday ? styles.dayHeaderToday : ""}`}
            >
              {day}
            </div>
          ))}
          {grid.map((cell, idx) => {
            const events = eventsByDate[cell.dateStr] || [];
            const isToday = cell.dateStr === todayStr;
            return (
              <button
                key={idx}
                className={`${styles.dayCell} ${!cell.isCurrentMonth ? styles.otherMonthCell : ""}`}
                onClick={() => handleDayClick(cell.dateStr)}
              >
                <span
                  className={`${styles.dayNumber} ${isToday ? styles.todayNumber : ""} ${!cell.isCurrentMonth ? styles.otherMonthNumber : ""}`}
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
                          handleEventClick(ev, cell.dateStr);
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
    );
  };

  const renderWeekPanel = (offset) => {
    const ws = new Date(weekStart);
    ws.setDate(ws.getDate() + offset * 7);
    const days = getWeekDays(ws);
    return (
      <div className={styles.weekContainer}>
        <div className={styles.weekGrid}>
          <div className={styles.weekDayHeader}>
            <div className={styles.weekHeaderSpacer} />
            {days.map((day, idx) => {
              const dateStr = toLocalDateStr(day);
              const isToday = dateStr === todayStr;
              return (
                <div
                  key={idx}
                  className={`${styles.weekDayLabel} ${isToday ? styles.weekDayLabelToday : ""}`}
                >
                  <span className={styles.weekDayName}>
                    {DAY_NAMES[day.getDay()]}
                  </span>
                  <span className={styles.weekDayNumber}>{day.getDate()}</span>
                </div>
              );
            })}
          </div>

          <div className={styles.weekTimelineBody}>
            <div className={styles.weekHourLabelsCol}>
              {Array.from({ length: 24 }, (_, hour) => (
                <div key={hour} className={styles.weekHourLabelCell}>
                  {formatHour(hour)}
                </div>
              ))}
            </div>

            {days.map((day, dayIdx) => {
              const dateStr = toLocalDateStr(day);
              const isToday = dateStr === todayStr;
              const segments = eventSegmentsByDate[dateStr] || [];
              const timedSegments = segments.filter((s) => !s.allDay);
              const allDaySegments = segments.filter((s) => s.allDay);
              const laidOut = layoutSegments(timedSegments);

              return (
                <div
                  key={dayIdx}
                  className={`${styles.weekDayCol} ${isToday ? styles.weekCellToday : ""}`}
                >
                  {Array.from({ length: 24 }, (_, hour) => (
                    <div key={hour} className={styles.weekHourGridLine} />
                  ))}

                  {allDaySegments.length > 0 && (
                    <div className={styles.weekAllDayRow}>
                      {allDaySegments.map((seg) => (
                        <div
                          key={seg.ev.id}
                          className={styles.weekAllDayPill}
                          style={{
                            backgroundColor: seg.ev.color,
                            color: getContrastTextColor(seg.ev.color),
                          }}
                          onClick={() => handleEventClick(seg.ev, dateStr)}
                        >
                          {seg.ev.title}
                        </div>
                      ))}
                    </div>
                  )}

                  <div className={styles.weekEventsLayer}>
                    {laidOut.map((seg) => {
                      const top = (seg.startMin / 60) * HOUR_HEIGHT;
                      const height = Math.max(
                        ((seg.endMin - seg.startMin) / 60) * HOUR_HEIGHT,
                        18,
                      );
                      const leftPct = (seg.col / seg.totalCols) * 100;
                      const widthPct = (seg.span / seg.totalCols) * 100;
                      const textColor = getContrastTextColor(seg.ev.color);
                      return (
                        <div
                          key={`${seg.ev.id}-${seg.startMin}`}
                          className={styles.weekEvent}
                          style={{
                            backgroundColor: seg.ev.color,
                            color: textColor,
                            top,
                            height,
                            left: `${leftPct}%`,
                            width: `calc(${widthPct}% - 3px)`,
                            zIndex: seg.zIndex,
                          }}
                          onClick={() => handleEventClick(seg.ev, dateStr)}
                        >
                          <span
                            className={styles.eventTitle}
                            style={{ color: textColor }}
                          >
                            {seg.ev.title}
                          </span>
                        </div>
                      );
                    })}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderDayPanel = (offset) => {
    const d = new Date(selectedDate + "T00:00:00");
    d.setDate(d.getDate() + offset);
    const dateStr = toLocalDateStr(d);
    const segments = eventSegmentsByDate[dateStr] || [];
    const timedSegments = segments.filter((s) => !s.allDay);
    const allDaySegments = segments.filter((s) => s.allDay);
    const laidOut = layoutSegments(timedSegments);

    return (
      <div className={styles.dailyContainer}>
        {allDaySegments.length > 0 && (
          <div className={styles.allDayRow}>
            {allDaySegments.map((seg) => (
              <div
                key={seg.ev.id}
                className={styles.allDayPill}
                style={{
                  backgroundColor: seg.ev.color,
                  color: getContrastTextColor(seg.ev.color),
                }}
                onClick={() => handleEventClick(seg.ev, dateStr)}
              >
                {seg.ev.title}
              </div>
            ))}
          </div>
        )}
        <div className={styles.timelineWrapper}>
          {Array.from({ length: 24 }, (_, i) => (
            <div key={i} className={styles.hourSlot}>
              <span className={styles.hourLabel}>{formatHour(i)}</span>
              <div className={styles.hourLine} />
            </div>
          ))}
          <div className={styles.timelineEventsLayer}>
            {laidOut.map((seg) => {
              const top = (seg.startMin / 60) * HOUR_HEIGHT;
              const height = Math.max(
                ((seg.endMin - seg.startMin) / 60) * HOUR_HEIGHT,
                24,
              );
              const leftPct = (seg.col / seg.totalCols) * 100;
              const widthPct = (seg.span / seg.totalCols) * 100;
              const textColor = getContrastTextColor(seg.ev.color);
              return (
                <div
                  key={`${seg.ev.id}-${seg.startMin}`}
                  className={styles.timelineEvent}
                  style={{
                    backgroundColor: seg.ev.color,
                    color: textColor,
                    top,
                    height,
                    left: `${leftPct}%`,
                    width: `calc(${widthPct}% - 4px)`,
                    zIndex: seg.zIndex,
                  }}
                  onClick={() => handleEventClick(seg.ev, dateStr)}
                >
                  <span
                    className={styles.eventTitle}
                    style={{ color: textColor }}
                  >
                    {seg.ev.title}
                  </span>
                  <span
                    className={styles.eventTime}
                    style={{ color: textColor }}
                  >
                    {minutesToLabel(seg.startMin)} –{" "}
                    {minutesToLabel(seg.endMin)}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    );
  };

  const renderPanel = (offset) => {
    if (duration === "day") return renderDayPanel(offset);
    if (duration === "week") return renderWeekPanel(offset);
    return renderMonthPanel(offset);
  };

  // ── Detailed event card inside the bottom sheet ──
  const renderSheetEventCard = () => {
    const basicEvent = dailyEvents[sheetIndex];
    if (!basicEvent) return null;

    const ev = detailedEventsMap[basicEvent.id] || basicEvent;

    const creator = ev.creator || {};
    const creatorName = creator.full_name || creator.username || null;
    const creatorSub = [
      creator.position,
      [creator.department, creator.office].filter(Boolean).join(" | "),
    ]
      .filter(Boolean)
      .join(" | ");

    const participants = ev.participants || {};
    const depts = participants.departments || [];
    const offices = participants.offices || [];
    const allUsers = participants.users || [];
    const acceptedUsers = allUsers.filter((u) => u.response === "accepted");
    const attachments = ev.attachments || [];
    const conflict = ev.conflict;

    // Single source of truth for this event's start/end — handles full
    // datetimes, legacy date/time fields, and multi-day ranges alike.
    const evRange =
      getEventRange(ev.start_datetime || ev.end_datetime ? ev : basicEvent) ||
      getEventRange(basicEvent);

    const status = getEventStatus({
      start_datetime:
        ev.start_datetime || `${basicEvent.date}T${basicEvent.time}`,
      end_datetime:
        ev.end_datetime || `${basicEvent.date}T${basicEvent.endTime}`,
    });
    const statusCfg = EVENT_STATUS_CONFIG[status];

    const headerColor = ev.color || basicEvent.color || "#800000";
    const headerTextColor = getContrastTextColor(headerColor);

    return (
      <div className={styles.sheetCard}>
        <div
          className={styles.sheetCardHeader}
          style={{ backgroundColor: headerColor }}
        >
          <div className={styles.sheetBadgeRow}>
            {ev.hierarchy && (
              <span className={styles.sheetBadge}>{ev.hierarchy}</span>
            )}
            {(ev.method || basicEvent.method) && (
              <span className={styles.sheetBadge}>
                {ev.method || basicEvent.method}
              </span>
            )}
            {(ev.visibility || basicEvent.type) && (
              <span className={styles.sheetBadge}>
                {ev.visibility || basicEvent.type}
              </span>
            )}
            <span
              className={`${styles.statusBadgeSmall} ${styles[statusCfg.className]}`}
            >
              {statusCfg.label}
            </span>
          </div>
          <h3 className={styles.sheetTitle} style={{ color: headerTextColor }}>
            {ev.title || basicEvent.title}
          </h3>
        </div>

        {ev.description && (
          <p className={styles.sheetDescription}>{ev.description}</p>
        )}

        <div className={styles.sheetSection}>
          <div className={styles.sheetSectionHeader}>
            <EventNoteOutlinedIcon fontSize="small" />
            <span>WHEN &amp; WHERE</span>
          </div>
          <div className={styles.sheetInfoGrid}>
            <div>
              <div className={styles.sheetInfoLabel}>DATE</div>
              <div className={styles.sheetInfoValue}>
                {evRange ? formatDateRange(evRange.start, evRange.end) : "-"}
              </div>
            </div>
            <div>
              <div className={styles.sheetInfoLabel}>TIME</div>
              <div className={styles.sheetInfoValue}>
                {!evRange
                  ? "-"
                  : evRange.allDay
                    ? "All day"
                    : `${formatTimeFull(evRange.start)} — ${formatTimeFull(evRange.end)}`}
              </div>
            </div>
            <div>
              <div className={styles.sheetInfoLabel}>LOCATION</div>
              <div className={styles.sheetInfoValue}>
                {ev.venue || ev.location || basicEvent.location || "Online"}
              </div>
            </div>
          </div>
          {(ev.method === "online" || basicEvent.method === "online") &&
            ev.link && (
              <div className={styles.sheetLinkRow}>
                <FiLink size={14} />
                <span className={styles.sheetLinkText}>{ev.link}</span>
                <button
                  className={styles.sheetCopyBtn}
                  onClick={() => handleCopyLink(ev.link)}
                >
                  <FiCopy size={12} /> {copiedLink ? "Copied!" : "Copy"}
                </button>
              </div>
            )}
        </div>

        {creatorName && (
          <div className={styles.sheetSection}>
            <div className={styles.sheetSectionHeader}>
              <PersonOutlinedIcon fontSize="small" />
              <span>ORGANIZER</span>
            </div>
            <div className={styles.sheetOrganizerRow}>
              <div
                className={styles.sheetOrganizerAvatar}
                style={{ background: getAvatarColor(creatorName) }}
              >
                {getInitials(creatorName)}
              </div>
              <div>
                <div className={styles.sheetOrganizerName}>{creatorName}</div>
                {creatorSub && (
                  <div className={styles.sheetOrganizerSub}>{creatorSub}</div>
                )}
              </div>
            </div>
            {(depts.length > 0 || offices.length > 0) && (
              <div className={styles.sheetTagRow}>
                {depts.map((d) => (
                  <span key={d} className={styles.sheetTag}>
                    {d}
                  </span>
                ))}
                {offices.map((o) => (
                  <span key={o} className={styles.sheetTag}>
                    {o}
                  </span>
                ))}
              </div>
            )}
          </div>
        )}

        {allUsers.length > 0 && (
          <div className={styles.sheetSection}>
            <div className={styles.sheetSectionHeader}>
              <GroupsOutlinedIcon fontSize="small" />
              <span>AUDIENCE</span>
            </div>
            <div className={styles.sheetAttendeeStack}>
              {acceptedUsers.slice(0, 6).map((u) => {
                const name = u.full_name || u.username || u.email || "Unknown";
                return (
                  <div
                    key={u.id}
                    className={styles.sheetAttendeeAvatar}
                    style={{ background: getAvatarColor(name) }}
                    title={name}
                  >
                    {getInitials(name)}
                  </div>
                );
              })}
              {acceptedUsers.length > 6 && (
                <div className={styles.sheetAttendeeMore}>
                  +{acceptedUsers.length - 6}
                </div>
              )}
            </div>
          </div>
        )}

        {attachments.length > 0 && (
          <div className={styles.sheetSection}>
            <div className={styles.sheetSectionHeader}>
              <FiPaperclip size={14} />
              <span>ATTACHMENTS</span>
            </div>
            <div className={styles.sheetAttachList}>
              {attachments.map((file) => (
                <a
                  key={file.id}
                  href="#"
                  onClick={(clickEvent) => {
                    clickEvent.preventDefault();
                    downloadAttachment(file);
                  }}
                  className={styles.sheetAttachItem}
                >
                  <FiDownload size={13} />
                  <span>{file.file_name}</span>
                </a>
              ))}
            </div>
          </div>
        )}

        {conflict?.isConflicted && (
          <div
            className={`${styles.sheetConflictNotice} ${conflict.isPriority ? styles.sheetConflictPriority : styles.sheetConflictWarning}`}
          >
            {conflict.isPriority
              ? "This event takes priority."
              : "This event conflicts with another."}
          </div>
        )}
      </div>
    );
  };

  return (
    <div className={styles.pageWrapper}>
      <div className={styles.container}>
        <div className={styles.topContent}>
          <div className={styles.headerLeft}>
            <button onClick={goToPrev} className={styles.navBtn}>
              <FiChevronLeft size={20} />
            </button>
            <h2 className={styles.headerTitle}>{headerTitle}</h2>
            <button onClick={goToNext} className={styles.navBtn}>
              <FiChevronRight size={20} />
            </button>
          </div>
          <div className={styles.headerRight}>
            <button
              onClick={goToToday}
              className={styles.todayBtn}
              aria-label="Go to today"
              title="Go to today"
            >
              <span className={styles.todayBtnTop}>{todayMonthAbbr}</span>
              <span className={styles.todayBtnNumber}>{todayNumber}</span>
            </button>
            <select
              className={styles.monthSelect}
              value={month}
              onChange={handleMonthChange}
              aria-label="Jump to month"
            >
              {MONTH_NAMES.map((name, idx) => (
                <option key={idx} value={idx}>
                  {name.slice(0, 4).toUpperCase()}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className={styles.mainContent}>
          <div className={styles.viewport} ref={viewportRef}>
            <div
              className={styles.swipeTrack}
              style={{
                transform: `translateX(${-containerWidth + dragX}px)`,
                transition: isAnimating ? "transform 0.25s ease" : "none",
              }}
            >
              <div className={styles.swipePanel}>{renderPanel(-1)}</div>
              <div className={styles.swipePanel}>{renderPanel(0)}</div>
              <div className={styles.swipePanel}>{renderPanel(1)}</div>
            </div>
          </div>
        </div>

        {sheetOpen && (
          <div className={styles.sheetOverlay} onClick={closeSheet}>
            <div
              className={styles.sheet}
              onClick={(e) => e.stopPropagation()}
              style={{
                transform: `translateY(${sheetDragY}px)`,
                transition: sheetDragging ? "none" : "transform 0.2s ease",
              }}
            >
              <div
                className={styles.sheetStickyHeader}
                onTouchStart={handleHandleTouchStart}
                onTouchMove={handleHandleTouchMove}
                onTouchEnd={handleHandleTouchEnd}
              >
                <div className={styles.sheetHandle}>
                  <FiChevronDown size={22} />
                </div>
                <div className={styles.sheetDateHeader}>
                  {new Date(selectedDate + "T00:00:00").toLocaleDateString(
                    "en-US",
                    {
                      weekday: "long",
                      month: "short",
                      day: "numeric",
                    },
                  )}
                </div>
              </div>

              <div className={styles.sheetScrollArea}>
                {dailyEvents.length === 0 ? (
                  <p className={styles.noTasks}>No events</p>
                ) : (
                  <div
                    className={styles.sheetCarouselWrapper}
                    onTouchStart={handleCarouselTouchStart}
                    onTouchEnd={handleCarouselTouchEnd}
                  >
                    {detailsLoading ? (
                      <p className={styles.noTasks}>Loading details...</p>
                    ) : (
                      renderSheetEventCard()
                    )}

                    {dailyEvents.length > 1 && (
                      <div className={styles.sheetDotsContainer}>
                        {dailyEvents.map((_, idx) => (
                          <span
                            key={idx}
                            className={`${styles.sheetDot} ${idx === sheetIndex ? styles.sheetDotActive : ""}`}
                            onClick={() => setSheetIndex(idx)}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
