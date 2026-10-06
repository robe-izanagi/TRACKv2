// src/models/login_attempts.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const LoginAttempt = sequelize.define('login_attempts', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  user_id: { type: DataTypes.UUID, allowNull: true },
  username: { type: DataTypes.STRING(30), allowNull: true },
  email: { type: DataTypes.STRING(255), allowNull: true },
  method: { type: DataTypes.ENUM('local', 'google'), allowNull: false },
  attempt_status: { type: DataTypes.ENUM('success', 'failed'), allowNull: false },
  // user_not_found | not_admin | blocked | invalid_password | domain_not_allowed | auth_failed
  failure_reason: { type: DataTypes.STRING(40), allowNull: true },
  ip_address: { type: DataTypes.STRING(45), allowNull: true },
  is_admin_login: { type: DataTypes.BOOLEAN, allowNull: false, defaultValue: false },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  timestamps: false,
  tableName: 'login_attempts',
  indexes: [
    { fields: ['created_at'] },
    { name: 'idx_login_status_created', fields: ['attempt_status', 'created_at'] },
    { name: 'idx_login_user_created', fields: ['user_id', 'created_at'] },
    { name: 'idx_login_ip_created', fields: ['ip_address', 'created_at'] }
  ]
});

module.exports = LoginAttempt;