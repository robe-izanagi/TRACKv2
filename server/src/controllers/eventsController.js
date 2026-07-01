const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const {
  sequelize, Event, EventAttendee, EventCollaborator,
  Venue, Location, UserProfile, Department, Office, User, Position
} = require('../models');

// ─── CREATE EVENT ──────────────────────────────────────
exports.createEvent = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      title, visibility, hierarchy, start_datetime, end_datetime,
      method, venue_id, map_location, department_id, description,
      color, attendee_ids, collaborator_ids, remind_before_minutes,
      is_email_reminder, event_type
    } = req.body;

    if (!title || !visibility || !hierarchy || !start_datetime || !end_datetime || !method || !description || !color) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'Missing required fields.' });
    }

    if (new Date(start_datetime) >= new Date(end_datetime)) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'End time must be after start time.' });
    }

    let finalDeptId = null;
    if (visibility === 'department') {
      if (!department_id) {
        await t.rollback();
        return res.status(400).json({ ok: false, message: 'department_id is required for department events.' });
      }
      const profile = await UserProfile.findOne({ where: { user_id: req.userId } });
      if (!profile || profile.department_id !== department_id) {
        await t.rollback();
        return res.status(403).json({ ok: false, message: 'You can only create department events for your own department.' });
      }
      finalDeptId = department_id;
    }

    let finalVenueId = null;
    let finalLocationId = null;

    if (method !== 'online') {
      if (hierarchy === 'local') {
        if (venue_id && venue_id !== 'undecided') {
          const venue = await Venue.findByPk(venue_id);
          if (!venue) {
            await t.rollback();
            return res.status(404).json({ ok: false, message: 'Venue not found.' });
          }
          finalVenueId = venue.id;
        }
      } else {
        if (map_location) {
          const newLoc = await Location.create({
            id: uuidv4(),
            exact_location: '',
            street: null,
            map_location: map_location.trim(),
            created_by: req.userId,
            is_active: true
          }, { transaction: t });
          finalLocationId = newLoc.id;
        } else {
          await t.rollback();
          return res.status(400).json({ ok: false, message: 'map_location is required for external events.' });
        }
      }
    }

    const event = await Event.create({
      id: uuidv4(),
      title, color, method,
      link: method === 'online' ? req.body.link || null : null,
      start_datetime, end_datetime,
      hierarchy,
      event_type: event_type || 'event',
      visibility,
      venue_id: finalVenueId,
      location_id: finalLocationId,
      department_id: finalDeptId,
      office_id: req.body.office_id || null,
      creator_id: req.userId,
      description,
      remind_before_minutes: remind_before_minutes || null,
      is_email_reminder: !!is_email_reminder,
      is_archived: false
    }, { transaction: t });

    await EventAttendee.create({
      id: uuidv4(),
      event_id: event.id,
      user_id: req.userId,
      response: 'accepted'
    }, { transaction: t });

    if (attendee_ids && attendee_ids.length > 0) {
      const unique = [...new Set(attendee_ids)].filter(id => id !== req.userId);
      if (unique.length > 0) {
        await EventAttendee.bulkCreate(
          unique.map(userId => ({ id: uuidv4(), event_id: event.id, user_id: userId, response: 'pending' })),
          { transaction: t }
        );
      }
    }

    if (collaborator_ids && collaborator_ids.length > 0) {
      const unique = [...new Set(collaborator_ids)];
      await EventCollaborator.bulkCreate(
        unique.map(userId => ({ id: uuidv4(), event_id: event.id, user_id: userId, permission: 'edit' })),
        { transaction: t }
      );
    }

    await t.commit();

    res.status(201).json({
      ok: true,
      event: {
        id: event.id, title: event.title, visibility: event.visibility,
        start_datetime: event.start_datetime, end_datetime: event.end_datetime,
        venue_id: event.venue_id, location_id: event.location_id,
        department_id: event.department_id, creator_id: event.creator_id,
        created_at: event.created_at, event_type: event.event_type
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('Create event error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── LIST EVENTS ──────────────────────────────────────
exports.listEvents = async (req, res) => {
  try {
    const { start, end } = req.query;
    if (!start || !end) {
      return res.status(400).json({ ok: false, message: 'start and end dates are required (YYYY-MM-DD).' });
    }

    const events = await Event.findAll({
      where: {
        is_archived: false,
        start_datetime: { [Op.lte]: new Date(`${end}T23:59:59`) },
        end_datetime: { [Op.gte]: new Date(`${start}T00:00:00`) }
      },
      include: [
        { model: Venue, attributes: ['id', 'name'] },
        { model: Location, attributes: ['id', 'map_location'] },
        { model: Department, attributes: ['id', 'name'] },
        { model: Office, attributes: ['id', 'name'] },
        { model: User, attributes: ['id', 'username', 'email'] },
      ],
      order: [['start_datetime', 'ASC']]
    });

    const result = events.map(ev => ({
      id: ev.id,
      title: ev.title,
      date: ev.start_datetime.toISOString().slice(0, 10),
      time: ev.start_datetime.toTimeString().slice(0, 5),
      endTime: ev.end_datetime.toTimeString().slice(0, 5),
      type: ev.visibility,
      hierarchy: ev.hierarchy,
      event_type: ev.event_type,
      color: ev.color,
      description: ev.description,
      location: ev.Venue ? ev.Venue.name : (ev.Location ? ev.Location.map_location : null),
      creatorName: ev.User ? ev.User.username : null,
    }));

    res.json({ ok: true, events: result });
  } catch (error) {
    console.error('List events error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── GET EVENT STATISTICS ──────────────────────────────
exports.getEventStats = async (req, res) => {
  try {
    const { type = 'campus', range = 'week' } = req.query;
    const userId = req.userId;

    const now = new Date();
    let startDate;
    if (range === 'week') {
      startDate = new Date(now);
      startDate.setDate(now.getDate() - 7);
    } else if (range === 'month') {
      startDate = new Date(now);
      startDate.setMonth(now.getMonth() - 1);
    } else {
      startDate = new Date(0);
    }

    let visibilityCondition;
    if (type === 'campus') {
      visibilityCondition = { visibility: 'campus' };
    } else if (type === 'department') {
      const profile = await UserProfile.findOne({ where: { user_id: userId } });
      if (!profile || !profile.department_id) {
        return res.json({ ok: true, stats: { total: 0, accepted: 0, declined: 0, missed: 0, pending: 0, conflicted: 0 } });
      }
      visibilityCondition = { visibility: 'department', department_id: profile.department_id };
    } else if (type === 'private') {
      const attendeeEvents = await EventAttendee.findAll({
        where: { user_id: userId },
        attributes: ['event_id']
      });
      const eventIds = attendeeEvents.map(a => a.event_id);
      visibilityCondition = {
        [Op.or]: [
          { visibility: 'private', creator_id: userId },
          { visibility: 'private', id: { [Op.in]: eventIds } }
        ]
      };
    } else {
      return res.status(400).json({ ok: false, message: 'Invalid type' });
    }

    const where = {
      is_archived: false,
      start_datetime: { [Op.gte]: startDate },
      end_datetime: { [Op.lte]: now },
      ...visibilityCondition
    };

    const events = await Event.findAll({ where });
    const eventIds = events.map(e => e.id);
    const attendances = await EventAttendee.findAll({
      where: { user_id: userId, event_id: { [Op.in]: eventIds } }
    });
    const attendanceMap = {};
    attendances.forEach(a => { attendanceMap[a.event_id] = a.response; });

    let total = events.length;
    let accepted = 0, declined = 0, pending = 0, missed = 0, conflicted = 0;

    for (const ev of events) {
      const response = attendanceMap[ev.id] || 'pending';
      if (response === 'accepted') accepted++;
      else if (response === 'declined') declined++;
      else if (response === 'pending') pending++;
      if (ev.end_datetime < now && response !== 'accepted' && response !== 'declined') missed++;
    }

    res.json({
      ok: true,
      stats: { total, accepted, declined, missed, pending, conflicted: 0 }
    });
  } catch (error) {
    console.error('Get event stats error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── GET TODAY'S EVENT (WITH PARTICIPANTS) ─────────────
// ─── GET TODAY'S EVENT (MANUAL FETCH – NO ASSOCIATIONS) ──
exports.getTodayEvent = async (req, res) => {
  try {
    const userId = req.userId;
    const today = new Date();
    const startOfDay = new Date(today);
    startOfDay.setHours(0, 0, 0, 0);
    const endOfDay = new Date(today);
    endOfDay.setHours(23, 59, 59, 999);

    // Get events the user is invited to or created
    const attendeeEvents = await EventAttendee.findAll({
      where: { user_id: userId },
      attributes: ['event_id']
    });
    const eventIds = attendeeEvents.map(a => a.event_id);

    // Find the event – using raw query to avoid association issues
    const event = await Event.findOne({
      where: {
        is_archived: false,
        [Op.or]: [
          { creator_id: userId },
          { id: { [Op.in]: eventIds } }
        ],
        start_datetime: { [Op.between]: [startOfDay, endOfDay] }
      },
      order: [['start_datetime', 'ASC']]
    });

    if (!event) {
      return res.json({ ok: true, event: null });
    }

    // ── 1. GET VENUE ──
    let venueName = null;
    if (event.venue_id) {
      const venue = await Venue.findByPk(event.venue_id, {
        attributes: ['name']
      });
      if (venue) venueName = venue.name;
    }

    // ── 2. GET LOCATION ──
    let locationName = null;
    if (event.location_id) {
      const location = await Location.findByPk(event.location_id, {
        attributes: ['map_location']
      });
      if (location) locationName = location.map_location;
    }

    // ── 3. GET CREATOR PROFILE ──
    let creatorData = null;
    if (event.creator_id) {
      const creatorUser = await User.findByPk(event.creator_id, {
        attributes: ['id', 'username', 'email']
      });
      if (creatorUser) {
        const profile = await UserProfile.findOne({
          where: { user_id: creatorUser.id }
        });
        let position = null, department = null, office = null;
        if (profile) {
          if (profile.position_id) {
            const pos = await Position.findByPk(profile.position_id);
            if (pos) position = pos.name;
          }
          if (profile.department_id) {
            const dept = await Department.findByPk(profile.department_id);
            if (dept) department = dept.name;
          }
          if (profile.office_id) {
            const off = await Office.findByPk(profile.office_id);
            if (off) office = off.name;
          }
        }
        creatorData = {
          username: creatorUser.username || 'Unknown',
          email: creatorUser.email,
          position,
          department,
          office
        };
      }
    }

    // ── 4. GET ALL ATTENDEES ──
    const attendees = await EventAttendee.findAll({
      where: { event_id: event.id }
    });

    const departmentSet = new Set();
    const officeSet = new Set();
    const usersList = [];

    for (const attendee of attendees) {
      // Get user
      const user = await User.findByPk(attendee.user_id, {
        attributes: ['id', 'username', 'email']
      });
      if (!user) continue;

      // Get user profile
      const profile = await UserProfile.findOne({
        where: { user_id: user.id }
      });

      let deptName = null, officeName = null, positionName = null, fullName = null;

      if (profile) {
        fullName = profile.full_name;
        if (profile.department_id) {
          const dept = await Department.findByPk(profile.department_id);
          if (dept) {
            deptName = dept.name;
            departmentSet.add(deptName);
          }
        }
        if (profile.office_id) {
          const off = await Office.findByPk(profile.office_id);
          if (off) {
            officeName = off.name;
            officeSet.add(officeName);
          }
        }
        if (profile.position_id) {
          const pos = await Position.findByPk(profile.position_id);
          if (pos) positionName = pos.name;
        }
      }

      usersList.push({
        id: user.id,
        username: user.username || 'Unknown',
        email: user.email,
        full_name: fullName || user.username || user.email,
        department: deptName,
        office: officeName,
        position: positionName,
        response: attendee.response
      });
    }

    // ── BUILD RESPONSE ──
    const formatted = {
      id: event.id,
      title: event.title,
      description: event.description,
      start_datetime: event.start_datetime,
      end_datetime: event.end_datetime,
      method: event.method,
      hierarchy: event.hierarchy,
      event_type: event.event_type,
      venue: venueName,
      location: locationName,
      creator: creatorData,
      participants: {
        departments: Array.from(departmentSet),
        offices: Array.from(officeSet),
        users: usersList
      }
    };

    res.json({ ok: true, event: formatted });
  } catch (error) {
    console.error('Get today event error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── GET UPCOMING EVENTS ──────────────────────────────
exports.getUpcomingEvents = async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 4, offset = 0 } = req.query;
    const now = new Date();

    const attendeeEvents = await EventAttendee.findAll({
      where: { user_id: userId },
      attributes: ['event_id']
    });
    const eventIds = attendeeEvents.map(a => a.event_id);

    const events = await Event.findAll({
      where: {
        is_archived: false,
        [Op.or]: [
          { creator_id: userId },
          { id: { [Op.in]: eventIds } }
        ],
        start_datetime: { [Op.gte]: now }
      },
      include: [
        { model: Venue, attributes: ['name'] },
        { model: Location, attributes: ['map_location'] },
        { model: User, as: 'user', attributes: ['username'] }
      ],
      order: [['start_datetime', 'ASC']],
      limit: parseInt(limit),
      offset: parseInt(offset)
    });

    const formatted = events.map(ev => ({
      id: ev.id,
      title: ev.title,
      description: ev.description,
      start_datetime: ev.start_datetime,
      end_datetime: ev.end_datetime,
      venue: ev.Venue ? ev.Venue.name : null,
      location: ev.Location ? ev.Location.map_location : null,
      event_type: ev.event_type,
      hierarchy: ev.hierarchy,
      method: ev.method,
      creator: ev.user ? { username: ev.user.username } : null
    }));

    res.json({ ok: true, events: formatted });
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};