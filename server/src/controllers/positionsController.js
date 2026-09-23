const Position = require('../models').Position;
const PositionAssignment = require('../models').PositionAssignment;
const User = require('../models').User;
const Admin = require('../models').Admin;
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const sequelize = require('../config/database');

// ─── List all positions ──────────────────────────────
exports.list = async (req, res) => {
  try {
    const rows = await Position.findAll({
      order: [['order', 'ASC'], ['created_at', 'ASC']]
    });
    const items = [];
    for (const pos of rows) {
      const plain = pos.toJSON();
      if (pos.created_by) {
        const admin = await Admin.findByPk(pos.created_by, {
          attributes: ['user_id']
        });
        if (admin) {
          const user = await User.findByPk(admin.user_id, {
            attributes: ['username']
          });
          plain.created_by_username = user ? user.username : null;
        } else {
          plain.created_by_username = null;
        }
      } else {
        plain.created_by_username = null;
      }
      items.push(plain);
    }
    res.json({ ok: true, positions: items });
  } catch (error) {
    console.error('List positions error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── Create position ────────────────────────────────────
exports.create = async (req, res) => {
  try {
    const { name, allow_multiple } = req.body;
    if (!name || !name.trim()) {
      return res.status(400).json({ ok: false, message: 'Position name required.' });
    }

    const lastPosition = await Position.findOne({
      order: [['order', 'DESC']]
    });
    const newOrder = lastPosition ? lastPosition.order + 1 : 0;

    const pos = await Position.create({
      name: name.trim(),
      order: newOrder,
      allow_multiple: allow_multiple || false,
      is_active: true,
      created_by: req.adminId
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

// ─── Toggle ──────────────────────────────────────────────
exports.toggle = async (req, res) => {
  try {
    const { id } = req.params;
    const pos = await Position.findByPk(id);
    if (!pos) return res.status(404).json({ ok: false, message: 'Position not found.' });

    if (pos.is_active) {
      const hasAssignments = await PositionAssignment.findOne({
        where: { position_id: id, status: 'active' }
      });
      if (hasAssignments) {
        return res.status(409).json({
          ok: false,
          message: 'Cannot deactivate position. It is currently assigned to one or more users.'
        });
      }
    }

    pos.is_active = !pos.is_active;
    await pos.save();
    res.json({ ok: true, position: pos });
  } catch (error) {
    console.error('Toggle position error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── Delete ──────────────────────────────────────────────
exports.delete = async (req, res) => {
  try {
    const { id } = req.params;
    const pos = await Position.findByPk(id);
    if (!pos) return res.status(404).json({ ok: false, message: 'Position not found.' });

    const hasAssignments = await PositionAssignment.findOne({
      where: { position_id: id }
    });
    if (hasAssignments) {
      return res.status(409).json({
        ok: false,
        message: 'Cannot delete position. It has existing assignments (active or inactive).'
      });
    }

    await pos.destroy();
    res.json({ ok: true, message: 'Position deleted.' });
  } catch (error) {
    console.error('Delete position error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── Update ──────────────────────────────────────────────
exports.update = async (req, res) => {
  try {
    const { id } = req.params;
    const { name, allow_multiple } = req.body;

    const pos = await Position.findByPk(id);
    if (!pos) return res.status(404).json({ ok: false, message: 'Position not found.' });

    if (name) pos.name = name.trim();
    if (allow_multiple !== undefined) pos.allow_multiple = allow_multiple;
    await pos.save();

    res.json({ ok: true, position: pos });
  } catch (error) {
    if (error.name === 'SequelizeUniqueConstraintError') {
      return res.status(409).json({ ok: false, message: 'Position name already exists.' });
    }
    console.error('Update position error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── Combine ──────────────────────────────────────────────
exports.combine = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const { target_position_id } = req.body;

    if (!target_position_id) {
      return res.status(400).json({ ok: false, message: 'Target position ID is required.' });
    }

    const sourcePos = await Position.findByPk(id);
    if (!sourcePos) return res.status(404).json({ ok: false, message: 'Source position not found.' });

    const targetPos = await Position.findByPk(target_position_id);
    if (!targetPos) return res.status(404).json({ ok: false, message: 'Target position not found.' });

    if (sourcePos.id === targetPos.id) {
      return res.status(400).json({ ok: false, message: 'Cannot combine a position with itself.' });
    }

    const assignments = await PositionAssignment.findAll({
      where: { position_id: sourcePos.id, status: 'active' }
    });

    for (const assignment of assignments) {
      const existing = await PositionAssignment.findOne({
        where: {
          user_id: assignment.user_id,
          position_id: targetPos.id,
          status: 'active'
        }
      });
      if (!existing) {
        await PositionAssignment.create({
          id: uuidv4(),
          user_id: assignment.user_id,
          position_id: targetPos.id,
          status: 'active'
        }, { transaction: t });
      }
    }

    // FIX: `where` and `transaction` must be in the SAME options object.
    // update(values, options) only takes two arguments — a third
    // argument is silently dropped, so this update was previously
    // running outside the transaction.
    await PositionAssignment.update(
      { status: 'inactive' },
      {
        where: { position_id: sourcePos.id, status: 'active' },
        transaction: t
      }
    );

    sourcePos.is_active = false;
    await sourcePos.save({ transaction: t });

    await t.commit();
    res.json({ ok: true, message: 'Positions combined successfully.' });
  } catch (error) {
    await t.rollback();
    console.error('Combine positions error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── Available ──────────────────────────────────────────
exports.available = async (req, res) => {
  try {
    const positions = await Position.findAll({ where: { is_active: true } });
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

// ─── Reorder ──────────────────────────────────────────────
exports.reorder = async (req, res) => {
  try {
    const { positions } = req.body;

    if (!positions || !Array.isArray(positions)) {
      return res.status(400).json({ ok: false, message: 'Positions array required.' });
    }

    for (const item of positions) {
      await Position.update(
        { order: item.order },
        { where: { id: item.id } }
      );
    }

    res.json({ ok: true, message: 'Positions reordered successfully.' });
  } catch (error) {
    console.error('Reorder positions error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};