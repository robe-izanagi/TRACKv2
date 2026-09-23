const { v4: uuidv4 } = require('uuid');
const { Op } = require('sequelize');
const {
  sequelize, Event, EventAttendee, EventCollaborator,
  Venue, Location, UserProfile, Department, Office, User, Position,
  Attachment
} = require('../models');
const {
  queueEmail, buildInvitationEmail, buildCollaboratorEmail,
  buildReminderEmail, buildEventEditedEmail
} = require('../services/eventEmailTemplates');
const { buildConflictMap } = require('../services/conflictService');
const { createNotification } = require('../services/notificationService');
const { logVenueConflictAttempt } = require('../services/analyticsService');

const EMPTY_CONFLICT = { isConflicted: false, isPriority: false, conflictsWith: [], reason: null };

// ─── Timezone-safe "today" bounds (Asia/Manila, UTC+8) ───────────
const TZ_OFFSET_MINUTES = 8 * 60;

const getLocalDayBounds = (date = new Date()) => {
  const shifted = new Date(date.getTime() + TZ_OFFSET_MINUTES * 60000);
  const startOfDayShifted = new Date(Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    0, 0, 0, 0
  ));
  const endOfDayShifted = new Date(Date.UTC(
    shifted.getUTCFullYear(),
    shifted.getUTCMonth(),
    shifted.getUTCDate(),
    23, 59, 59, 999
  ));
  const startOfDay = new Date(startOfDayShifted.getTime() - TZ_OFFSET_MINUTES * 60000);
  const endOfDay = new Date(endOfDayShifted.getTime() - TZ_OFFSET_MINUTES * 60000);
  return { startOfDay, endOfDay };
};

const getUserContact = async (userId) => {
  const u = await User.findByPk(userId, { attributes: ['id', 'email'] });
  if (!u) return null;
  const profile = await UserProfile.findOne({ where: { user_id: userId } });
  return { email: u.email, full_name: profile?.full_name || u.email };
};

const getUserProfileSummary = async (userId) => {
  const user = await User.findByPk(userId, { attributes: ['id', 'username', 'email'] });
  if (!user) return null;
  const profile = await UserProfile.findOne({ where: { user_id: user.id } });
  let department = null, office = null, position = null, fullName = null;
  if (profile) {
    fullName = profile.full_name;
    if (profile.department_id) {
      const d = await Department.findByPk(profile.department_id);
      if (d) department = d.name;
    }
    if (profile.office_id) {
      const o = await Office.findByPk(profile.office_id);
      if (o) office = o.name;
    }
    if (profile.position_id) {
      const p = await Position.findByPk(profile.position_id);
      if (p) position = p.name;
    }
  }
  return {
    id: user.id,
    full_name: fullName || user.username || user.email,
    email: user.email,
    department,
    office,
    position
  };
};

const getVenueConflict = async (venueId, start, end, excludeEventId = null) => {
  if (!venueId) return null;
  const where = {
    venue_id: venueId,
    is_archived: false,
    start_datetime: { [Op.lt]: end },
    end_datetime: { [Op.gt]: start }
  };
  if (excludeEventId) where.id = { [Op.ne]: excludeEventId };

  const conflict = await Event.findOne({ where });
  if (!conflict) return null;

  let creatorName = null;
  if (conflict.creator_id) {
    const user = await User.findByPk(conflict.creator_id, { attributes: ['username', 'email'] });
    if (user) creatorName = user.username || user.email;
  }

  return {
    id: conflict.id,
    title: conflict.title,
    start_datetime: conflict.start_datetime,
    end_datetime: conflict.end_datetime,
    creatorName
  };
};

// ─── CREATE EVENT ──────────────────────────────────────
exports.createEvent = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const {
      title, visibility, hierarchy, start_datetime, end_datetime,
      method, venue_id, map_location, department_id, description,
      color, attendee_ids, collaborator_ids, remind_before_minutes,
      event_type
    } = req.body;

    if (!title || !visibility || !hierarchy || !start_datetime || !end_datetime || !method || !description || !color) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'Missing required fields.' });
    }

    const startDT = new Date(start_datetime);
    const endDT = new Date(end_datetime);

    if (startDT >= endDT) {
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

          const venueConflict = await getVenueConflict(finalVenueId, startDT, endDT);
          if (venueConflict) {
            await t.rollback();
            await logVenueConflictAttempt({
              venueId: finalVenueId, start: startDT, end: endDT,
              blockedByEventId: venueConflict.id, userId: req.userId
            });
            return res.status(409).json({
              ok: false,
              message: `Venue is already booked for this time by "${venueConflict.title}". Please choose a different venue, date, or time.`,
              venueConflict
            });
          }
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
      is_email_reminder: true,
      is_archived: false
    }, { transaction: t });

    await EventAttendee.create({
      id: uuidv4(),
      event_id: event.id,
      user_id: req.userId,
      response: 'accepted',
      is_original: true
    }, { transaction: t });

    const uniqueAttendeeIds = attendee_ids
      ? [...new Set(attendee_ids)].filter(id => id !== req.userId)
      : [];
    if (uniqueAttendeeIds.length > 0) {
      await EventAttendee.bulkCreate(
        uniqueAttendeeIds.map(userId => ({
          id: uuidv4(), event_id: event.id, user_id: userId,
          response: 'pending', is_original: true
        })),
        { transaction: t }
      );
    }

    const uniqueCollaboratorIds = collaborator_ids ? [...new Set(collaborator_ids)] : [];
    if (uniqueCollaboratorIds.length > 0) {
      await EventCollaborator.bulkCreate(
        uniqueCollaboratorIds.map(userId => ({ id: uuidv4(), event_id: event.id, user_id: userId, permission: 'edit' })),
        { transaction: t }
      );
    }

    await t.commit();

    // ─── Queue notification & reminder emails + in-app notifications (best-effort) ───
    try {
      const eventForEmail = {
        title: event.title,
        description: event.description,
        start_datetime: event.start_datetime,
        end_datetime: event.end_datetime,
        method: event.method,
        link: event.link
      };

      for (const userId of uniqueAttendeeIds) {
        const contact = await getUserContact(userId);
        if (contact?.email) {
          const { subject, body } = buildInvitationEmail(eventForEmail, contact.full_name);
          await queueEmail({
            recipient_email: contact.email, subject, body,
            event_id: event.id, entity_type: 'event', email_type: 'invitation'
          });
        }
        await createNotification({
          userId,
          type: 'event_invite',
          title: 'New Event Invitation',
          message: `You've been invited to "${event.title}"`,
          entityType: 'event',
          entityId: event.id
        });
      }

      for (const userId of uniqueCollaboratorIds) {
        const contact = await getUserContact(userId);
        if (contact?.email) {
          const { subject, body } = buildCollaboratorEmail(eventForEmail, contact.full_name);
          await queueEmail({
            recipient_email: contact.email, subject, body,
            event_id: event.id, entity_type: 'event', email_type: 'collaborator'
          });
        }
        await createNotification({
          userId,
          type: 'event_collaborator',
          title: 'Added as Collaborator',
          message: `You were added as a collaborator on "${event.title}"`,
          entityType: 'event',
          entityId: event.id
        });
      }

      if (remind_before_minutes) {
        const reminderTime = new Date(
          new Date(event.start_datetime).getTime() - Number(remind_before_minutes) * 60000
        );
        const recipientIds = [...new Set([req.userId, ...uniqueAttendeeIds, ...uniqueCollaboratorIds])];
        for (const userId of recipientIds) {
          const contact = await getUserContact(userId);
          if (!contact?.email) continue;
          const { subject, body } = buildReminderEmail(eventForEmail, contact.full_name);
          await queueEmail({
            recipient_email: contact.email, subject, body,
            scheduled_for: reminderTime,
            event_id: event.id, entity_type: 'event', email_type: 'reminder'
          });
        }
      }
    } catch (emailErr) {
      console.error('Failed to queue event emails/notifications:', emailErr);
    }

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

// ─── UPDATE EVENT ──────────────────────────────────────
exports.updateEvent = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const {
      title, visibility, hierarchy, start_datetime, end_datetime,
      method, venue_id, map_location, department_id, description,
      color, attendee_ids, collaborator_ids, remind_before_minutes,
      event_type, link
    } = req.body;

    const event = await Event.findByPk(id);
    if (!event) {
      await t.rollback();
      return res.status(404).json({ ok: false, message: 'Event not found.' });
    }

    const isCollaboratorEdit = event.creator_id !== req.userId;

    if (isCollaboratorEdit) {
      const collaborator = await EventCollaborator.findOne({
        where: { event_id: id, user_id: req.userId }
      });
      if (!collaborator) {
        await t.rollback();
        return res.status(403).json({ ok: false, message: 'You are not authorized to edit this event.' });
      }
    }

    if (!title || !visibility || !hierarchy || !start_datetime || !end_datetime || !method || !description || !color) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'Missing required fields.' });
    }

    const startDT = new Date(start_datetime);
    const endDT = new Date(end_datetime);

    if (startDT >= endDT) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'End time must be after start time.' });
    }

    let finalVisibility = visibility;
    let finalDeptId = null;

    if (isCollaboratorEdit) {
      finalVisibility = event.visibility;
      finalDeptId = event.department_id;
    } else {
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

          const venueConflict = await getVenueConflict(finalVenueId, startDT, endDT, id);
          if (venueConflict) {
            await t.rollback();
            await logVenueConflictAttempt({
              venueId: finalVenueId, start: startDT, end: endDT,
              blockedByEventId: venueConflict.id, userId: req.userId
            });
            return res.status(409).json({
              ok: false,
              message: `Venue is already booked for this time by "${venueConflict.title}". Please choose a different venue, date, or time.`,
              venueConflict
            });
          }
        }
      } else {
        if (map_location) {
          let existingLocation = await Location.findOne({
            where: { map_location: map_location.trim() }
          });
          if (!existingLocation) {
            existingLocation = await Location.create({
              id: uuidv4(),
              exact_location: '',
              street: null,
              map_location: map_location.trim(),
              created_by: req.userId,
              is_active: true
            }, { transaction: t });
          }
          finalLocationId = existingLocation.id;
        } else {
          await t.rollback();
          return res.status(400).json({ ok: false, message: 'map_location is required for external events.' });
        }
      }
    }

    await event.update({
      title,
      color,
      method,
      link: method === 'online' ? (link || null) : null,
      start_datetime,
      end_datetime,
      hierarchy,
      event_type: event_type || 'event',
      visibility: finalVisibility,
      venue_id: finalVenueId,
      location_id: finalLocationId,
      department_id: finalDeptId,
      office_id: req.body.office_id !== undefined ? req.body.office_id : event.office_id,
      description,
      remind_before_minutes: remind_before_minutes || null,
      is_email_reminder: true,
      updated_at: new Date()
    }, { transaction: t });

    const existingAttendees = await EventAttendee.findAll({
      where: { event_id: id, user_id: { [Op.ne]: req.userId } }
    });
    const existingMap = {};
    existingAttendees.forEach(a => {
      existingMap[a.user_id] = { response: a.response, is_original: a.is_original };
    });
    const originalIds = existingAttendees.filter(a => a.is_original).map(a => a.user_id);

    await EventAttendee.destroy({
      where: {
        event_id: id,
        user_id: { [Op.ne]: req.userId }
      },
      transaction: t
    });

    const submittedIds = (attendee_ids || [])
      .filter(uid => uid && uid !== req.userId && typeof uid === 'string' && uid.trim() !== '');

    const finalAttendeeIds = [...new Set([...submittedIds, ...originalIds])];

    const attendeeRecordsToCreate = finalAttendeeIds.map(userId => {
      const prior = existingMap[userId];
      return {
        id: uuidv4(),
        event_id: id,
        user_id: userId,
        response: prior ? prior.response : 'pending',
        is_original: prior ? prior.is_original : false
      };
    });

    if (attendeeRecordsToCreate.length > 0) {
      await EventAttendee.bulkCreate(attendeeRecordsToCreate, { transaction: t });
    }

    await EventCollaborator.destroy({
      where: { event_id: id },
      transaction: t
    });

    const validCollaboratorIds = (collaborator_ids || [])
      .filter(cid => cid && typeof cid === 'string' && cid.trim() !== '');

    if (validCollaboratorIds.length > 0) {
      const uniqueCollaborators = [...new Set(validCollaboratorIds)];
      await EventCollaborator.bulkCreate(
        uniqueCollaborators.map(userId => ({ id: uuidv4(), event_id: id, user_id: userId, permission: 'edit' })),
        { transaction: t }
      );
    }

    await t.commit();

    try {
      const eventForEmail = {
        title: event.title,
        description: event.description,
        start_datetime: event.start_datetime,
        end_datetime: event.end_datetime,
        method: event.method,
        link: event.link
      };

      for (const record of attendeeRecordsToCreate) {
        const wasExisting = !!existingMap[record.user_id];
        const contact = await getUserContact(record.user_id);

        if (wasExisting) {
          if (record.response === 'pending' || record.response === 'accepted') {
            if (contact?.email) {
              const { subject, body } = buildEventEditedEmail(eventForEmail, contact.full_name, record.response);
              await queueEmail({
                recipient_email: contact.email, subject, body,
                event_id: id, entity_type: 'event', email_type: 'edited'
              });
            }
            await createNotification({
              userId: record.user_id,
              type: 'event_update',
              title: 'Event Updated',
              message: `"${event.title}" has been updated`,
              entityType: 'event',
              entityId: id
            });
          }
        } else {
          if (contact?.email) {
            const { subject, body } = buildInvitationEmail(eventForEmail, contact.full_name);
            await queueEmail({
              recipient_email: contact.email, subject, body,
              event_id: id, entity_type: 'event', email_type: 'invitation'
            });
          }
          await createNotification({
            userId: record.user_id,
            type: 'event_invite',
            title: 'New Event Invitation',
            message: `You've been invited to "${event.title}"`,
            entityType: 'event',
            entityId: id
          });
        }
      }
    } catch (emailErr) {
      console.error('Failed to queue update emails/notifications:', emailErr);
    }

    res.json({
      ok: true,
      message: 'Event updated successfully.',
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
        event_type: event.event_type
      }
    });
  } catch (error) {
    await t.rollback();
    console.error('Update event error:', error);
    res.status(500).json({ ok: false, message: error.message || 'Server error.' });
  }
};

// ─── GET EVENT BY ID ──────────────────────────────────
exports.getEventById = async (req, res) => {
  try {
    const { id } = req.params;

    const event = await Event.findByPk(id);
    if (!event) {
      return res.status(404).json({ ok: false, message: 'Event not found.' });
    }

    let venueName = null;
    if (event.venue_id) {
      const venue = await Venue.findByPk(event.venue_id, { attributes: ['name'] });
      if (venue) venueName = venue.name;
    }

    let locationMapValue = null;
    if (event.location_id) {
      const location = await Location.findByPk(event.location_id, { attributes: ['map_location'] });
      if (location) locationMapValue = location.map_location;
    }

    let creatorData = null;
    if (event.creator_id) {
      const creatorUser = await User.findByPk(event.creator_id, { attributes: ['id', 'username', 'email'] });
      if (creatorUser) {
        const profile = await UserProfile.findOne({ where: { user_id: creatorUser.id } });
        let position = null, department = null, office = null, fullName = null;
        if (profile) {
          fullName = profile.full_name;
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
          id: creatorUser.id,
          username: creatorUser.username || fullName || creatorUser.email || 'Unknown',
          email: creatorUser.email,
          full_name: fullName || creatorUser.username || creatorUser.email,
          position,
          department,
          office
        };
      }
    }

    const attendees = await EventAttendee.findAll({
      where: { event_id: event.id }
    });

    const departmentSet = new Set();
    const officeSet = new Set();
    const usersList = [];

    for (const attendee of attendees) {
      const user = await User.findByPk(attendee.user_id, { attributes: ['id', 'username', 'email'] });
      if (!user) continue;

      const profile = await UserProfile.findOne({ where: { user_id: user.id } });
      let deptName = null, officeName = null, positionName = null, fullName = null;

      if (profile) {
        fullName = profile.full_name;
        if (profile.department_id) {
          const dept = await Department.findByPk(profile.department_id);
          if (dept) { deptName = dept.name; departmentSet.add(deptName); }
        }
        if (profile.office_id) {
          const off = await Office.findByPk(profile.office_id);
          if (off) { officeName = off.name; officeSet.add(officeName); }
        }
        if (profile.position_id) {
          const pos = await Position.findByPk(profile.position_id);
          if (pos) positionName = pos.name;
        }
      }

      usersList.push({
        id: user.id,
        username: user.username || fullName || user.email || 'Unknown',
        email: user.email,
        full_name: fullName || user.username || user.email,
        department: deptName,
        office: officeName,
        position: positionName,
        response: attendee.response,
        is_original: !!attendee.is_original
      });
    }

    const collaborators = await EventCollaborator.findAll({
      where: { event_id: event.id },
      attributes: ['user_id']
    });
    const collaboratorIds = collaborators.map(c => c.user_id);

    let viewerResponse = null;
    const viewerAttendee = await EventAttendee.findOne({
      where: { event_id: event.id, user_id: req.userId }
    });
    if (viewerAttendee) viewerResponse = viewerAttendee.response;

    const attachmentRecords = await Attachment.findAll({
      where: { entity_type: 'event', entity_id: event.id },
      attributes: ['id', 'file_name', 'file_url', 'file_size']
    });

    const conflictMap = await buildConflictMap(req.userId);
    const conflict = conflictMap[event.id] || EMPTY_CONFLICT;

    const formatted = {
      id: event.id,
      title: event.title,
      description: event.description,
      start_datetime: event.start_datetime,
      end_datetime: event.end_datetime,
      method: event.method,
      link: event.link,
      hierarchy: event.hierarchy,
      event_type: event.event_type,
      visibility: event.visibility,
      color: event.color,
      venue: venueName,
      location: locationMapValue,
      map_location: locationMapValue,
      venue_id: event.venue_id,
      location_id: event.location_id,
      department_id: event.department_id,
      office_id: event.office_id,
      remind_before_minutes: event.remind_before_minutes,
      is_email_reminder: event.is_email_reminder,
      creator: creatorData,
      attendees: usersList,
      collaborators: collaboratorIds,
      isCreator: event.creator_id === req.userId,
      isCollaborator: collaboratorIds.includes(req.userId),
      viewerResponse,
      attachments: attachmentRecords.map(a => ({
        id: a.id, file_name: a.file_name, file_url: a.file_url, file_size: a.file_size
      })),
      conflict,
      participants: {
        departments: Array.from(departmentSet),
        offices: Array.from(officeSet),
        users: usersList
      }
    };

    res.json({ ok: true, event: formatted });
  } catch (error) {
    console.error('Get event by id error:', error);
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

    const attendeeEvents = await EventAttendee.findAll({
      where: { user_id: req.userId },
      attributes: ['event_id']
    });
    const myEventIds = attendeeEvents.map(a => a.event_id);

    const events = await Event.findAll({
      where: {
        is_archived: false,
        [Op.or]: [
          { creator_id: req.userId },
          { id: { [Op.in]: myEventIds } }
        ],
        start_datetime: { [Op.lte]: new Date(`${end}T23:59:59`) },
        end_datetime: { [Op.gte]: new Date(`${start}T00:00:00`) }
      },
      order: [['start_datetime', 'ASC']]
    });

    const eventIds = events.map(e => e.id);
    const myAttendances = await EventAttendee.findAll({
      where: { user_id: req.userId, event_id: { [Op.in]: eventIds } }
    });
    const myResponseMap = {};
    myAttendances.forEach(a => { myResponseMap[a.event_id] = a.response; });

    const conflictMap = await buildConflictMap(req.userId);

    const result = [];
    for (const ev of events) {
      let venueName = null;
      let locationName = null;

      if (ev.venue_id) {
        const venue = await Venue.findByPk(ev.venue_id, { attributes: ['name'] });
        if (venue) venueName = venue.name;
      }

      if (ev.location_id) {
        const location = await Location.findByPk(ev.location_id, { attributes: ['map_location'] });
        if (location) locationName = location.map_location;
      }

      const creatorObj = ev.creator_id ? await getUserProfileSummary(ev.creator_id) : null;

      let locationDisplay = null;
      if (ev.method === 'online') {
        locationDisplay = 'Online';
      } else if (venueName) {
        locationDisplay = venueName;
      } else if (locationName) {
        locationDisplay = locationName;
      }

      result.push({
        id: ev.id,
        title: ev.title,
        description: ev.description,
        date: ev.start_datetime.toISOString().slice(0, 10),
        time: ev.start_datetime.toTimeString().slice(0, 5),
        endTime: ev.end_datetime.toTimeString().slice(0, 5),
        start_datetime: ev.start_datetime,
        end_datetime: ev.end_datetime,
        type: ev.visibility,
        hierarchy: ev.hierarchy,
        event_type: ev.event_type,
        color: ev.color,
        method: ev.method,
        link: ev.link,
        venue: venueName,
        location: locationName,
        locationDisplay: locationDisplay,
        creator: creatorObj,
        creatorId: ev.creator_id,
        userResponse: myResponseMap[ev.id] || null,
        conflict: conflictMap[ev.id] || EMPTY_CONFLICT,
      });
    }

    res.json({ ok: true, events: result });
  } catch (error) {
    console.error('List events error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

exports.getEventStats = async (req, res) => {
  try {
    const { type = 'campus' } = req.query;
    const userId = req.userId;

    const now = new Date();

    let visibilityCondition;
    if (type === 'all') {
      const attendeeEvents = await EventAttendee.findAll({
        where: { user_id: userId },
        attributes: ['event_id']
      });
      const eventIds = attendeeEvents.map(a => a.event_id);
      visibilityCondition = {
        [Op.or]: [
          { creator_id: userId },
          { id: { [Op.in]: eventIds } }
        ]
      };
    } else if (type === 'campus') {
      visibilityCondition = { visibility: 'campus' };
    } else if (type === 'department') {
      const profile = await UserProfile.findOne({ where: { user_id: userId } });
      if (!profile || !profile.department_id) {
        return res.json({ ok: true, stats: { total: 0, active_events: 0, accepted: 0, declined: 0, missed: 0, pending: 0, conflicted: 0 } });
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

    const events = await Event.findAll({
      where: {
        is_archived: false,
        ...visibilityCondition
      }
    });

    const eventIds2 = events.map(e => e.id);
    const attendances = await EventAttendee.findAll({
      where: { user_id: userId, event_id: { [Op.in]: eventIds2 } }
    });
    const attendanceMap = {};
    attendances.forEach(a => { attendanceMap[a.event_id] = a.response; });

    const conflictMap = await buildConflictMap(userId);

    const total = events.length;
    let activeEvents = 0, accepted = 0, declined = 0, pending = 0, missed = 0, conflicted = 0;

    for (const ev of events) {
      const response = attendanceMap[ev.id] || 'pending';
      const isActive = new Date(ev.end_datetime) >= now; // ongoing OR upcoming

      if (isActive) {
        activeEvents++;
        if (response === 'accepted') accepted++;
        else if (response === 'declined') declined++;
        else pending++;

        const conflict = conflictMap[ev.id];
        if (conflict && conflict.isConflicted) conflicted++;
      } else {
        // Event has already ended — only counts as "missed" if the
        // viewer never responded accepted/declined to it.
        if (response !== 'accepted' && response !== 'declined') missed++;
      }
    }

    res.json({
      ok: true,
      stats: {
        total,
        active_events: activeEvents,
        accepted,
        declined,
        missed,
        pending,
        conflicted
      }
    });
  } catch (error) {
    console.error('Get event stats error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── GET TODAY'S EVENTS ─────────────
exports.getTodayEvent = async (req, res) => {
  try {
    const userId = req.userId;
    const { startOfDay, endOfDay } = getLocalDayBounds();

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
        start_datetime: { [Op.lte]: endOfDay },
        end_datetime: { [Op.gte]: startOfDay }
      },
      order: [['start_datetime', 'ASC']]
    });

    if (!events || events.length === 0) {
      return res.json({ ok: true, events: [] });
    }

    const conflictMap = await buildConflictMap(userId);

    const formattedEvents = [];

    for (const event of events) {
      let venueName = null;
      if (event.venue_id) {
        const venue = await Venue.findByPk(event.venue_id, { attributes: ['name'] });
        if (venue) venueName = venue.name;
      }

      let locationName = null;
      if (event.location_id) {
        const location = await Location.findByPk(event.location_id, { attributes: ['map_location'] });
        if (location) locationName = location.map_location;
      }

      let creatorData = null;
      if (event.creator_id) {
        const creatorUser = await User.findByPk(event.creator_id, { attributes: ['id', 'username', 'email'] });
        if (creatorUser) {
          const profile = await UserProfile.findOne({ where: { user_id: creatorUser.id } });
          let position = null, department = null, office = null, fullName = null;
          if (profile) {
            fullName = profile.full_name;
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
            username: creatorUser.username || fullName || creatorUser.email || 'Unknown',
            email: creatorUser.email,
            full_name: fullName || creatorUser.username || creatorUser.email,
            position,
            department,
            office
          };
        }
      }

      const attendees = await EventAttendee.findAll({
        where: { event_id: event.id }
      });

      const departmentSet = new Set();
      const officeSet = new Set();
      const usersList = [];

      for (const attendee of attendees) {
        const user = await User.findByPk(attendee.user_id, { attributes: ['id', 'username', 'email'] });
        if (!user) continue;

        const profile = await UserProfile.findOne({ where: { user_id: user.id } });
        let deptName = null, officeName = null, positionName = null, fullName = null;

        if (profile) {
          fullName = profile.full_name;
          if (profile.department_id) {
            const dept = await Department.findByPk(profile.department_id);
            if (dept) { deptName = dept.name; departmentSet.add(deptName); }
          }
          if (profile.office_id) {
            const off = await Office.findByPk(profile.office_id);
            if (off) { officeName = off.name; officeSet.add(officeName); }
          }
          if (profile.position_id) {
            const pos = await Position.findByPk(profile.position_id);
            if (pos) positionName = pos.name;
          }
        }

        usersList.push({
          id: user.id,
          username: user.username || fullName || user.email || 'Unknown',
          email: user.email,
          full_name: fullName || user.username || user.email,
          department: deptName,
          office: officeName,
          position: positionName,
          response: attendee.response
        });
      }

      formattedEvents.push({
        id: event.id,
        title: event.title,
        description: event.description,
        start_datetime: event.start_datetime,
        end_datetime: event.end_datetime,
        method: event.method,
        link: event.link,
        hierarchy: event.hierarchy,
        event_type: event.event_type,
        visibility: event.visibility,
        venue: venueName,
        location: locationName,
        creator: creatorData,
        conflict: conflictMap[event.id] || EMPTY_CONFLICT,
        participants: {
          departments: Array.from(departmentSet),
          offices: Array.from(officeSet),
          users: usersList
        }
      });
    }

    res.json({ ok: true, events: formattedEvents });
  } catch (error) {
    console.error('Get today events error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── GET UPCOMING EVENTS ──────────────────────────────
exports.getUpcomingEvents = async (req, res) => {
  try {
    const userId = req.userId;
    const { limit = 4, offset = 0 } = req.query;
    const { endOfDay: todayEnd } = getLocalDayBounds();
    const now = new Date(todayEnd.getTime() + 1);

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
      link: ev.link,
      creator: ev.user ? { username: ev.user.username } : null
    }));

    res.json({ ok: true, events: formatted });
  } catch (error) {
    console.error('Get upcoming events error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── GET COLLABORATION EVENTS ──────────────────────────
exports.getCollaborationEvents = async (req, res) => {
  try {
    const userId = req.userId;

    const collaborations = await EventCollaborator.findAll({
      where: { user_id: userId },
      attributes: ['event_id']
    });
    const eventIds = collaborations.map(c => c.event_id);

    if (eventIds.length === 0) {
      return res.json({ ok: true, events: [] });
    }

    const events = await Event.findAll({
      where: {
        id: { [Op.in]: eventIds },
        is_archived: false
      },
      order: [['start_datetime', 'ASC']]
    });

    const conflictMap = await buildConflictMap(userId);

    const result = [];
    for (const ev of events) {
      let venueName = null;
      let locationName = null;

      if (ev.venue_id) {
        const venue = await Venue.findByPk(ev.venue_id, { attributes: ['name'] });
        if (venue) venueName = venue.name;
      }
      if (ev.location_id) {
        const location = await Location.findByPk(ev.location_id, { attributes: ['map_location'] });
        if (location) locationName = location.map_location;
      }

      const creatorObj = ev.creator_id ? await getUserProfileSummary(ev.creator_id) : null;

      let locationDisplay = null;
      if (ev.method === 'online') {
        locationDisplay = 'Online';
      } else if (venueName) {
        locationDisplay = venueName;
      } else if (locationName) {
        locationDisplay = locationName;
      }

      result.push({
        id: ev.id,
        title: ev.title,
        description: ev.description,
        date: ev.start_datetime.toISOString().slice(0, 10),
        time: ev.start_datetime.toTimeString().slice(0, 5),
        endTime: ev.end_datetime.toTimeString().slice(0, 5),
        start_datetime: ev.start_datetime,
        end_datetime: ev.end_datetime,
        type: ev.visibility,
        hierarchy: ev.hierarchy,
        event_type: ev.event_type,
        color: ev.color,
        method: ev.method,
        link: ev.link,
        venue: venueName,
        location: locationName,
        locationDisplay: locationDisplay,
        creator: creatorObj,
        creatorId: ev.creator_id,
        conflict: conflictMap[ev.id] || EMPTY_CONFLICT,
      });
    }

    res.json({ ok: true, events: result });
  } catch (error) {
    console.error('Get collaboration events error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};