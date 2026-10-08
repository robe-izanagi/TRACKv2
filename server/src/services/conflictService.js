const { Op } = require('sequelize');
const {
  Event, EventAttendee, User, UserProfile,
  Position, PositionAssignment
} = require('../models');

const HIERARCHY_RANK = { local: 1, regional: 2, national: 3, international: 4 };
const VISIBILITY_RANK = { private: 1, department: 2, campus: 3 };
const METHOD_RANK = { online: 1, 'face-to-face': 2 };

function isOverlap(s1, e1, s2, e2) {
  return s1 < e2 && e1 > s2;
}

// Lowest position 'order' among a user's active position assignments (lower = more senior).
// Infinity if the user holds no active position (least senior by default).
async function getCreatorPositionOrder(userId) {
  const assignments = await PositionAssignment.findAll({
    where: { user_id: userId, status: 'active' }
  });
  if (assignments.length === 0) return Infinity;
  let minOrder = Infinity;
  for (const a of assignments) {
    const pos = await Position.findByPk(a.position_id);
    if (pos && pos.order < minOrder) minOrder = pos.order;
  }
  return minOrder;
}

async function getCreatorLabel(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'username', 'email'] });
  if (!user) return 'Unknown';
  const profile = await UserProfile.findOne({ where: { user_id: userId } });
  return profile?.full_name || user.username || user.email;
}

// Events relevant to a user's own schedule: created by them, or invited & not declined.
async function getUserScheduleEvents(userId) {
  const attendeeRecords = await EventAttendee.findAll({
    where: { user_id: userId, response: { [Op.ne]: 'declined' } },
    attributes: ['event_id']
  });
  const eventIds = attendeeRecords.map(r => r.event_id);

  return Event.findAll({
    where: {
      is_archived: false,
      is_deleted: false,
      [Op.or]: [
        { creator_id: userId },
        { id: { [Op.in]: eventIds } }
      ]
    }
  });
}

// Union-Find for clustering overlapping events
function find(parent, x) {
  if (parent[x] !== x) parent[x] = find(parent, parent[x]);
  return parent[x];
}
function union(parent, a, b) {
  const ra = find(parent, a);
  const rb = find(parent, b);
  if (ra !== rb) parent[ra] = rb;
}

// Negative => a is MORE prior than b. Order: position (asc) -> hierarchy (desc) -> visibility (desc) -> method (desc, face-to-face wins)
function compareEventPriority(a, b) {
  if (a.creatorOrder !== b.creatorOrder) return a.creatorOrder - b.creatorOrder;
  const hA = HIERARCHY_RANK[a.hierarchy] || 0;
  const hB = HIERARCHY_RANK[b.hierarchy] || 0;
  if (hA !== hB) return hB - hA;
  const vA = VISIBILITY_RANK[a.visibility] || 0;
  const vB = VISIBILITY_RANK[b.visibility] || 0;
  if (vA !== vB) return vB - vA;
  const mA = METHOD_RANK[a.method] || 0;
  const mB = METHOD_RANK[b.method] || 0;
  if (mA !== mB) return mB - mA;
  return 0;
}

function describeDecidingFactor(a, b) {
  if (a.creatorOrder !== b.creatorOrder) {
    return `${a.creatorLabel}'s position outranks ${b.creatorLabel}'s position`;
  }
  const hA = HIERARCHY_RANK[a.hierarchy] || 0;
  const hB = HIERARCHY_RANK[b.hierarchy] || 0;
  if (hA !== hB) {
    return `"${a.title}" has a higher event hierarchy (${a.hierarchy}) than "${b.title}" (${b.hierarchy})`;
  }
  const vA = VISIBILITY_RANK[a.visibility] || 0;
  const vB = VISIBILITY_RANK[b.visibility] || 0;
  if (vA !== vB) {
    return `"${a.title}" has wider visibility (${a.visibility}) than "${b.title}" (${b.visibility})`;
  }
  const mA = METHOD_RANK[a.method] || 0;
  const mB = METHOD_RANK[b.method] || 0;
  if (mA !== mB) {
    return `"${a.title}" is face-to-face while "${b.title}" is online`;
  }
  return 'both events are tied on every priority factor';
}

/**
 * Builds eventId -> conflict info for every event relevant to userId's own schedule.
 * {
 *   [eventId]: {
 *     isConflicted: boolean,
 *     isPriority: boolean,
 *     conflictsWith: [{ id, title }],
 *     reason: string | null
 *   }
 * }
 */
async function buildConflictMap(userId) {
  const events = await getUserScheduleEvents(userId);
  const map = {};
  if (events.length < 2) {
    events.forEach(ev => {
      map[ev.id] = { isConflicted: false, isPriority: false, conflictsWith: [], reason: null };
    });
    return map;
  }

  const enriched = [];
  const orderCache = {};
  const labelCache = {};
  for (const ev of events) {
    if (!(ev.creator_id in orderCache)) {
      orderCache[ev.creator_id] = await getCreatorPositionOrder(ev.creator_id);
    }
    if (!(ev.creator_id in labelCache)) {
      labelCache[ev.creator_id] = await getCreatorLabel(ev.creator_id);
    }
    enriched.push({
      id: ev.id,
      title: ev.title,
      start: ev.start_datetime,
      end: ev.end_datetime,
      hierarchy: ev.hierarchy,
      visibility: ev.visibility,
      method: ev.method,
      creatorOrder: orderCache[ev.creator_id],
      creatorLabel: labelCache[ev.creator_id],
    });
  }

  const parent = {};
  enriched.forEach(e => { parent[e.id] = e.id; });
  for (let i = 0; i < enriched.length; i++) {
    for (let j = i + 1; j < enriched.length; j++) {
      if (isOverlap(enriched[i].start, enriched[i].end, enriched[j].start, enriched[j].end)) {
        union(parent, enriched[i].id, enriched[j].id);
      }
    }
  }

  const clusters = {};
  enriched.forEach(e => {
    const root = find(parent, e.id);
    if (!clusters[root]) clusters[root] = [];
    clusters[root].push(e);
  });

  for (const root in clusters) {
    const cluster = clusters[root];
    if (cluster.length < 2) {
      const e = cluster[0];
      map[e.id] = { isConflicted: false, isPriority: false, conflictsWith: [], reason: null };
      continue;
    }

    const sorted = [...cluster].sort(compareEventPriority);
    const winner = sorted[0];

    cluster.forEach(e => {
      const others = cluster.filter(o => o.id !== e.id);
      const isWinner = e.id === winner.id;
      let reason;
      if (isWinner) {
        const runnerUp = sorted[1];
        reason = `This event takes priority over "${runnerUp.title}" — ${describeDecidingFactor(e, runnerUp)}.`;
      } else {
        reason = `This event conflicts with "${winner.title}", which takes priority — ${describeDecidingFactor(winner, e)}.`;
      }
      map[e.id] = {
        isConflicted: true,
        isPriority: isWinner,
        conflictsWith: others.map(o => ({ id: o.id, title: o.title })),
        reason
      };
    });
  }

  return map;
}

module.exports = { buildConflictMap };