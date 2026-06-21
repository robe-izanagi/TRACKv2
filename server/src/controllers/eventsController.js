const { v4: uuidv4 } = require('uuid');
const { sequelize, Event, EventAttendee, EventCollaborator, Venue, Location, UserProfile } = require('../models');

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
      venue_id,
      location_id,
      exact_location,
      street,
      map_location,
      department_id,
      description,
      color,
      attendee_ids,
      collaborator_ids,
      remind_before_minutes,
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

    // ── Department event checks ────────────────────────
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

    // ── Venue / Location logic (only if NOT online) ─────
    let finalVenueId = null;
    let finalLocationId = null;

    if (method !== 'online') {
      if (hierarchy === 'local') {
        // Local → venue
        if (venue_id && venue_id !== 'undecided') {
          const venue = await Venue.findByPk(venue_id);
          if (!venue) {
            await t.rollback();
            return res.status(404).json({ ok: false, message: 'Venue not found.' });
          }
          finalVenueId = venue.id;
        }
      } else {
        // External → location
        if (location_id) {
          // Use an existing saved location
          const loc = await Location.findByPk(location_id);
          if (!loc) {
            await t.rollback();
            return res.status(404).json({ ok: false, message: 'Location not found.' });
          }
          finalLocationId = loc.id;
        } else if (map_location) {
          // Create a new location from map‑provided address (exact_location & street are optional)
          const newLoc = await Location.create({
            id: uuidv4(),
            exact_location: exact_location?.trim() || '',
            street: street?.trim() || null,
            map_location: map_location.trim(),
            created_by: req.userId,
            is_active: true
          }, { transaction: t });
          finalLocationId = newLoc.id;
        } else {
          await t.rollback();
          return res.status(400).json({
            ok: false,
            message: 'Either location_id or map_location is required for external events.'
          });
        }
      }
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
      location_id: finalLocationId,
      department_id: finalDeptId,
      office_id: req.body.office_id || null,
      creator_id: req.userId,
      description,
      remind_before_minutes: remind_before_minutes || null,
      is_email_reminder: !!is_email_reminder,
      is_archived: false
    }, { transaction: t });

    // ── Creator as accepted attendee ────────────────
    await EventAttendee.create({
      id: uuidv4(),
      event_id: event.id,
      user_id: req.userId,
      response: 'accepted'
    }, { transaction: t });

    // ── Attendees ────────────────────────────────────
    if (attendee_ids && attendee_ids.length > 0) {
      const unique = [...new Set(attendee_ids)].filter(id => id !== req.userId);
      if (unique.length > 0) {
        await EventAttendee.bulkCreate(
          unique.map(userId => ({
            id: uuidv4(),
            event_id: event.id,
            user_id: userId,
            response: 'pending'
          })), { transaction: t });
      }
    }

    // ── Collaborators ────────────────────────────────
    if (collaborator_ids && collaborator_ids.length > 0) {
      const unique = [...new Set(collaborator_ids)];
      await EventCollaborator.bulkCreate(
        unique.map(userId => ({
          id: uuidv4(),
          event_id: event.id,
          user_id: userId,
          permission: 'edit'
        })), { transaction: t });
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
        location_id: event.location_id,
        department_id: event.department_id,
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

// List locations created by the current user (for reuse dropdown)
exports.listMyLocations = async (req, res) => {
  try {
    const locations = await Location.findAll({
      where: { created_by: req.userId, is_active: true },
      order: [['created_at', 'DESC']]
    });
    res.json({ ok: true, locations });
  } catch (error) {
    console.error('List my locations error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};