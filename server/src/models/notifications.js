const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Notification = sequelize.define('notifications', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  type: {
    type: DataTypes.ENUM(
      'event_invite', 'event_update', 'event_collaborator', 'event_response', 'event_reminder',
      'event_archived', 'event_deleted', 'event_attendee_removed', 'event_collaborator_removed',
      'event_attachment_added', 'event_venue_changed', 'event_venue_archived',
      'task_invite', 'task_update', 'task_collaborator', 'task_response', 'task_reminder',
      'task_archived', 'task_deleted', 'task_assignee_removed', 'task_collaborator_removed',
      'task_checklist_completed', 'task_checklist_reopened', 'task_checklist_comment',
      'task_attachment_added',
      'profile_change_approved', 'profile_change_rejected', 'system'
    ),
    allowNull: false
  },
  entity_type: {
    type: DataTypes.ENUM('event', 'task'),
    allowNull: true
  },
  entity_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  is_read: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_deleted: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: false,
  tableName: 'notifications',
  indexes: [
    { fields: ['user_id', 'is_read'] }
  ]
});

module.exports = Notification;
