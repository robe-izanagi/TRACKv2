const { v4: uuidv4 } = require('uuid');
const { Notification } = require('../models');

exports.createNotification = async ({ userId, type, title, message, entityType = null, entityId = null }) => {
  try {
    const notification = await Notification.create({
      id: uuidv4(),
      user_id: userId,
      type,
      title,
      message,
      entity_type: entityType,
      entity_id: entityId,
      is_read: false,
    });
    return notification;
  } catch (err) {
    console.error('Failed to create notification:', err);
    return null;
  }
};
