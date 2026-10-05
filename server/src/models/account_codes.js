const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const AccountCode = sequelize.define('account_codes', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false
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
  is_admin: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  generated_by_admin_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  used_by_user_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  status: {
    type: DataTypes.ENUM('unused', 'used', 'revoked', 'expired', 'inactive'),
    defaultValue: 'unused'
  },
  source_type: {
    type: DataTypes.ENUM('admin_generated', 'request_approved'),
    allowNull: false,
    defaultValue: 'admin_generated'
  },
  account_code_request_id: {
    type: DataTypes.UUID,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  used_at: {
    type: DataTypes.DATE,
    allowNull: true
  },
  expires_at: {
    type: DataTypes.DATE,
    allowNull: true
  }
}, {
  timestamps: false,
  tableName: 'account_codes',
  indexes: [
    { unique: true, fields: ['code'] }
  ]
});

module.exports = AccountCode;