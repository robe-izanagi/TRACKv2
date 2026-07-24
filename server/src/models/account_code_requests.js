const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AccountCodeRequest = sequelize.define('account_code_requests', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false
  },
  full_name: {
    type: DataTypes.STRING(255),
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
  role_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  position_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('pending', 'approved', 'rejected'),
    defaultValue: 'pending'
  },
  admin_notes: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  reviewed_by_admin_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  generated_code: {
    type: DataTypes.STRING(50),
    allowNull: true
  },
  code_sent_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  reviewed_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: false,
  tableName: 'account_code_requests'
});

module.exports = AccountCodeRequest;