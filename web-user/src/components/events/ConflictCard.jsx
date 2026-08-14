import React, { useState, useRef, useMemo, useEffect } from "react";
import {
  FiChevronDown,
  FiUser,
  FiCalendar,
  FiMapPin,
  FiUsers,
  FiAlertCircle,
  FiCheckCircle,
  FiArrowRight,
  FiInfo,
  FiSliders,
  FiWifi,
  FiClock,
} from "react-icons/fi";
import styles from "./ConflictCard.module.css";

const DRAG_CLOSE_THRESHOLD = 90;
const DEFAULT_WINDOW_START = "06:00";
const DEFAULT_WINDOW_END = "22:00";
const DEFAULT_LOOKAHEAD_DAYS = 30;
const MAX_RESULTS = 40;
const INITIAL_VISIBLE = 5;
const CANDIDATES_PER_DAY = 2; // nearest-before + nearest-after when the day is conflicted

// ── Date/time helpers ───────────────────────────────────
const overlaps = (aStart, aEnd, bStart, bEnd) => aStart < bEnd && bStart < aEnd;

// NOTE: this must stay LOCAL-timezone-safe. `toISOString()` returns the date
// in UTC, which rolls back to the previous calendar day for any local time
// before 8 AM here (UTC+8) — that was silently shifting every generated
// candidate date back by one day.
const toDateInputStr = (d) => {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
};

const buildLocalDate = (dateStr, hh, mm) => {
  const [y, m, d] = dateStr.split("-").map(Number);
  return new Date(y, m - 1, d, hh, mm, 0, 0);
};

const parseTimeStr = (timeStr) => {
  const [h, m] = (timeStr || "00:00").split(":").map(Number);
  return { h, m };
};

// Adds a (possibly fractional) number of hours to a "HH:MM" string and
// returns the resulting "HH:MM", wrapping past midnight. Used to keep
// "Preferred Time Until" in sync with "Preferred Time From" + Duration.
const addHoursToTimeStr = (timeStr, hours) => {
  const { h, m } = parseTimeStr(timeStr);
  const totalMinutes = h * 60 + m + Math.round((Number(hours) || 0) * 60);
  const wrapped = ((totalMinutes % 1440) + 1440) % 1440;
  const hh = Math.floor(wrapped / 60);
  const mm = wrapped % 60;
  return `${String(hh).padStart(2, "0")}:${String(mm).padStart(2, "0")}`;
};

// ── Build merged, sorted busy intervals for a single day, clipped to the
// search window, from a combined list of events (venue + attendees + creator). ──
const getMergedIntervalsForDay = (events, windowStart, windowEnd) => {
  const raw = events
    .map((ev) => [new Date(ev.start_datetime), new Date(ev.end_datetime)])
    .filter(([s, e]) => s < windowEnd && e > windowStart)
    .map(([s, e]) => [
      s < windowStart ? windowStart : s,
      e > windowEnd ? windowEnd : e,
    ])
    .sort((a, b) => a[0] - b[0]);

  const merged = [];
  for (const iv of raw) {
    if (merged.length && iv[0] <= merged[merged.length - 1][1]) {
      if (iv[1] > merged[merged.length - 1][1])
        merged[merged.length - 1][1] = iv[1];
    } else {
      merged.push([iv[0], iv[1]]);
    }
  }
  return merged;
};

const getFreeGaps = (busyIntervals, windowStart, windowEnd) => {
  const gaps = [];
  let cursor = windowStart;
  for (const [s, e] of busyIntervals) {
    if (s > cursor) gaps.push([cursor, s]);
    if (e > cursor) cursor = e;
  }
  if (cursor < windowEnd) gaps.push([cursor, windowEnd]);
  return gaps;
};

// Given a gap [gapStart, gapEnd] and a desired duration, find the best-fitting
// slot of exactly `durationMs` within the gap that is closest to desiredStart
// (clamped to the gap's valid range). Returns null if the gap is too small.
const bestFitInGap = (gapStart, gapEnd, durationMs, desiredStart) => {
  const lowerBound = gapStart;
  const upperBound = new Date(gapEnd.getTime() - durationMs);
  if (upperBound < lowerBound) return null;
  let slotStart = desiredStart;
  if (slotStart < lowerBound) slotStart = new Date(lowerBound);
  if (slotStart > upperBound) slotStart = new Date(upperBound);
  return { start: slotStart, end: new Date(slotStart.getTime() + durationMs) };
};

// ── Per-day recommendation: exact desired time if free, otherwise the
// nearest-fitting free slots (before/after the conflict) on that same day.
// `minStart`, when provided, clamps the search window so nothing before
// that moment (e.g. "right now") is ever considered — used to keep past
// times out of "today"'s candidates. ──
const getDayRecommendations = ({
  dateStr,
  durationMs,
  desiredHour,
  desiredMinute,
  venueEvents,
  attendeeEvents,
  creatorEvents,
  windowStart,
  windowEnd,
  minStart,
}) => {
  const { h: wsH, m: wsM } = parseTimeStr(windowStart);
  const { h: weH, m: weM } = parseTimeStr(windowEnd);
  const wStart = buildLocalDate(dateStr, wsH, wsM);
  let wEnd = buildLocalDate(dateStr, weH, weM);
  if (wEnd <= wStart) {
    // Preferred window crosses midnight (e.g. 6 PM – 7 AM) — the "until"
    // time belongs to the next calendar day, not the same one.
    wEnd = new Date(wEnd.getTime());
    wEnd.setDate(wEnd.getDate() + 1);
  }

  const effectiveStart = minStart && minStart > wStart ? minStart : wStart;
  if (wEnd <= effectiveStart) return [];

  const combined = [...venueEvents, ...attendeeEvents, ...creatorEvents];
  const busy = getMergedIntervalsForDay(combined, effectiveStart, wEnd);

  const desiredStart = buildLocalDate(dateStr, desiredHour, desiredMinute);
  const desiredEnd = new Date(desiredStart.getTime() + durationMs);

  const withinWindow = desiredStart >= effectiveStart && desiredEnd <= wEnd;
  const exactFree =
    withinWindow &&
    !busy.some(([s, e]) => overlaps(desiredStart, desiredEnd, s, e));

  if (exactFree) {
    return [{ start: desiredStart, end: desiredEnd, adjusted: false }];
  }

  const gaps = getFreeGaps(busy, effectiveStart, wEnd);
  const candidates = [];
  for (const [gs, ge] of gaps) {
    const fit = bestFitInGap(gs, ge, durationMs, desiredStart);
    if (fit) candidates.push(fit);
  }
  candidates.sort(
    (a, b) =>
      Math.abs(a.start - desiredStart) - Math.abs(b.start - desiredStart),
  );

  return candidates
    .slice(0, CANDIDATES_PER_DAY)
    .map((c) => ({ ...c, adjusted: true }));
};

// ── For an event whose ORIGINAL duration already spans multiple calendar
// days (e.g. a 4-day event, Aug 14 – Aug 17), we don't search within a
// single day's time window. Instead we keep the same daily start/end TIME
// and look for a new starting date where that exact daily time slot is
// completely free across every one of those consecutive days — so a
// conflict-free alternative can still be suggested for multi-day events. ──
const getMultiDayCandidate = ({
  candidateStartDateStr,
  numDays,
  desiredHour,
  desiredMinute,
  perDayDurationMs,
  venueEvents,
  attendeeEvents,
  creatorEvents,
  minStart,
}) => {
  const combined = [...venueEvents, ...attendeeEvents, ...creatorEvents];
  const cursor = new Date(`${candidateStartDateStr}T00:00:00`);
  let firstStart = null;
  let lastEnd = null;

  for (let i = 0; i < numDays; i++) {
    const dateStr = toDateInputStr(cursor);
    const slotStart = buildLocalDate(dateStr, desiredHour, desiredMinute);
    const slotEnd = new Date(slotStart.getTime() + perDayDurationMs);

    if (minStart && slotStart < minStart) return null;

    const hasConflict = combined.some((ev) =>
      overlaps(
        slotStart,
        slotEnd,
        new Date(ev.start_datetime),
        new Date(ev.end_datetime),
      ),
    );
    if (hasConflict) return null;

    if (!firstStart) firstStart = slotStart;
    lastEnd = slotEnd;
    cursor.setDate(cursor.getDate() + 1);
  }

  return { start: firstStart, end: lastEnd };
};

// ── Verifies a chosen slot against each event list separately, purely for
// the display badges (Venue Free / Attendees Free / You Free). ──
const checkConflictFreeFlags = (
  slotStart,
  slotEnd,
  venueEvents,
  attendeeEvents,
  creatorEvents,
) => ({
  venue: !venueEvents.some((ev) =>
    overlaps(
      slotStart,
      slotEnd,
      new Date(ev.start_datetime),
      new Date(ev.end_datetime),
    ),
  ),
  attendees: !attendeeEvents.some((ev) =>
    overlaps(
      slotStart,
      slotEnd,
      new Date(ev.start_datetime),
      new Date(ev.end_datetime),
    ),
  ),
  creator: !creatorEvents.some((ev) =>
    overlaps(
      slotStart,
      slotEnd,
      new Date(ev.start_datetime),
      new Date(ev.end_datetime),
    ),
  ),
});

const generateRecommendations = ({
  originalStart,
  durationHours,
  perDayDurationMs,
  conflicts,
  dateStart,
  dateEnd,
  windowStart,
  windowEnd,
  isMultiDay,
  numDays,
}) => {
  if (!originalStart || !dateStart || !dateEnd) return [];

  const venueEvents = conflicts?.venue?.events || [];
  const attendeeEvents = (conflicts?.attendees?.users || []).flatMap(
    (u) => u.events || [],
  );
  const creatorEvents = conflicts?.creator?.events || [];

  const desiredHour = originalStart.getHours();
  const desiredMinute = originalStart.getMinutes();
  const now = new Date();

  const results = [];
  const cursor = new Date(dateStart);
  cursor.setHours(0, 0, 0, 0);
  let guard = 0;

  // ── Multi-day event: same daily time slot, repeated across N consecutive
  // days, shifted to a new starting date. `perDayDurationMs` is supplied by
  // the caller — either derived from the original event's own multi-day
  // span, or from the "Duration of Event (days)" + "Preferred Duration
  // (hours)" fields when the user explicitly asks for a multi-day search. ──
  if (isMultiDay && numDays > 1 && perDayDurationMs) {
    const originalDateStr = toDateInputStr(
      new Date(
        originalStart.getFullYear(),
        originalStart.getMonth(),
        originalStart.getDate(),
      ),
    );

    while (cursor <= dateEnd && results.length < MAX_RESULTS && guard < 400) {
      guard++;
      const dateStr = toDateInputStr(cursor);
      const candidate = getMultiDayCandidate({
        candidateStartDateStr: dateStr,
        numDays,
        desiredHour,
        desiredMinute,
        perDayDurationMs,
        venueEvents,
        attendeeEvents,
        creatorEvents,
        minStart: now,
      });
      if (candidate) {
        results.push({
          start_datetime: candidate.start.toISOString(),
          end_datetime: candidate.end.toISOString(),
          adjusted: dateStr !== originalDateStr,
          conflict_free: { venue: true, attendees: true, creator: true },
        });
      }
      cursor.setDate(cursor.getDate() + 1);
    }
    return results;
  }

  // ── Single-day duration search within a daily time window. ──
  const durationMs = durationHours * 3600000;

  while (cursor <= dateEnd && results.length < MAX_RESULTS && guard < 400) {
    guard++;
    const dateStr = toDateInputStr(cursor);

    const dayRecs = getDayRecommendations({
      dateStr,
      durationMs,
      desiredHour,
      desiredMinute,
      venueEvents,
      attendeeEvents,
      creatorEvents,
      windowStart: windowStart || DEFAULT_WINDOW_START,
      windowEnd: windowEnd || DEFAULT_WINDOW_END,
      minStart: now,
    });

    for (const rec of dayRecs) {
      if (rec.start < now) continue; // never suggest a past date/time
      results.push({
        start_datetime: rec.start.toISOString(),
        end_datetime: rec.end.toISOString(),
        adjusted: rec.adjusted,
        conflict_free: checkConflictFreeFlags(
          rec.start,
          rec.end,
          venueEvents,
          attendeeEvents,
          creatorEvents,
        ),
      });
    }

    cursor.setDate(cursor.getDate() + 1);
  }

  return results;
};

const ConflictCard = ({
  conflictData,
  checking,
  isOpen,
  onClose,
  onApplyRecommendation,
  originalStartISO,
  originalEndISO,
  method,
}) => {
  const [activeTab, setActiveTab] = useState("venue");
  const [showAllRecommendations, setShowAllRecommendations] = useState(false);
  // Multi-select toggle filters — any combination of "all" | "venue" |
  // "attendees" | "creator" can be active at once.
  const [recommendationFilters, setRecommendationFilters] = useState([]);

  const [dragY, setDragY] = useState(0);
  const [dragging, setDragging] = useState(false);
  const dragRef = useRef({ startY: 0 });

  const [showAdvanced, setShowAdvanced] = useState(false);

  const [advDuration, setAdvDuration] = useState(1);
  const [advDurationDays, setAdvDurationDays] = useState(1);
  const [advWindowStart, setAdvWindowStart] = useState(DEFAULT_WINDOW_START);
  const [advWindowEnd, setAdvWindowEnd] = useState(DEFAULT_WINDOW_END);
  const [advDateStart, setAdvDateStart] = useState(toDateInputStr(new Date()));
  const [advDateEnd, setAdvDateEnd] = useState(toDateInputStr(new Date()));

  const [activeParams, setActiveParams] = useState(null);

  const originalStart = originalStartISO ? new Date(originalStartISO) : null;
  const originalEnd = originalEndISO ? new Date(originalEndISO) : null;

  // ── Re-sync every field to the CURRENTLY selected event's own date/time/
  // duration every time the sheet is opened — never rely on stale mount-time
  // defaults, since originalStartISO/originalEndISO may not have been ready
  // when this component first mounted. ──
  useEffect(() => {
    if (!isOpen || !originalStart || !originalEnd) return;

    const startDateOnly = new Date(
      originalStart.getFullYear(),
      originalStart.getMonth(),
      originalStart.getDate(),
    );
    const endDateOnly = new Date(
      originalEnd.getFullYear(),
      originalEnd.getMonth(),
      originalEnd.getDate(),
    );
    const numDays = Math.round((endDateOnly - startDateOnly) / 86400000) + 1;
    const isMultiDay = numDays > 1;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    // Never start the search range in the past.
    const dStart =
      startDateOnly < today ? new Date(today) : new Date(startDateOnly);
    const dEnd = new Date(dStart);
    dEnd.setDate(dEnd.getDate() + DEFAULT_LOOKAHEAD_DAYS);

    // For a multi-day event, "duration" means the PER-DAY time span (e.g.
    // 6 AM – 7 PM each day), not the raw hour count across every day.
    let perDayHours;
    if (isMultiDay) {
      let mins =
        originalEnd.getHours() * 60 +
        originalEnd.getMinutes() -
        (originalStart.getHours() * 60 + originalStart.getMinutes());
      if (mins <= 0) mins += 24 * 60;
      perDayHours = Math.max(0.5, mins / 60);
    } else {
      perDayHours = Math.max(0.5, (originalEnd - originalStart) / 3600000);
    }

    setAdvDuration(perDayHours);
    setAdvDurationDays(numDays);
    setAdvWindowStart(DEFAULT_WINDOW_START);
    setAdvDateStart(toDateInputStr(dStart));
    setAdvDateEnd(toDateInputStr(dEnd));

    setActiveParams({
      durationHours: perDayHours,
      perDayDurationMs: isMultiDay ? perDayHours * 3600000 : null,
      dateStart: dStart,
      dateEnd: dEnd,
      windowStart: DEFAULT_WINDOW_START,
      windowEnd: addHoursToTimeStr(DEFAULT_WINDOW_START, perDayHours),
      isMultiDay,
      numDays,
    });
    setShowAllRecommendations(false);
    setRecommendationFilters([]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isOpen, originalStartISO, originalEndISO]);

  // "Preferred Time Until" is always derived from "Preferred Time From" +
  // "Preferred Duration" — it's never typed in directly.
  useEffect(() => {
    setAdvWindowEnd(addHoursToTimeStr(advWindowStart, advDuration));
  }, [advWindowStart, advDuration]);

  const recommendations = useMemo(() => {
    if (!conflictData || !originalStart || !activeParams) return [];
    return generateRecommendations({
      originalStart,
      durationHours: activeParams.durationHours,
      perDayDurationMs: activeParams.perDayDurationMs,
      conflicts: conflictData.conflicts,
      dateStart: activeParams.dateStart,
      dateEnd: activeParams.dateEnd,
      windowStart: activeParams.windowStart,
      windowEnd: activeParams.windowEnd,
      isMultiDay: activeParams.isMultiDay,
      numDays: activeParams.numDays,
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conflictData, originalStartISO, originalEndISO, activeParams]);

  const handleSearchWithAdvanced = () => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    let dStart = new Date(`${advDateStart}T00:00:00`);
    if (dStart < today) dStart = new Date(today); // never search before today
    const dEnd = new Date(`${advDateEnd}T00:00:00`);

    const days = Math.max(1, Math.round(Number(advDurationDays) || 1));
    const hours = Number(advDuration) || 1;
    const isMultiDay = days > 1;

    setActiveParams({
      durationHours: hours,
      perDayDurationMs: isMultiDay ? hours * 3600000 : null,
      dateStart: dStart,
      dateEnd: dEnd,
      windowStart: advWindowStart,
      windowEnd: advWindowEnd,
      // "Duration of Event (days)" > 1 switches to the same-time-every-day
      // multi-day search; otherwise it's a normal single-day window search.
      isMultiDay,
      numDays: days,
    });
    setShowAllRecommendations(false);
  };

  if (!isOpen || !conflictData) return null;

  const { conflicts } = conflictData;
  const canSuggestOnline = method === "face-to-face" && conflicts?.venue?.has;

  const handleTouchStart = (e) => {
    dragRef.current.startY = e.touches[0].clientY;
    setDragging(true);
  };
  const handleTouchMove = (e) => {
    const delta = e.touches[0].clientY - dragRef.current.startY;
    if (delta > 0) setDragY(delta);
  };
  const handleTouchEnd = () => {
    if (dragY > DRAG_CLOSE_THRESHOLD) onClose();
    setDragY(0);
    setDragging(false);
  };

  const toggleRecommendationFilter = (key) => {
    setRecommendationFilters((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  };

  // Each toggle only ADDS a requirement — combining "Venue Free" and "You
  // Free" shows slots where both are true, ignoring attendees entirely.
  // Selecting nothing shows everything, unfiltered.
  const getFilteredRecs = () => {
    if (!recommendations || recommendations.length === 0) return [];
    const wantAll = recommendationFilters.includes("all");
    const wantVenue = wantAll || recommendationFilters.includes("venue");
    const wantAttendees =
      wantAll || recommendationFilters.includes("attendees");
    const wantCreator = wantAll || recommendationFilters.includes("creator");

    if (!wantVenue && !wantAttendees && !wantCreator) return recommendations;

    return recommendations.filter((r) => {
      if (wantVenue && !r.conflict_free.venue) return false;
      if (wantAttendees && !r.conflict_free.attendees) return false;
      if (wantCreator && !r.conflict_free.creator) return false;
      return true;
    });
  };

  const filteredRecs = getFilteredRecs();
  const displayRecs = showAllRecommendations
    ? filteredRecs
    : filteredRecs.slice(0, INITIAL_VISIBLE);

  const formatDateTime = (dt) => {
    const d = new Date(dt);
    return d.toLocaleString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const handleSwitchToOnline = () => {
    onApplyRecommendation({
      type: "method_switch",
      method: "online",
      start_datetime: originalStartISO,
      end_datetime: originalEndISO,
    });
  };

  const handleSelectSlot = (slot) => {
    onApplyRecommendation({
      type: "time_shift",
      start_datetime: slot.start_datetime,
      end_datetime: slot.end_datetime,
    });
  };

  return (
    <div className={styles.overlay} onClick={onClose}>
      <div
        className={styles.sheet}
        onClick={(e) => e.stopPropagation()}
        style={{
          transform: `translateY(${dragY}px)`,
          transition: dragging ? "none" : "transform 0.2s ease",
        }}
      >
        <div
          className={styles.stickyHeader}
          onTouchStart={handleTouchStart}
          onTouchMove={handleTouchMove}
          onTouchEnd={handleTouchEnd}
        >
          <div className={styles.handle}>
            <FiChevronDown size={22} />
          </div>
          <h2 className={styles.title}>
            <FiAlertCircle size={20} className={styles.titleIcon} />
            Schedule Conflicts
          </h2>

          <div className={styles.tabs}>
            {conflicts.venue.has && (
              <button
                type="button"
                className={`${styles.tab} ${activeTab === "venue" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("venue")}
              >
                <FiMapPin size={16} /> Venue
              </button>
            )}
            {conflicts.attendees.has && (
              <button
                type="button"
                className={`${styles.tab} ${activeTab === "attendees" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("attendees")}
              >
                <FiUsers size={16} /> Attendees
              </button>
            )}
            {conflicts.creator.has && (
              <button
                type="button"
                className={`${styles.tab} ${activeTab === "creator" ? styles.activeTab : ""}`}
                onClick={() => setActiveTab("creator")}
              >
                <FiUser size={16} /> You
              </button>
            )}
          </div>

          <button
            type="button"
            className={styles.advancedToggleBtn}
            onClick={() => setShowAdvanced((prev) => !prev)}
          >
            <FiSliders size={14} />
            Advanced Options
            <FiChevronDown
              size={14}
              style={{
                transform: showAdvanced ? "rotate(180deg)" : "none",
                transition: "transform 0.2s",
              }}
            />
          </button>
        </div>

        <div className={styles.scrollArea}>
          {showAdvanced && (
            <div className={styles.advancedPanel}>
              <div className={styles.advField}>
                <label>Preferred Duration (hours)</label>
                <input
                  type="number"
                  min="0.5"
                  step="0.5"
                  value={advDuration}
                  onChange={(e) => setAdvDuration(e.target.value)}
                />
              </div>
              <div className={styles.advField}>
                <label>Duration of Event (days)</label>
                <input
                  type="number"
                  min="1"
                  step="1"
                  value={advDurationDays}
                  onChange={(e) => setAdvDurationDays(e.target.value)}
                  title="More than 1 day searches for the same daily time slot repeated across that many consecutive days (e.g. Aug 14 to Aug 17)"
                />
              </div>
              <div className={styles.advRow}>
                <div className={styles.advField}>
                  <label>Preferred Time From</label>
                  <input
                    type="time"
                    value={advWindowStart}
                    onChange={(e) => setAdvWindowStart(e.target.value)}
                  />
                </div>
                <div className={styles.advField}>
                  <label>Preferred Time Until (auto)</label>
                  <input
                    type="time"
                    value={advWindowEnd}
                    readOnly
                    disabled
                    title="Calculated automatically from Preferred Time From + Preferred Duration"
                  />
                </div>
              </div>
              <div className={styles.advRow}>
                <div className={styles.advField}>
                  <label>Date Range From</label>
                  <input
                    type="date"
                    value={advDateStart}
                    min={toDateInputStr(new Date())}
                    onChange={(e) => setAdvDateStart(e.target.value)}
                  />
                </div>
                <div className={styles.advField}>
                  <label>Date Range Until</label>
                  <input
                    type="date"
                    value={advDateEnd}
                    min={advDateStart || toDateInputStr(new Date())}
                    onChange={(e) => setAdvDateEnd(e.target.value)}
                  />
                </div>
              </div>
              <button
                type="button"
                className={styles.advSearchBtn}
                onClick={handleSearchWithAdvanced}
              >
                <FiClock size={14} /> Search With These Settings
              </button>
            </div>
          )}

          {canSuggestOnline && (
            <div className={styles.onlineSuggestion}>
              <div className={styles.onlineSuggestionHeader}>
                <FiWifi size={18} />
                <span>
                  This is a Venue Conflict — switch to Online instead?
                </span>
              </div>
              <p className={styles.onlineSuggestionDesc}>
                Keep the same date and time, but hold the event online. This
                removes the venue requirement entirely and resolves the venue
                conflict.
              </p>
              <button
                type="button"
                className={styles.onlineSuggestionBtn}
                onClick={handleSwitchToOnline}
              >
                Switch This Event to Online
              </button>
            </div>
          )}

          <div className={styles.tabContent}>
            {activeTab === "venue" && conflicts.venue.has && (
              <div>
                <h3 className={styles.sectionSubtitle}>
                  <FiMapPin size={18} /> Venue Conflict
                </h3>
                {conflicts.venue.events.map((ev) => (
                  <div key={ev.id} className={styles.conflictItem}>
                    <div className={styles.itemHeader}>
                      <span
                        className={styles.itemTitle}
                        style={{ backgroundColor: ev.color || "#800000" }}
                      >
                        {ev.title}
                      </span>
                      <span className={styles.itemDate}>
                        <FiCalendar size={14} />{" "}
                        {formatDateTime(ev.start_datetime)}
                        <FiArrowRight size={14} className={styles.arrowIcon} />
                        {formatDateTime(ev.end_datetime)}
                      </span>
                    </div>
                    <div className={styles.itemDetails}>
                      <p>
                        <FiInfo size={14} /> <strong>Type:</strong>{" "}
                        {ev.visibility} · {ev.hierarchy}
                      </p>
                      <p>
                        <strong>Description:</strong>{" "}
                        {ev.description || "No description"}
                      </p>
                      <p>
                        <strong>Creator:</strong>{" "}
                        {ev.creator?.username || "Unknown"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {activeTab === "attendees" && conflicts.attendees.has && (
              <div>
                <h3 className={styles.sectionSubtitle}>
                  <FiUsers size={18} /> Attendee Conflicts
                </h3>
                {conflicts.attendees.users.map((u) => (
                  <div key={u.user.id} className={styles.attendeeConflict}>
                    <div className={styles.attendeeHeader}>
                      <FiUser size={16} /> <strong>{u.user.username}</strong>{" "}
                      <span className={styles.attendeeEmail}>
                        ({u.user.email})
                      </span>
                      <span className={styles.badge}>
                        {u.events.length} conflicting event(s)
                      </span>
                    </div>
                    {u.events.map((ev) => (
                      <div key={ev.id} className={styles.conflictItem}>
                        <div className={styles.itemHeader}>
                          <span
                            className={styles.itemTitle}
                            style={{ backgroundColor: ev.color || "#800000" }}
                          >
                            {ev.title}
                          </span>
                          <span className={styles.itemDate}>
                            <FiCalendar size={14} />{" "}
                            {formatDateTime(ev.start_datetime)}
                            <FiArrowRight
                              size={14}
                              className={styles.arrowIcon}
                            />
                            {formatDateTime(ev.end_datetime)}
                          </span>
                        </div>
                        <div className={styles.itemDetails}>
                          <p>
                            <strong>Venue:</strong> {ev.venue || "N/A"}
                          </p>
                          <p>
                            <strong>Creator:</strong>{" "}
                            {ev.creator?.username || "Unknown"}
                          </p>
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            )}

            {activeTab === "creator" && conflicts.creator.has && (
              <div>
                <h3 className={styles.sectionSubtitle}>
                  <FiUser size={18} /> You have a conflict
                </h3>
                {conflicts.creator.events.map((ev) => (
                  <div key={ev.id} className={styles.conflictItem}>
                    <div className={styles.itemHeader}>
                      <span
                        className={styles.itemTitle}
                        style={{ backgroundColor: ev.color || "#800000" }}
                      >
                        {ev.title}
                      </span>
                      <span className={styles.itemDate}>
                        <FiCalendar size={14} />{" "}
                        {formatDateTime(ev.start_datetime)}
                        <FiArrowRight size={14} className={styles.arrowIcon} />
                        {formatDateTime(ev.end_datetime)}
                      </span>
                    </div>
                    <div className={styles.itemDetails}>
                      <p>
                        <strong>Type:</strong> {ev.visibility} · {ev.hierarchy}
                      </p>
                      <p>
                        <strong>Venue:</strong> {ev.venue || "Online"}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className={styles.recommendations}>
            <h3 className={styles.sectionSubtitle}>
              <FiCheckCircle size={18} /> Recommended Schedules
            </h3>
            <div className={styles.filterButtons}>
              <button
                type="button"
                className={`${styles.filterBtn} ${recommendationFilters.includes("all") ? styles.activeFilter : ""}`}
                onClick={() => toggleRecommendationFilter("all")}
              >
                All Free
              </button>
              <button
                type="button"
                className={`${styles.filterBtn} ${recommendationFilters.includes("venue") ? styles.activeFilter : ""}`}
                onClick={() => toggleRecommendationFilter("venue")}
              >
                Venue Free
              </button>
              <button
                type="button"
                className={`${styles.filterBtn} ${recommendationFilters.includes("creator") ? styles.activeFilter : ""}`}
                onClick={() => toggleRecommendationFilter("creator")}
              >
                You Free
              </button>
              <button
                type="button"
                className={`${styles.filterBtn} ${recommendationFilters.includes("attendees") ? styles.activeFilter : ""}`}
                onClick={() => toggleRecommendationFilter("attendees")}
              >
                All Attendees Free
              </button>
            </div>

            {filteredRecs.length === 0 ? (
              <div className={styles.emptyRecsNotice}>
                <FiInfo size={16} />
                <span>
                  No available slots found in this range. Try Advanced Options
                  to widen the search.
                </span>
              </div>
            ) : (
              <>
                <div className={styles.slotList}>
                  {displayRecs.map((slot, idx) => (
                    <div
                      key={idx}
                      className={styles.slotItem}
                      onClick={() => handleSelectSlot(slot)}
                    >
                      <div className={styles.slotTime}>
                        <span className={styles.slotStart}>
                          {formatDateTime(slot.start_datetime)}
                        </span>
                        <FiArrowRight size={16} className={styles.slotArrow} />
                        <span className={styles.slotEnd}>
                          {formatDateTime(slot.end_datetime)}
                        </span>
                      </div>
                      <div className={styles.slotTags}>
                        {slot.adjusted && (
                          <span className={styles.tagAdjusted}>
                            Adjusted Time
                          </span>
                        )}
                        {slot.conflict_free.venue && (
                          <span className={styles.tagFree}>Venue Free</span>
                        )}
                        {slot.conflict_free.attendees && (
                          <span className={styles.tagFree}>Attendees Free</span>
                        )}
                        {slot.conflict_free.creator && (
                          <span className={styles.tagFree}>You Free</span>
                        )}
                        {!slot.conflict_free.venue && (
                          <span className={styles.tagConflict}>
                            Venue Conflict
                          </span>
                        )}
                        {!slot.conflict_free.attendees && (
                          <span className={styles.tagConflict}>
                            Attendee Conflict
                          </span>
                        )}
                        {!slot.conflict_free.creator && (
                          <span className={styles.tagConflict}>
                            You Conflict
                          </span>
                        )}
                      </div>
                      <button type="button" className={styles.selectSlotBtn}>
                        Select
                      </button>
                    </div>
                  ))}
                </div>

                {filteredRecs.length > INITIAL_VISIBLE && (
                  <button
                    type="button"
                    className={styles.showMoreBtn}
                    onClick={() =>
                      setShowAllRecommendations(!showAllRecommendations)
                    }
                  >
                    {showAllRecommendations
                      ? "Show Less"
                      : `Show ${filteredRecs.length - INITIAL_VISIBLE} More`}
                  </button>
                )}
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default ConflictCard;
