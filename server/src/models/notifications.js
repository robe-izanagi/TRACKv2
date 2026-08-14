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
      'task_invite', 'task_update', 'task_collaborator', 'task_response', 'task_reminder',
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