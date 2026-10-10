const express = require('express');
const router = express.Router();
const { Op } = require('sequelize');
const { Department, Office, Role, Position, PositionAssignment, AllowedDomain } = require('../models');

// ─── Public lookups ──────────────────────────────────────
router.get('/departments', async (req, res) => {
  try {
    const rows = await Department.findAll({ where: { is_active: true }, attributes: ['id', 'name'], order: [['name', 'ASC']] });
    res.json({ ok: true, items: rows });
  } catch (err) {
    console.error('Lookup departments error:', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

router.get('/offices', async (req, res) => {
  try {
    const rows = await Office.findAll({ where: { is_active: true }, attributes: ['id', 'name'], order: [['name', 'ASC']] });
    res.json({ ok: true, items: rows });
  } catch (err) {
    console.error('Lookup offices error:', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

router.get('/roles', async (req, res) => {
  try {
    const rows = await Role.findAll({
      where: { is_active: true, name: { [Op.in]: ['heads', 'staff', 'faculty'] } },
      attributes: ['id', 'name'],
      order: [['name', 'ASC']]
    });
    res.json({ ok: true, items: rows });
  } catch (err) {
    console.error('Lookup roles error:', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

// ─── NEW: Public available positions (excludes single positions already assigned) ───
router.get('/available-positions', async (req, res) => {
  try {
    const positions = await Position.findAll({
      where: { is_active: true },
      attributes: ['id', 'name'],
      order: [['order', 'ASC']]
    });
    const assignments = await PositionAssignment.findAll({
      where: { status: 'active' },
      attributes: ['position_id']
    });
    const assignedIds = assignments.map(a => a.position_id);
    const available = positions.filter(p => p.allow_multiple || !assignedIds.includes(p.id));
    res.json({ ok: true, positions: available });
  } catch (err) {
    console.error('Lookup available positions error:', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

router.get('/domains', async (req, res) => {
  try {
    const domains = await AllowedDomain.findAll({
      where: { is_active: true },
      attributes: ['domain'],
      order: [['domain', 'ASC']]
    });
    res.json({ ok: true, domains: domains.map(d => d.domain) });
  } catch (err) {
    console.error('Lookup domains error:', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

router.get('/positions', async (req, res) => {
  try {
    const positions = await Position.findAll({
      where: { is_active: true },
      attributes: ['id', 'name'],
      order: [['order', 'ASC']]
    });
    res.json({ ok: true, positions });
  } catch (err) {
    console.error('Lookup positions error:', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

module.exports = router;