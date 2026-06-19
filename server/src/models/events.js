const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Event = sequelize.define('events', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  title: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  color: {
    type: DataTypes.STRING(7),
    allowNull: true
  },
  method: {
    type: DataTypes.ENUM('online', 'face-to-face'),
    allowNull: true
  },
  link: {
    type: DataTypes.STRING(255),
    allowNull: true
  },
  start_datetime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  end_datetime: {
    type: DataTypes.DATE,
    allowNull: false
  },
  duration_minutes: { 
    type: DataTypes.INTEGER,
    allowNull: true,
    comment: 'Duration in minutes per occurrence. NULL = use start/end difference.'
  },
  hierarchy: {
    type: DataTypes.ENUM('local', 'regional', 'national', 'international'),
    allowNull: true
  },
  visibility: {
    type: DataTypes.ENUM('campus', 'department', 'private'),
    allowNull: false
  },
  venue_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  department_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  office_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  creator_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  remind_before_minutes: {
    type: DataTypes.INTEGER,
    defaultValue: 15
  },
  is_email_reminder: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_archived: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: false,
  tableName: 'events',
  indexes: [
    { fields: ['creator_id'] },
    { fields: ['department_id'] },
    { fields: ['start_datetime'] }
  ]
});

module.exports = Event;