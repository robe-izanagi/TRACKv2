const { v4: uuidv4 } = require('uuid');
const { sequelize, Event, EventAttendee, EventCollaborator, Venue } = require('../models');

exports.createEvent = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      title,
      visibility,
      hierarchy,
      start_datetime,
      end_datetime,
      method,
      venue_id,            // can be "undecided" -> null
      description,
      color,
      attendee_ids,        // array of user UUIDs (can be empty)
      collaborator_ids,    // array of user UUIDs (can be empty)
      remind_before_minutes, // null = "none"
      is_email_reminder
    } = req.body;

    // ── Basic validation ────────────────────────────────
    if (!title || !visibility || !hierarchy || !start_datetime || !end_datetime || !method || !description || !color) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'Missing required fields.' });
    }

    if (new Date(start_datetime) >= new Date(end_datetime)) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'End time must be after start time.' });
    }

    // ── Venue handling ──────────────────────────────────
    let finalVenueId = null;
    if (venue_id && venue_id !== 'undecided') {
      const venue = await Venue.findByPk(venue_id);
      if (!venue) {
        await t.rollback();
        return res.status(404).json({ ok: false, message: 'Venue not found.' });
      }
      finalVenueId = venue.id;
    }

    // ── Create event ────────────────────────────────────
    const event = await Event.create({
      id: uuidv4(),
      title,
      color,
      method,
      link: method === 'online' ? req.body.link || null : null,
      start_datetime,
      end_datetime,
      hierarchy,
      visibility,
      venue_id: finalVenueId,
      department_id: req.body.department_id || null,
      office_id: req.body.office_id || null,
      creator_id: req.userId,                     // from auth middleware
      description,
      remind_before_minutes: remind_before_minutes || null,
      is_email_reminder: !!is_email_reminder,
      is_archived: false
    }, { transaction: t });

    // ── Add creator as accepted attendee ────────────────
    await EventAttendee.create({
      id: uuidv4(),
      event_id: event.id,
      user_id: req.userId,
      response: 'accepted'
    }, { transaction: t });

    // ── Add invited attendees ──────────────────────────
    if (attendee_ids && attendee_ids.length > 0) {
      const uniqueAttendees = [...new Set(attendee_ids)].filter(id => id !== req.userId);
      if (uniqueAttendees.length > 0) {
        const attendeeRecords = uniqueAttendees.map(userId => ({
          id: uuidv4(),
          event_id: event.id,
          user_id: userId,
          response: 'pending'
        }));
        await EventAttendee.bulkCreate(attendeeRecords, { transaction: t });
      }
    }

    // ── Add collaborators ──────────────────────────────
    if (collaborator_ids && collaborator_ids.length > 0) {
      const uniqueCollabs = [...new Set(collaborator_ids)];
      const collabRecords = uniqueCollabs.map(userId => ({
        id: uuidv4(),
        event_id: event.id,
        user_id: userId,
        permission: 'edit'
      }));
      await EventCollaborator.bulkCreate(collabRecords, { transaction: t });
    }

    await t.commit();

    res.status(201).json({
      ok: true,
      event: {
        id: event.id,
        title: event.title,
        visibility: event.visibility,
        start_datetime: event.start_datetime,
        end_datetime: event.end_datetime,
        venue_id: event.venue_id,
        creator_id: event.creator_id,
        created_at: event.created_at
      }
    });

  } catch (error) {
    await t.rollback();
    console.error('Create event error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};