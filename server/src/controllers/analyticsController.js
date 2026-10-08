const { Op } = require('sequelize');
const {
  Event, EventAttendee, Venue, VenueConflictLog,
  UserProfile, Department, Office, User,
  Task, TaskAssignee, TaskCollaborator
} = require('../models');
const { buildConflictMap } = require('../services/conflictService');

const DAY_MS = 24 * 60 * 60 * 1000;
const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

// ─── Helpers ────────────────────────────────────────────
function getRangeStart(range) {
  const d = new Date();
  d.setDate(d.getDate() - Number(range || 30));
  d.setHours(0, 0, 0, 0);
  return d;
}

function eventStatus(ev, now) {
  if (now < new Date(ev.start_datetime)) return 'upcoming';
  if (now >= new Date(ev.start_datetime) && now <= new Date(ev.end_datetime)) return 'ongoing';
  return 'past';
}

function shortDateLabel(d) {
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function buildWeeklyBuckets(startDate, now, bucketCount = 7) {
  const totalMs = Math.max(now - startDate, DAY_MS);
  const chunkMs = totalMs / bucketCount;
  const buckets = [];
  for (let i = 0; i < bucketCount; i++) {
    const bStart = new Date(startDate.getTime() + i * chunkMs);
    const bEnd = new Date(startDate.getTime() + (i + 1) * chunkMs);
    buckets.push({ start: bStart, end: bEnd, count: 0, label: shortDateLabel(bStart) });
  }
  return buckets;
}

function addToBucket(buckets, dateVal) {
  const d = new Date(dateVal);
  for (const b of buckets) {
    if (d >= b.start && d < b.end) { b.count++; return; }
  }
  if (buckets.length) buckets[buckets.length - 1].count++;
}

// Unique departments/offices contributed to an event by ACCEPTED attendees + the creator
async function getEventAffiliations(ev) {
  const departmentIds = new Set();
  const officeIds = new Set();

  const userIds = new Set();
  userIds.add(ev.creator_id);
  const acceptedAttendees = await EventAttendee.findAll({ where: { event_id: ev.id, response: 'accepted' } });
  acceptedAttendees.forEach(a => userIds.add(a.user_id));

  for (const uid of userIds) {
    const profile = await UserProfile.findOne({ where: { user_id: uid } });
    if (profile?.department_id) departmentIds.add(profile.department_id);
    if (profile?.office_id) officeIds.add(profile.office_id);
  }

  return { departmentIds, officeIds };
}

async function eventBelongsToOffice(ev, officeId) {
  const { officeIds } = await getEventAffiliations(ev);
  return officeIds.has(officeId);
}

async function buildVisibilityStats(events, userId, startDate, now) {
  const eventIds = events.map(e => e.id);
  const attendances = eventIds.length
    ? await EventAttendee.findAll({ where: { user_id: userId, event_id: { [Op.in]: eventIds } } })
    : [];
  const attendanceMap = {};
  attendances.forEach(a => { attendanceMap[a.event_id] = a.response; });

  let total = events.length, pending = 0, declined = 0, missed = 0;
  const buckets = buildWeeklyBuckets(startDate, now);

  for (const ev of events) {
    const response = attendanceMap[ev.id] || 'pending';
    if (response === 'declined') declined++;
    else if (response === 'pending') {
      pending++;
      if (new Date(ev.end_datetime) < now) missed++;
    }
    addToBucket(buckets, ev.start_datetime);
  }

  return { total, pending, declined, missed, chart: buckets.map(b => ({ label: b.label, count: b.count })) };
}

// ─── 1. Campus + Department + Office Events KPI ────────
exports.getCampusOfficeStats = async (req, res) => {
  try {
    const { range = 30 } = req.query;
    const userId = req.userId;
    const startDate = getRangeStart(range);
    const now = new Date();

    // ── Campus ──
    const campusEvents = await Event.findAll({
      where: { visibility: 'campus', is_archived: false, is_deleted: false, start_datetime: { [Op.gte]: startDate } },
      order: [['start_datetime', 'ASC']]
    });
    const campusStats = await buildVisibilityStats(campusEvents, userId, startDate, now);

    const profile = await UserProfile.findOne({ where: { user_id: userId } });

    // ── Department (getEventStats type='department') ──
    let departmentEvents = [];
    if (profile?.department_id) {
      departmentEvents = await Event.findAll({
        where: {
          visibility: 'department', department_id: profile.department_id,
          is_archived: false, is_deleted: false, start_datetime: { [Op.gte]: startDate }
        },
        order: [['start_datetime', 'ASC']]
      });
    }
    const departmentStats = await buildVisibilityStats(departmentEvents, userId, startDate, now);

    // ── Office ──
    let officeEvents = [];
    if (profile?.office_id) {
      const candidateEvents = await Event.findAll({
        where: { is_archived: false, is_deleted: false, start_datetime: { [Op.gte]: startDate } }
      });
      for (const ev of candidateEvents) {
        if (await eventBelongsToOffice(ev, profile.office_id)) officeEvents.push(ev);
      }
    }
    const officeStats = await buildVisibilityStats(officeEvents, userId, startDate, now);

    res.json({ ok: true, campus: campusStats, department: departmentStats, office: officeStats });
  } catch (error) {
    console.error('Campus/Office stats error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── 2. Department / Office Performance (event-based) ──
exports.getDepartmentOfficePerformance = async (req, res) => {
  try {
    const { range = 30 } = req.query;
    const startDate = getRangeStart(range);

    const events = await Event.findAll({
      where: { is_archived: false, is_deleted: false, start_datetime: { [Op.gte]: startDate } }
    });

    const deptCounts = {};
    const officeCounts = {};
    let campusTotal = 0;

    for (const ev of events) {
      if (ev.visibility === 'campus') campusTotal++;
      const { departmentIds, officeIds } = await getEventAffiliations(ev);
      departmentIds.forEach(id => { deptCounts[id] = (deptCounts[id] || 0) + 1; });
      officeIds.forEach(id => { officeCounts[id] = (officeCounts[id] || 0) + 1; });
    }

    const departments = await Department.findAll();
    const offices = await Office.findAll();

    const departmentRanking = departments
      .map(d => ({ id: d.id, name: d.name, count: deptCounts[d.id] || 0 }))
      .filter(d => d.count > 0)
      .sort((a, b) => b.count - a.count);

    const officeRanking = offices
      .map(o => ({ id: o.id, name: o.name, count: officeCounts[o.id] || 0 }))
      .filter(o => o.count > 0)
      .sort((a, b) => b.count - a.count);

    res.json({ ok: true, campusTotal, departments: departmentRanking, offices: officeRanking });
  } catch (error) {
    console.error('Department/office performance error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── 3. Conflict Forecast (venue-based, from venue_conflict_logs) ──
exports.getConflictForecast = async (req, res) => {
  try {
    const { venue_id, days = 7 } = req.query;
    if (!venue_id) return res.status(400).json({ ok: false, message: 'venue_id is required.' });

    const forecastDays = Number(days) || 7;
    const now = new Date();
    const fourWeeksAgo = new Date(now.getTime() - 28 * DAY_MS);
    const twoWeeksAgo = new Date(now.getTime() - 14 * DAY_MS);

    const logs = await VenueConflictLog.findAll({
      where: { venue_id, created_at: { [Op.gte]: fourWeeksAgo } }
    });

    const weekdayTotals = [0, 0, 0, 0, 0, 0, 0];
    const recentTotals = [0, 0, 0, 0, 0, 0, 0];
    const priorTotals = [0, 0, 0, 0, 0, 0, 0];

    logs.forEach(l => {
      const created = new Date(l.created_at);
      const day = created.getDay();
      weekdayTotals[day]++;
      if (created >= twoWeeksAgo) recentTotals[day]++;
      else priorTotals[day]++;
    });

    const weekdayAvg = weekdayTotals.map(t => Math.round((t / 4) * 10) / 10);

    const recentSum = recentTotals.reduce((a, b) => a + b, 0);
    const priorSum = priorTotals.reduce((a, b) => a + b, 0) || 1;
    const growthRate = recentSum / priorSum;

    const order = [1, 2, 3, 4, 5, 6, 0]; // Mon..Sun
    const trend = order.map(i => ({
      day: WEEKDAY_NAMES[i],
      actual: weekdayAvg[i],
      predicted: Math.round(weekdayAvg[i] * Math.max(growthRate, 0.5) * 10) / 10,
    }));

    const totalConflictsLast4Weeks = logs.length;
    const forecastTotal = Math.round(trend.reduce((sum, d) => sum + d.predicted, 0));
    const percentChange = Math.round((growthRate - 1) * 100);
    const peakEntry = trend.reduce((max, d) => (d.predicted > max.predicted ? d : max), trend[0]);
    const highRisk = peakEntry.predicted >= 3 ? { day: peakEntry.day, predicted: peakEntry.predicted } : null;

    res.json({
      ok: true,
      trend,
      insights: {
        totalConflictsLast4Weeks,
        forecastDays,
        forecastTotal,
        percentChange,
        peakDay: peakEntry.day,
      },
      highRisk,
    });
  } catch (error) {
    console.error('Conflict forecast error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── 4. Venue Pie Chart (conflict share per venue) ──────
exports.getVenuePie = async (req, res) => {
  try {
    const { range = 30 } = req.query;
    const startDate = getRangeStart(range);

    const venues = await Venue.findAll();
    const logs = await VenueConflictLog.findAll({ where: { created_at: { [Op.gte]: startDate } } });

    const countByVenue = {};
    logs.forEach(l => { countByVenue[l.venue_id] = (countByVenue[l.venue_id] || 0) + 1; });

    const total = logs.length;
    const slices = venues
      .map(v => ({
        id: v.id,
        name: v.name,
        count: countByVenue[v.id] || 0,
        percent: total > 0 ? Math.round(((countByVenue[v.id] || 0) / total) * 100) : 0,
      }))
      .filter(v => v.count > 0)
      .sort((a, b) => b.count - a.count);

    res.json({ ok: true, total, venues: slices });
  } catch (error) {
    console.error('Venue pie error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── 5. Scheduling Conflicts (personal, campus/department/private overlaps) ──
exports.getSchedulingConflicts = async (req, res) => {
  try {
    const { range = 30 } = req.query;
    const userId = req.userId;
    const startDate = getRangeStart(range);

    const conflictMap = await buildConflictMap(userId);
    const conflictedIds = Object.keys(conflictMap).filter(id => conflictMap[id].isConflicted);

    if (conflictedIds.length === 0) {
      return res.json({ ok: true, campusOverlaps: 0, departmentOverlaps: 0, privateOverlaps: 0 });
    }

    const events = await Event.findAll({
      where: { id: { [Op.in]: conflictedIds }, is_archived: false, is_deleted: false, start_datetime: { [Op.gte]: startDate } }
    });

    let campusOverlaps = 0, departmentOverlaps = 0, privateOverlaps = 0;
    for (const ev of events) {
      if (ev.visibility === 'campus') campusOverlaps++;
      else if (ev.visibility === 'department') departmentOverlaps++;
      else if (ev.visibility === 'private') privateOverlaps++;
    }

    res.json({ ok: true, campusOverlaps, departmentOverlaps, privateOverlaps });
  } catch (error) {
    console.error('Scheduling conflicts error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── 6. Personal Events (Total / Ongoing / Missed) ─────
exports.getPersonalEvents = async (req, res) => {
  try {
    const { range = 30 } = req.query;
    const userId = req.userId;
    const startDate = getRangeStart(range);
    const now = new Date();

    const attendances = await EventAttendee.findAll({
      where: { user_id: userId, response: { [Op.ne]: 'declined' } }
    });
    const eventIds = attendances.map(a => a.event_id);
    const events = eventIds.length
      ? await Event.findAll({
        where: { id: { [Op.in]: eventIds }, is_archived: false, is_deleted: false, start_datetime: { [Op.gte]: startDate } }
      })
      : [];
    const attendanceMap = {};
    attendances.forEach(a => { attendanceMap[a.event_id] = a.response; });

    let total = 0, ongoing = 0, missed = 0;
    for (const ev of events) {
      total++;
      const response = attendanceMap[ev.id];
      const status = eventStatus(ev, now);
      if (status === 'ongoing') ongoing++;
      else if (response === 'pending' && status === 'past') missed++;
    }

    res.json({ ok: true, total, ongoing, missed });
  } catch (error) {
    console.error('Personal events stats error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── 7. Task Stats ──────────────────────────────────────
exports.getTaskStats = async (req, res) => {
  try {
    const { range = 30 } = req.query;
    const userId = req.userId;
    const startDate = getRangeStart(range);
    const now = new Date();

    const assigneeTasks = await TaskAssignee.findAll({ where: { user_id: userId }, attributes: ['task_id'] });
    const collabTasks = await TaskCollaborator.findAll({ where: { user_id: userId }, attributes: ['task_id'] });
    const taskIds = [...new Set([...assigneeTasks.map(a => a.task_id), ...collabTasks.map(c => c.task_id)])];

    const tasks = await Task.findAll({
      where: {
        [Op.or]: [{ creator_id: userId }, { id: { [Op.in]: taskIds } }],
        is_archived: false,
        is_deleted: false,
        deadline_datetime: { [Op.gte]: startDate }
      }
    });

    let completed = 0, missed = 0, ongoing = 0;
    const buckets = buildWeeklyBuckets(startDate, now);
    for (const t of tasks) {
      if (t.is_completed) { completed++; addToBucket(buckets, t.deadline_datetime); }
      else if (new Date(t.deadline_datetime) < now) missed++;
      else ongoing++;
    }

    res.json({
      ok: true,
      completed, missed, ongoing, total: tasks.length,
      chart: buckets.map(b => ({ label: b.label, count: b.count }))
    });
  } catch (error) {
    console.error('Task stats error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};