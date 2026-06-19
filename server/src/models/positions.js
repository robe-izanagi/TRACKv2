const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const Position = sequelize.define('positions', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: false
    // NO unique: true
  },
  weight: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 1
  },
  allow_multiple: {
    type: DataTypes.BOOLEAN,
    defaultValue: false
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: false,
  tableName: 'positions',
  indexes: [
    { unique: true, fields: ['name'] }
  ]
});

module.exports = Position;