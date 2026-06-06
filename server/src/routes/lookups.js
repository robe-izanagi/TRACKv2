const express = require('express');
const router = express.Router();
const { Department, Office, Role } = require('../models');

// Public lookups for client-side selects
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
    const rows = await Role.findAll({ where: { is_active: true }, attributes: ['id', 'name'], order: [['name', 'ASC']] });
    res.json({ ok: true, items: rows });
  } catch (err) {
    console.error('Lookup roles error:', err);
    res.status(500).json({ ok: false, message: 'Server error' });
  }
});

module.exports = router;
