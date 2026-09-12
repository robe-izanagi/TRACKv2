const { DataTypes } = require('sequelize');
const sequelize = require('../config/database');

const UserFeedback = sequelize.define('user_feedback', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true
  },
  rating: {
    type: DataTypes.ENUM('good', 'neutral', 'not_good'),
    allowNull: false
  },
  comment: {
    type: DataTypes.TEXT,
    allowNull: true
  },
  created_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW
  }
}, {
  timestamps: false,
  tableName: 'user_feedback'
});

module.exports = UserFeedback;