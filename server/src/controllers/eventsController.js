const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const {
  sequelize, Event, EventAttendee, EventCollaborator,
  Venue, Location, UserProfile, Department, Office, User
} = require('../models');

exports.createEvent = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      title, visibility, hierarchy, start_datetime, end_datetime,
      method, venue_id, map_location, department_id, description,
      color, attendee_ids, collaborator_ids, remind_before_minutes,
      is_email_reminder, event_type
    } = req.body;

    // Basic validation
    if (!title || !visibility || !hierarchy || !start_datetime || !end_datetime || !method || !description || !color) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'Missing required fields.' });
    }

    if (new Date(start_datetime) >= new Date(end_datetime)) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'End time must be after start time.' });
    }

    // Department event checks
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

    // Venue / Location logic
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

    // Create event
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

    // Creator as accepted attendee
    await EventAttendee.create({
      id: uuidv4(),
      event_id: event.id,
      user_id: req.userId,
      response: 'accepted'
    }, { transaction: t });

    // Attendees
    if (attendee_ids && attendee_ids.length > 0) {
      const unique = [...new Set(attendee_ids)].filter(id => id !== req.userId);
      if (unique.length > 0) {
        await EventAttendee.bulkCreate(
          unique.map(userId => ({ id: uuidv4(), event_id: event.id, user_id: userId, response: 'pending' })),
          { transaction: t }
        );
      }
    }

    // Collaborators
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
      event_type: ev.event_type,            // ← include event_type in response
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