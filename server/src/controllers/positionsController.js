const Position = require('../models').Position;
const PositionAssignment = require('../models').PositionAssignment;
const User = require('../models').User;

// List all positions
exports.list = async (req, res) => {
  try {
    const positions = await Position.findAll({ order: [['name', 'ASC']] });
    res.json({ ok: true, positions });
  } catch (error) {
    console.error('List positions error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// Create position
exports.create = async (req, res) => {
  try {
    const { name, weight, allow_multiple } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ ok: false, message: 'Position name required.' });
    }
    const pos = await Position.create({
      name: name.trim(),
      weight: weight || 1,
      allow_multiple: allow_multiple || false
    });
    res.status(201).json({ ok: true, position: pos });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ ok: false, message: 'Position already exists.' });
    }
    console.error('Create position error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// Toggle active/inactive
exports.toggle = async (req, res) => {
  try {
    const { id } = req.params;
    const pos = await Position.findByPk(id);
    if (!pos) return res.status(404).json({ ok: false, message: 'Position not found.' });
    pos.is_active = !pos.is_active;
    await pos.save();
    res.json({ ok: true, position: pos });
  } catch (error) {
    console.error('Toggle position error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// Delete position
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const pos = await Position.findByPk(id);
    if (!pos) return res.status(404).json({ ok: false, message: 'Position not found.' });
    await pos.destroy();
    res.json({ ok: true, message: 'Position deleted.' });
  } catch (error) {
    console.error('Delete position error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// Get available positions (for dropdown when generating account code)
exports.available = async (req, res) => {
  try {
    // Get all active positions
    const positions = await Position.findAll({ where: { is_active: true } });
    // Get currently assigned positions (active assignments)
    const assignments = await PositionAssignment.findAll({
      where: { status: 'active' },
      attributes: ['position_id']
    });
    const assignedIds = assignments.map(a => a.position_id);
    
    const available = positions.filter(p => p.allow_multiple || !assignedIds.includes(p.id));
    
    res.json({ ok: true, positions: available });
  } catch (error) {
    console.error('Available positions error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};