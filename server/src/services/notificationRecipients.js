const { Op } = require('sequelize');
const {
  EventAttendee,
  EventCollaborator,
  TaskAssignee,
  TaskCollaborator,
  EmailQueue,
} = require('../models');

const uniqueIds = (ids, excludedIds = []) => {
  const excluded = new Set(excludedIds.filter(Boolean));
  return [...new Set(ids.filter(Boolean))].filter((id) => !excluded.has(id));
};

exports.uniqueIds = uniqueIds;

exports.getEventParticipantIds = async (eventId, { excludeUserIds = [], attendeeResponses = ['pending', 'accepted'] } = {}) => {
  const [attendees, collaborators] = await Promise.all([
    EventAttendee.findAll({
      where: { event_id: eventId, response: { [Op.in]: attendeeResponses } },
      attributes: ['user_id'],
    }),
    EventCollaborator.findAll({ where: { event_id: eventId }, attributes: ['user_id'] }),
  ]);
  return uniqueIds([...attendees, ...collaborators].map((row) => row.user_id), excludeUserIds);
};

exports.getTaskParticipantIds = async (taskId, { excludeUserIds = [], assigneeResponses = ['pending', 'accepted'] } = {}) => {
  const [assignees, collaborators] = await Promise.all([
    TaskAssignee.findAll({
      where: { task_id: taskId, response: { [Op.in]: assigneeResponses } },
      attributes: ['user_id'],
    }),
    TaskCollaborator.findAll({ where: { task_id: taskId }, attributes: ['user_id'] }),
  ]);
  return uniqueIds([...assignees, ...collaborators].map((row) => row.user_id), excludeUserIds);
};

exports.cancelPendingReminders = async ({ entityId, entityType, reason }) => {
  return EmailQueue.update(
    { status: 'failed', error_message: reason },
    {
      where: {
        event_id: entityId,
        entity_type: entityType,
        email_type: 'reminder',
        status: 'pending',
      },
    },
  );
};

exports.cancelUserReminder = async ({ entityId, entityType, email, reason }) => {
  if (!email) return;
  return EmailQueue.update(
    { status: 'failed', error_message: reason },
    {
      where: {
        event_id: entityId,
        entity_type: entityType,
        email_type: 'reminder',
        recipient_email: email,
        status: 'pending',
      },
    },
  );
};
