const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserProfile = sequelize.define('user_profile', {
  user_id: {
    type: DataTypes.UUID,
    primaryKey: true
  },
  display_picture: {
    type: DataTypes.TEXT,
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
  }
}, {
  timestamps: false,
  tableName: 'user_profile'
});

module.exports = UserProfile;