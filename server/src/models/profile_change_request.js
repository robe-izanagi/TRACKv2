const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const ProfileChangeRequest = sequelize.define('profile_change_requests', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false
  },
  changes: {
    type: DataTypes.JSON,
    allowNull: false
  },
  previous_values_recorded: {
    type: DataTypes.BOOLEAN,
    allowNull: false,
    defaultValue: false
  },
  previous_department_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  previous_office_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  previous_role_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  previous_position_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  requested_department_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  requested_office_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  requested_role_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  requested_position_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  details: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  reviewed_by_admin_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: false,
  tableName: 'profile_change_requests'
});

module.exports = ProfileChangeRequest;