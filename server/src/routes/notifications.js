const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  Event, EventAttendee, EventCollaborator, Venue, Location,
  User, UserProfile, Department, Office, Position,
  Attachment, Notification
} = require('../models');
const { createNotification } = require('../services/notificationService');
const { cancelUserReminder, uniqueIds } = require('../services/notificationRecipients');
const { queueEmail, buildReminderEmail } = require('../services/eventEmailTemplates');

// ─── Event invitation listing (existing) ───────────────
router.get('/invitations', authenticate, async (req, res) => {
  try {
    const { response, type } = req.query;

    const whereAttendee = { user_id: req.userId };
    if (response === 'all') {
      // no filter
    } else if (response && ['pending', 'accepted', 'declined'].includes(response)) {
      whereAttendee.response = response;
    } else {
      whereAttendee.response = 'pending';
    }

    const attendeeRecords = await EventAttendee.findAll({ where: whereAttendee });

    const events = [];
    for (const record of attendeeRecords) {
      const ev = await Event.findByPk(record.event_id);
      if (!ev || ev.is_archived || ev.is_deleted) continue;
      if (type && ['campus', 'department', 'private'].includes(type)) {
        if (ev.visibility !== type) continue;
      }

      let venueName = null;
      if (ev.venue_id) {
        const venue = await Venue.findByPk(ev.venue_id, { attributes: ['name'] });
        if (venue) venueName = venue.name;
      }
      let locationName = null;
      if (ev.location_id) {
        const location = await Location.findByPk(ev.location_id, { attributes: ['map_location'] });
        if (location) locationName = location.map_location;
      }

      let creatorData = null;
      if (ev.creator_id) {
        const creatorUser = await User.findByPk(ev.creator_id, { attributes: ['id', 'username', 'email'] });
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
            position, department, office
          };
        }
      }

      const attachments = await Attachment.findAll({
        where: { entity_type: 'event', entity_id: ev.id },
        attributes: ['id', 'file_name', 'file_url', 'file_size']
      });

      const attendees = await EventAttendee.findAll({ where: { event_id: ev.id } });
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
          department: deptName, office: officeName, position: positionName,
          response: attendee.response
        });
      }

      events.push({
        id: ev.id, title: ev.title, color: ev.color, method: ev.method, link: ev.link,
        start_datetime: ev.start_datetime, end_datetime: ev.end_datetime,
        hierarchy: ev.hierarchy, visibility: ev.visibility,
        venue: venueName, location: locationName, description: ev.description,
        creator: creatorData,
        attachments: attachments.map(a => ({ id: a.id, file_name: a.file_name, file_url: a.file_url, file_size: a.file_size })),
        created_at: ev.created_at, response: record.response,
        participants: {
          departments: Array.from(departmentSet), offices: Array.from(officeSet), users: usersList,
        },
      });
    }

    res.json({ ok: true, events });
  } catch (error) {
    console.error('List invitations error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

// PUT /api/notifications/:eventId/respond — event invitation response (notifies creator)
router.put('/:eventId/respond', authenticate, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { response } = req.body;

    if (!['accepted', 'declined'].includes(response)) {
      return res.status(400).json({ ok: false, message: 'Choose either accept or decline to respond to this event invitation.' });
    }

    const attendee = await EventAttendee.findOne({
      where: { user_id: req.userId, event_id: eventId }
    });
    if (!attendee) {
      return res.status(404).json({ ok: false, message: 'Not invited.' });
    }

    const linkedEvent = await Event.findByPk(eventId);
    if (!linkedEvent || linkedEvent.is_deleted || linkedEvent.is_archived) {
      return res.status(404).json({ ok: false, message: 'Event not found.' });
    }

    attendee.response = response;
    await attendee.save();

    try {
      const event = await Event.findByPk(eventId);
      if (event) {
        const responderProfile = await UserProfile.findOne({ where: { user_id: req.userId } });
        const responderUser = await User.findByPk(req.userId, { attributes: ['username', 'email'] });
        const responderName = responderProfile?.full_name || responderUser?.username || 'Someone';
        const collaborators = await EventCollaborator.findAll({ where: { event_id: event.id }, attributes: ['user_id'] });
        const recipients = uniqueIds([event.creator_id, ...collaborators.map((collaborator) => collaborator.user_id)], [req.userId]);
        for (const userId of recipients) {
          await createNotification({
            userId,
            type: 'event_response',
            title: 'Invitation Response',
            message: `${responderName} ${response} the invitation to "${event.title}".`,
            entityType: 'event',
            entityId: event.id,
          });
        }
        if (responderUser?.email) {
          await cancelUserReminder({
            entityId: event.id,
            entityType: 'event',
            email: responderUser.email,
            reason: `Invitation response changed to ${response}.`,
          });
          if (response === 'accepted' && event.remind_before_minutes) {
            const contact = {
              email: responderUser.email,
              full_name: responderProfile?.full_name || responderUser.username || responderUser.email,
            };
            const reminderTime = new Date(
              new Date(event.start_datetime).getTime() - Number(event.remind_before_minutes) * 60000,
            );
            const { subject, body } = buildReminderEmail(event, contact.full_name);
            await queueEmail({
              recipient_email: contact.email,
              subject,
              body,
              scheduled_for: reminderTime,
              event_id: event.id,
              entity_type: 'event',
              email_type: 'reminder',
            });
          }
        }
      }
    } catch (notifErr) {
      console.error('Failed to create response notification:', notifErr);
    }

    res.json({ ok: true, message: `Invitation ${response}.` });
  } catch (error) {
    console.error('Respond to invitation error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

// ─── General notification feed ─────────────────────────
router.get('/feed', authenticate, async (req, res) => {
  try {
    const { filter = 'all', limit = 20, offset = 0 } = req.query;
    const where = { user_id: req.userId };
    if (filter === 'unread') where.is_read = false;

    const notifications = await Notification.findAll({
      where,
      order: [['created_at', 'DESC']],
      limit: parseInt(limit),
      offset: parseInt(offset),
    });
    const unreadCount = await Notification.count({ where: { user_id: req.userId, is_read: false } });

    res.json({
      ok: true,
      notifications,
      unreadCount,
      hasMore: notifications.length === parseInt(limit),
    });
  } catch (error) {
    console.error('Get notifications feed error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

router.get('/unread-count', authenticate, async (req, res) => {
  try {
    const count = await Notification.count({ where: { user_id: req.userId, is_read: false } });
    res.json({ ok: true, count });
  } catch (error) {
    console.error('Get unread count error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

router.put('/:id/read', authenticate, async (req, res) => {
  try {
    const notif = await Notification.findOne({ where: { id: req.params.id, user_id: req.userId } });
    if (!notif) return res.status(404).json({ ok: false, message: 'Not found.' });
    notif.is_read = true;
    await notif.save();
    res.json({ ok: true });
  } catch (error) {
    console.error('Mark notification read error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

router.put('/read-all', authenticate, async (req, res) => {
  try {
    await Notification.update(
      { is_read: true },
      { where: { user_id: req.userId, is_read: false } }
    );
    res.json({ ok: true });
  } catch (error) {
    console.error('Mark all notifications read error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

module.exports = router;
