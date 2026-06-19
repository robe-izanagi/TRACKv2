const PositionAssignment = require('../models').PositionAssignment;
const User = require('../models').User;
const Position = require('../models').Position;
const { Op } = require('sequelize');

// List all assignments with user and position info
exports.listAssignments = async (req, res) => {
  try {
    const assignments = await PositionAssignment.findAll({
      where: { status: 'active' },
      include: [
        { model: User, attributes: ['id', 'email'] },
        { model: Position, attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']]
    });
    res.json({ ok: true, assignments });
  } catch (error) {
    console.error('List assignments error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// Remove assignment (set inactive)
exports.removeAssignment = async (req, res) => {
  try {
    const { id } = req.params;
    const assignment = await PositionAssignment.findByPk(id);
    if (!assignment) return res.status(404).json({ ok: false, message: 'Assignment not found.' });
    assignment.status = 'inactive';
    assignment.updated_at = new Date();
    await assignment.save();
    res.json({ ok: true, message: 'Assignment removed.' });
  } catch (error) {
    console.error('Remove assignment error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};