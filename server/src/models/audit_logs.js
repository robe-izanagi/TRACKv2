// src/models/audit_logs.js
const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AuditLog = sequelize.define('audit_logs', {
  id: { type: DataTypes.UUID, defaultValue: DataTypes.UUIDV4, primaryKey: true },
  actor_admin_id: { type: DataTypes.UUID, allowNull: true },
  actor_type: {
    type: DataTypes.ENUM('admin', 'user', 'system', 'anonymous'),
    allowNull: false,
    defaultValue: 'system'
  },
  target_user_id: { type: DataTypes.UUID, allowNull: true },
  action_type: { type: DataTypes.STRING(100), allowNull: false },
  entity_table: { type: DataTypes.STRING(100), allowNull: false },
  entity_id: { type: DataTypes.UUID, allowNull: true },
  description: { type: DataTypes.TEXT, allowNull: true },
  severity: {
    type: DataTypes.ENUM('info', 'warning', 'critical'),
    allowNull: false,
    defaultValue: 'info'
  },
  ip_address: { type: DataTypes.STRING(45), allowNull: true },
  metadata: { type: DataTypes.JSON, allowNull: true },
  created_at: { type: DataTypes.DATE, defaultValue: DataTypes.NOW }
}, {
  timestamps: false,
  tableName: 'audit_logs',
  indexes: [
    { name: 'idx_audit_created', fields: ['created_at'] },
    { name: 'idx_audit_action_created', fields: ['action_type', 'created_at'] },
    { name: 'idx_audit_admin_created', fields: ['actor_admin_id', 'created_at'] },
    { name: 'idx_audit_target_created', fields: ['target_user_id', 'created_at'] },
    { name: 'idx_audit_entity', fields: ['entity_table', 'entity_id'] },
    { name: 'idx_audit_ip_created', fields: ['ip_address', 'created_at'] }
  ]
});

module.exports = AuditLog;