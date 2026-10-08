const { v4: uuidv4 } = require('uuid');
const { Venue, Event } = require('../models');
const { createNotification } = require('../services/notificationService');
const { getEventParticipantIds, uniqueIds } = require('../services/notificationRecipients');

const notifyVenueImpact = async ({ venue, type, title, messageForEvent }) => {
  const events = await Event.findAll({
    where: {
      venue_id: venue.id,
      is_archived: false,
      is_deleted: false,
      end_datetime: { [require('sequelize').Op.gte]: new Date() },
    },
  });
  for (const event of events) {
    const participantIds = await getEventParticipantIds(event.id);
    for (const userId of uniqueIds([event.creator_id, ...participantIds])) {
      await createNotification({
        userId,
        type,
        title,
        message: messageForEvent(event),
        entityType: 'event',
        entityId: event.id,
      });
    }
  }
};

// List all venues (any authenticated user can view)
exports.listVenues = async (req, res) => {
  try {
    const venues = await Venue.findAll({
      where: { is_archived: false },
      order: [['name', 'ASC']]
    });
    res.json({ ok: true, venues });
  } catch (error) {
    console.error('List venues error:', error);
    res.status(500).json({ ok: false, message: 'We could not load venues right now. Please try again.' });
  }
};

// Create a venue (staff only)
exports.createVenue = async (req, res) => {
  try {
    const { name, code, building_location, type } = req.body;

    if (!name || !code) {
      const missingFields = [!name && 'venue name', !code && 'venue code'].filter(Boolean);
      return res.status(400).json({ ok: false, message: `Please provide ${missingFields.join(' and ')}.` });
    }

    // Check for duplicate code
    const existing = await Venue.findOne({ where: { code } });
    if (existing) {
      return res.status(409).json({ ok: false, message: 'Venue code already exists.' });
    }

    const venue = await Venue.create({
      id: uuidv4(),
      name: name.trim(),
      code: code.trim().toUpperCase(),
      building_location: building_location?.trim() || null,
      type: type?.trim() || null,
      created_by: req.userId,           // from auth middleware
      is_archived: false
    });

    res.status(201).json({ ok: true, venue });
  } catch (error) {
    console.error('Create venue error:', error);
    res.status(500).json({ ok: false, message: 'We could not create this venue. Please review the details and try again.' });
  }
};

// Update a venue (staff only)
exports.updateVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, code, building_location, type } = req.body;

    const venue = await Venue.findByPk(id);
    if (!venue) {
      return res.status(404).json({ ok: false, message: 'Venue not found.' });
    }

    const before = {
      name: venue.name,
      code: venue.code,
      building_location: venue.building_location,
      type: venue.type,
    };

    // If code changed, check uniqueness
    if (code && code !== venue.code) {
      const existing = await Venue.findOne({ where: { code } });
      if (existing) {
        return res.status(409).json({ ok: false, message: 'Venue code already exists.' });
      }
      venue.code = code.trim().toUpperCase();
    }

    if (name) venue.name = name.trim();
    if (building_location !== undefined) venue.building_location = building_location?.trim() || null;
    if (type !== undefined) venue.type = type?.trim() || null;
    venue.updated_at = new Date();

    await venue.save();
    const changedFields = [
      venue.name !== before.name && 'name',
      venue.code !== before.code && 'code',
      venue.building_location !== before.building_location && 'location',
      venue.type !== before.type && 'type',
    ].filter(Boolean);
    if (changedFields.length > 0) {
      try {
        await notifyVenueImpact({
          venue,
          type: 'event_venue_changed',
          title: 'Venue Details Updated',
          messageForEvent: (event) => `Venue details for "${venue.name}" changed (${changedFields.join(', ')}). Review the location for "${event.title}".`,
        });
      } catch (notificationError) {
        console.error('Venue update notification error:', notificationError);
      }
    }
    res.json({ ok: true, venue });
  } catch (error) {
    console.error('Update venue error:', error);
    res.status(500).json({ ok: false, message: 'We could not update this venue. Please try again.' });
  }
};

// Archive a venue (soft delete – staff only)
exports.archiveVenue = async (req, res) => {
  try {
    const { id } = req.params;
    const venue = await Venue.findByPk(id);
    if (!venue) {
      return res.status(404).json({ ok: false, message: 'Venue not found.' });
    }
    venue.is_archived = true;
    venue.updated_at = new Date();
    await venue.save();
    try {
      await notifyVenueImpact({
        venue,
        type: 'event_venue_archived',
        title: 'Venue Archived',
        messageForEvent: (event) => `The venue "${venue.name}" for "${event.title}" was archived. Contact the organizer if the event location needs to change.`,
      });
    } catch (notificationError) {
      console.error('Venue archive notification error:', notificationError);
    }
    res.json({ ok: true, message: 'Venue archived.' });
  } catch (error) {
    console.error('Archive venue error:', error);
    res.status(500).json({ ok: false, message: 'We could not archive this venue. Please try again.' });
  }
};
