const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { Op } = require('sequelize');
const { Event, EventAttendee, Venue, User, Department, Office } = require('../models');

// Helper: check if two time ranges overlap
function isOverlap(start1, end1, start2, end2) {
  return start1 < end2 && end1 > start2;
}

// Helper: get conflicting events for a user (including those they are invited to)
async function getUserConflicts(userId, start, end, excludeEventId = null) {
  // Get events where user is an attendee (accepted/pending) or creator
  const attendeeRecords = await EventAttendee.findAll({
    where: { user_id: userId },
    attributes: ['event_id']
  });
  const eventIds = attendeeRecords.map(r => r.event_id);

  // Also include events created by the user (even if not in attendees? but they are added as attendee anyway)
  // Query events where user is creator OR attendee
  const whereClause = {
    [Op.or]: [
      { creator_id: userId },
      { id: { [Op.in]: eventIds } }
    ],
    is_archived: false,
    start_datetime: { [Op.lt]: end },
    end_datetime: { [Op.gt]: start }
  };
  if (excludeEventId) {
    whereClause.id = { [Op.ne]: excludeEventId };
  }
  return await Event.findAll({
    where: whereClause,
    attributes: ['id', 'title', 'start_datetime', 'end_datetime', 'color', 'visibility', 'hierarchy', 'venue_id', 'description'],
    include: [
      { model: User, as: 'user', attributes: ['id', 'username', 'email'] },
      { model: Venue, attributes: ['name'] }
    ],
    order: [['start_datetime', 'ASC']]
  });
}

// Helper: get venue conflicts for a given time range
async function getVenueConflicts(venueId, start, end, excludeEventId = null) {
  if (!venueId) return [];
  const whereClause = {
    venue_id: venueId,
    is_archived: false,
    start_datetime: { [Op.lt]: end },
    end_datetime: { [Op.gt]: start }
  };
  if (excludeEventId) {
    whereClause.id = { [Op.ne]: excludeEventId };
  }
  return await Event.findAll({
    where: whereClause,
    attributes: ['id', 'title', 'start_datetime', 'end_datetime', 'color', 'visibility', 'hierarchy', 'description'],
    include: [
      { model: User, as: 'user', attributes: ['id', 'username', 'email'] }
    ],
    order: [['start_datetime', 'ASC']]
  });
}

// Main conflict check endpoint
router.post('/check-conflicts', authenticate, async (req, res) => {
  try {
    const { venue_id, attendee_ids, creator_id, start_datetime, end_datetime, exclude_event_id } = req.body;

    const start = new Date(start_datetime);
    const end = new Date(end_datetime);
    if (start >= end) {
      return res.status(400).json({ ok: false, message: 'End time must be after start time.' });
    }

    const conflicts = {
      venue: { has: false, events: [] },
      attendees: { has: false, users: [] },
      creator: { has: false, events: [] }
    };

    // 1. Check venue conflicts
    if (venue_id) {
      const venueConflicts = await getVenueConflicts(venue_id, start, end, exclude_event_id);
      if (venueConflicts.length > 0) {
        conflicts.venue.has = true;
        conflicts.venue.events = venueConflicts.map(ev => ({
          id: ev.id,
          title: ev.title,
          start_datetime: ev.start_datetime,
          end_datetime: ev.end_datetime,
          color: ev.color,
          visibility: ev.visibility,
          hierarchy: ev.hierarchy,
          description: ev.description,
          creator: ev.user ? { id: ev.user.id, username: ev.user.username, email: ev.user.email } : null,
          // we can fetch number of participants later if needed
        }));
      }
    }

    // 2. Check attendee conflicts (including creator if they are in attendee_ids)
    // We'll combine all unique user IDs: creator + attendee_ids
    const allUserIds = new Set();
    if (creator_id) allUserIds.add(creator_id);
    if (attendee_ids && attendee_ids.length) {
      attendee_ids.forEach(id => allUserIds.add(id));
    }

    // For each user, get their conflicting events
    const userConflictMap = {};
    for (const userId of allUserIds) {
      const userConflicts = await getUserConflicts(userId, start, end, exclude_event_id);
      if (userConflicts.length > 0) {
        // Check if this user is the creator or an attendee
        const isCreator = userId === creator_id;
        const targetKey = isCreator ? 'creator' : 'attendees';
        if (isCreator) {
          conflicts.creator.has = true;
          conflicts.creator.events = userConflicts.map(ev => ({
            id: ev.id,
            title: ev.title,
            start_datetime: ev.start_datetime,
            end_datetime: ev.end_datetime,
            color: ev.color,
            visibility: ev.visibility,
            hierarchy: ev.hierarchy,
            description: ev.description,
            venue: ev.Venue ? ev.Venue.name : null,
            creator: ev.user ? { id: ev.user.id, username: ev.user.username, email: ev.user.email } : null,
          }));
        } else {
          // attendee
          if (!userConflictMap[userId]) {
            userConflictMap[userId] = [];
          }
          userConflictMap[userId].push(...userConflicts.map(ev => ({
            id: ev.id,
            title: ev.title,
            start_datetime: ev.start_datetime,
            end_datetime: ev.end_datetime,
            color: ev.color,
            visibility: ev.visibility,
            hierarchy: ev.hierarchy,
            description: ev.description,
            venue: ev.Venue ? ev.Venue.name : null,
            creator: ev.user ? { id: ev.user.id, username: ev.user.username, email: ev.user.email } : null,
          })));
        }
      }
    }

    // Now build attendee conflicts list
    if (Object.keys(userConflictMap).length > 0) {
      conflicts.attendees.has = true;
      // Fetch user details for each conflicted attendee
      const userIds = Object.keys(userConflictMap);
      const users = await User.findAll({
        where: { id: { [Op.in]: userIds } },
        attributes: ['id', 'username', 'email']
      });
      const userMap = {};
      users.forEach(u => userMap[u.id] = u);
      conflicts.attendees.users = userIds.map(userId => ({
        user: userMap[userId] ? { id: userMap[userId].id, username: userMap[userId].username, email: userMap[userId].email } : { id: userId },
        events: userConflictMap[userId]
      }));
    }

    // 3. Generate recommendations
    // We'll find alternative slots within ±7 days, 30-min increments, up to say 30 slots total.
    // We'll return first 3, and allow "show more" later (frontend can request more with pagination, but we'll just return more)
    // For simplicity, we'll compute up to 20 slots and return all; frontend will show 3 initially.

    const recommendations = await generateRecommendations({
      venue_id,
      attendee_ids: Array.from(allUserIds),
      creator_id,
      start,
      end,
      exclude_event_id,
      maxSlots: 20
    });

    res.json({
      ok: true,
      conflicts,
      recommendations: recommendations.map(r => ({
        start_datetime: r.start,
        end_datetime: r.end,
        conflict_free: r.free // array of 'venue', 'attendees', 'creator'
      }))
    });

  } catch (error) {
    console.error('Conflict check error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

// Recommendation generator
async function generateRecommendations({ venue_id, attendee_ids, creator_id, start, end, exclude_event_id, maxSlots = 20 }) {
  // Get all existing events for venue, attendees, and creator to check conflicts
  // We'll fetch all events that overlap with the search window (±7 days)
  const searchWindow = 7; // days
  const searchStart = new Date(start);
  searchStart.setDate(searchStart.getDate() - searchWindow);
  const searchEnd = new Date(end);
  searchEnd.setDate(searchEnd.getDate() + searchWindow);

  // Fetch all events for venue, attendees, creator within the search window
  // We need to query events where any of the constraints are involved.
  // We'll collect all event IDs that are associated with the venue, attendees, or creator.
  // This is more efficient: fetch all events within the window, then filter.

  // For simplicity, we'll fetch all events in the window and then filter by constraints.
  // Since we have limited data, this is fine.
  const allEventsInWindow = await Event.findAll({
    where: {
      is_archived: false,
      [Op.or]: [
        { creator_id: { [Op.in]: attendee_ids } },
        { venue_id: venue_id || null },
        { id: { [Op.in]: await getAttendeeEventIds(attendee_ids) } } // we need events where attendees are invited
      ],
      start_datetime: { [Op.lt]: searchEnd },
      end_datetime: { [Op.gt]: searchStart }
    },
    attributes: ['id', 'venue_id', 'creator_id', 'start_datetime', 'end_datetime']
  });

  // Also need events where attendees are invited but not necessarily creator
  // We'll query EventAttendee for these users
  async function getAttendeeEventIds(userIds) {
    if (!userIds || userIds.length === 0) return [];
    const records = await EventAttendee.findAll({
      where: { user_id: { [Op.in]: userIds } },
      attributes: ['event_id']
    });
    return records.map(r => r.event_id);
  }

  // We'll get all events for attendees (including those they are invited to)
  const attendeeEventIds = await getAttendeeEventIds(attendee_ids);
  const allRelatedEvents = await Event.findAll({
    where: {
      is_archived: false,
      [Op.or]: [
        { id: { [Op.in]: attendeeEventIds } },
        { creator_id: { [Op.in]: attendee_ids } },
        { venue_id: venue_id || null }
      ],
      start_datetime: { [Op.lt]: searchEnd },
      end_datetime: { [Op.gt]: searchStart }
    },
    attributes: ['id', 'venue_id', 'creator_id', 'start_datetime', 'end_datetime']
  });

  // Now generate candidate slots: from searchStart to searchEnd, step 30 minutes
  const stepMinutes = 30;
  const durationMinutes = (end - start) / (1000 * 60);
  const candidates = [];
  const current = new Date(searchStart);
  // We'll generate slots starting at each possible time
  while (current < searchEnd) {
    const candStart = new Date(current);
    const candEnd = new Date(candStart.getTime() + durationMinutes * 60 * 1000);
    if (candEnd > searchEnd) break;

    // Check conflicts
    const free = {
      venue: true,
      attendees: true,
      creator: true
    };

    // Check venue conflict
    if (venue_id) {
      const venueConflict = allRelatedEvents.some(ev =>
        ev.venue_id === venue_id &&
        isOverlap(candStart, candEnd, ev.start_datetime, ev.end_datetime) &&
        ev.id !== exclude_event_id
      );
      if (venueConflict) free.venue = false;
    }

    // Check attendee conflicts (including creator)
    for (const userId of attendee_ids) {
      const userConflict = allRelatedEvents.some(ev =>
        (ev.creator_id === userId || ev.id && attendeeEventIds.includes(ev.id)) &&
        isOverlap(candStart, candEnd, ev.start_datetime, ev.end_datetime) &&
        ev.id !== exclude_event_id
      );
      if (userConflict) {
        if (userId === creator_id) free.creator = false;
        else free.attendees = false;
        break; // we can break early because we just need to know if any conflict
      }
    }

    // Check if this candidate is a duplicate of original? skip if same start/end
    if (candStart.getTime() === start.getTime() && candEnd.getTime() === end.getTime()) {
      // skip original
    } else {
      candidates.push({
        start: new Date(candStart),
        end: new Date(candEnd),
        free: free
      });
    }

    current.setMinutes(current.getMinutes() + stepMinutes);
  }

  // Sort candidates: first by number of free constraints (venue, attendees, creator) descending
  // then by distance from original start (closer is better)
  candidates.sort((a, b) => {
    const aFreeCount = Object.values(a.free).filter(v => v).length;
    const bFreeCount = Object.values(b.free).filter(v => v).length;
    if (aFreeCount !== bFreeCount) return bFreeCount - aFreeCount;
    // closer to original start
    const aDist = Math.abs(a.start.getTime() - start.getTime());
    const bDist = Math.abs(b.start.getTime() - start.getTime());
    return aDist - bDist;
  });

  // Return top maxSlots
  return candidates.slice(0, maxSlots);
}

module.exports = router;