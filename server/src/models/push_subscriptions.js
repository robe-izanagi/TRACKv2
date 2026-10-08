const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PushSubscription = sequelize.define('push_subscriptions', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  endpoint_hash: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  endpoint: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  p256dh: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  auth: {
    type: DataTypes.TEXT,
    allowNull: false,
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  updated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
}, {
  timestamps: false,
  tableName: 'push_subscriptions',
  indexes: [
    { name: 'endpoint_hash', unique: true, fields: ['endpoint_hash'] },
    { name: 'idx_push_subscriptions_user_id', fields: ['user_id'] },
  ],
});

module.exports = PushSubscription;
