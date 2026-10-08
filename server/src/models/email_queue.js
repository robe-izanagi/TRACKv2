const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const EmailQueue = sequelize.define('email_queue', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  recipient_email: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  subject: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  body: {
    type: DataTypes.TEXT,
    allowNull: false
  },
  scheduled_for: {
    type: DataTypes.DATE,
    allowNull: true // null = send ASAP
  },
  event_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  entity_type: {
    type: DataTypes.STRING(50),
    allowNull: true,
    defaultValue: 'event'
  },
  email_type: {
    type: DataTypes.STRING(50),
    allowNull: true // 'invitation' | 'collaborator' | 'reminder'
  },
  status: {
    type: DataTypes.ENUM('pending', 'sent', 'failed'),
    defaultValue: 'pending'
  },
  error_message: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  sent_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  in_app_notified_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: false,
  tableName: 'email_queue',
  indexes: [
    { fields: ['status'] },
    { fields: ['status', 'scheduled_for'] }
  ]
});

module.exports = EmailQueue;
