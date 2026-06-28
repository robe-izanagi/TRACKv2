const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { Event, EventAttendee, EventCollaborator, Venue, Location, User, UserProfile, Department, Office, Position, Attachment } = require('../models');

// GET /api/notifications/invitations?response=pending|accepted|declined&type=campus|department|private
router.get('/invitations', authenticate, async (req, res) => {
  try {
    const { response, type } = req.query;

    // Find attendee records for the current user
    const whereAttendee = { user_id: req.userId };
    if (response && ['pending', 'accepted', 'declined'].includes(response)) {
      whereAttendee.response = response;
    } else {
      // Default: show pending only
      whereAttendee.response = 'pending';
    }

    const attendeeRecords = await EventAttendee.findAll({
      where: whereAttendee,
      attributes: ['event_id', 'response'],
      include: [
        {
          model: Event,
          include: [
            { model: Venue, attributes: ['id', 'name'] },
            { model: Location, attributes: ['id', 'map_location', 'exact_location'] },
            {
              model: User, as: 'User', attributes: ['id', 'email'],  // creator
              include: [{
                model: UserProfile, attributes: ['full_name', 'department_id', 'office_id', 'position_id'],
                include: [Department, Office, Position]
              }]
            },
            { model: Department, attributes: ['id', 'name'] },
            { model: Office, attributes: ['id', 'name'] },
            { model: Attachment, attributes: ['id', 'file_name', 'file_url', 'file_size'] }
          ]
        }
      ]
    });

    // Map to a cleaner structure
    let events = attendeeRecords.map(record => {
      const ev = record.Event;
      return {
        id: ev.id,
        title: ev.title,
        color: ev.color,
        method: ev.method,
        link: ev.link,
        start_datetime: ev.start_datetime,
        end_datetime: ev.end_datetime,
        hierarchy: ev.hierarchy,
        visibility: ev.visibility,
        venue: ev.Venue ? ev.Venue.name : null,
        location: ev.Location ? `${ev.Location.map_location} ${ev.Location.exact_location || ''}`.trim() : null,
        description: ev.description,
        creator: ev.User ? {
          id: ev.User.id,
          email: ev.User.email,
          full_name: ev.User.UserProfile?.full_name || ev.User.email,
          department: ev.User.UserProfile?.Department?.name,
          office: ev.User.UserProfile?.Office?.name,
          position: ev.User.UserProfile?.Position?.name,
        } : null,
        department: ev.Department ? ev.Department.name : null,
        office: ev.Office ? ev.Office.name : null,
        attachments: ev.Attachments ? ev.Attachments.map(a => ({
          id: a.id,
          file_name: a.file_name,
          file_url: a.file_url,
          file_size: a.file_size,
        })) : [],
        created_at: ev.created_at,
        response: record.response,
      };
    });

    // Filter by event visibility if 'type' is specified
    if (type && ['campus', 'department', 'private'].includes(type)) {
      events = events.filter(e => e.visibility === type);
    }

    res.json({ ok: true, events });
  } catch (error) {
    console.error('List invitations error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

// PUT /api/notifications/:eventId/respond  (body: { response: 'accepted' | 'declined' })
router.put('/:eventId/respond', authenticate, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { response } = req.body;

    if (!['accepted', 'declined'].includes(response)) {
      return res.status(400).json({ ok: false, message: 'Invalid response. Must be "accepted" or "declined".' });
    }

    // Find the attendee record for this user and event
    const attendee = await EventAttendee.findOne({
      where: { user_id: req.userId, event_id: eventId }
    });

    if (!attendee) {
      return res.status(404).json({ ok: false, message: 'You are not invited to this event.' });
    }

    if (attendee.response !== 'pending') {
      return res.status(400).json({ ok: false, message: 'You have already responded to this invitation.' });
    }

    attendee.response = response;
    await attendee.save();

    res.json({ ok: true, message: `Invitation ${response}.` });
  } catch (error) {
    console.error('Respond to invitation error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

module.exports = router;