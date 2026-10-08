const { v4: uuidv4 } = require('uuid');
const { Notification } = require('../models');
const { sendPushNotification } = require('./pushNotificationService');

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
    const inaccessibleTypes = new Set([
      'event_archived', 'event_deleted', 'event_attendee_removed', 'event_collaborator_removed',
      'task_archived', 'task_deleted', 'task_assignee_removed', 'task_collaborator_removed',
    ]);
    const url = inaccessibleTypes.has(type)
      ? '/notifications'
      : entityType === 'event'
        ? '/events'
        : entityType === 'task'
          ? '/tasks'
          : '/notifications';
    await sendPushNotification(userId, { title, message, type, entityType, entityId, url });
    return notification;
  } catch (err) {
    console.error('Failed to create notification:', err);
    return null;
  }
};
