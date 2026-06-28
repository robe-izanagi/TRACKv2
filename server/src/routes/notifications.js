const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const {
  Event, EventAttendee, Venue, Location,
  User, UserProfile, Department, Office, Position,
  Attachment
} = require('../models');

// GET /api/notifications/invitations?response=pending&type=campus|department|private
router.get('/invitations', authenticate, async (req, res) => {
  try {
    const { response, type } = req.query;

    // Default to pending only
    const whereAttendee = { user_id: req.userId };
    if (response && ['pending', 'accepted', 'declined'].includes(response)) {
      whereAttendee.response = response;
    } else {
      whereAttendee.response = 'pending';
    }

    const attendeeRecords = await EventAttendee.findAll({
      where: whereAttendee,
      include: [
        {
          model: Event,
          as: 'event',                      // ✅ fixed alias (was 'Event')
          include: [
            { model: Venue, attributes: ['name'] },
            { model: Location, attributes: ['map_location', 'exact_location'] },
            // Creator – alias is 'user' (lowercase)
            {
              model: User, as: 'user', attributes: ['id', 'email'],
              include: [
                {
                  model: UserProfile,
                  include: [Department, Office, Position]
                }
              ]
            },
            { model: Department, attributes: ['name'] },
            { model: Office, attributes: ['name'] }
          ]
        }
      ]
    });

    // Build result list
    const events = [];
    for (const record of attendeeRecords) {
      const ev = record.event;              // ✅ changed from record.Event
      if (!ev) continue;

      // Filter by visibility type if requested
      if (type && ['campus', 'department', 'private'].includes(type)) {
        if (ev.visibility !== type) continue;
      }

      // Fetch attachments manually (polymorphic)
      const attachments = await Attachment.findAll({
        where: { entity_type: 'event', entity_id: ev.id },
        attributes: ['id', 'file_name', 'file_url', 'file_size']
      });

      // Fetch participants (attendees) for this event
      const participantsRaw = await EventAttendee.findAll({
        where: { event_id: ev.id },
        include: [
          {
            model: User, attributes: ['id', 'email'],
            include: [
              { model: UserProfile, include: [Department, Office, Position] }
            ]
          }
        ]
      });

      // Group participants
      const departments = new Map();
      const offices = new Map();
      const users = [];

      participantsRaw.forEach(p => {
        const user = p.User;
        if (!user || !user.UserProfile) return;
        const profile = user.UserProfile;
        if (profile.department_id && profile.Department) {
          departments.set(profile.Department.name, (departments.get(profile.Department.name) || 0) + 1);
        }
        if (profile.office_id && profile.Office) {
          offices.set(profile.Office.name, (offices.get(profile.Office.name) || 0) + 1);
        }
        users.push({
          id: user.id,
          email: user.email,
          name: profile.full_name || user.email,
          department: profile.Department?.name,
          office: profile.Office?.name,
          position: profile.Position?.name,
          response: p.response,
        });
      });

      events.push({
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
        creator: ev.user ? {
          id: ev.user.id,
          email: ev.user.email,
          full_name: ev.user.UserProfile?.full_name || ev.user.email,
          department: ev.user.UserProfile?.Department?.name,
          office: ev.user.UserProfile?.Office?.name,
          position: ev.user.UserProfile?.Position?.name,
        } : null,
        department: ev.Department ? ev.Department.name : null,
        office: ev.Office ? ev.Office.name : null,
        attachments: attachments.map(a => ({
          id: a.id,
          file_name: a.file_name,
          file_url: a.file_url,
          file_size: a.file_size,
        })),
        created_at: ev.created_at,
        response: record.response,
        participants: {
          departments: Array.from(departments, ([name, count]) => ({ name, count })),
          offices: Array.from(offices, ([name, count]) => ({ name, count })),
          users,
        },
      });
    }

    res.json({ ok: true, events });
  } catch (error) {
    console.error('List invitations error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

// PUT /api/notifications/:eventId/respond
router.put('/:eventId/respond', authenticate, async (req, res) => {
  try {
    const { eventId } = req.params;
    const { response } = req.body;

    if (!['accepted', 'declined'].includes(response)) {
      return res.status(400).json({ ok: false, message: 'Invalid response.' });
    }

    const attendee = await EventAttendee.findOne({
      where: { user_id: req.userId, event_id: eventId }
    });
    if (!attendee) {
      return res.status(404).json({ ok: false, message: 'Not invited.' });
    }
    if (attendee.response !== 'pending') {
      return res.status(400).json({ ok: false, message: 'Already responded.' });
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