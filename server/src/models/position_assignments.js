const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const PositionAssignment = sequelize.define('position_assignments', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  position_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'positions',
      key: 'id'
    }
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
    references: {
      model: 'users',
      key: 'id'
    }
  },
  status: {
    type: DataTypes.ENUM('active', 'inactive'),
    defaultValue: 'active'
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  },
  updated_at: {
    type: DataTypes.DATE
  }
}, {
  timestamps: false,
  tableName: 'position_assignments'
});

module.exports = PositionAssignment;