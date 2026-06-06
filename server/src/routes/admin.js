const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { generateAccountCode } = require('../controllers/generateCodeController');
const {
  listDepartments,
  createDepartment,
  toggleDepartment,
  listOffices,
  createOffice,
  toggleOffice
} = require('../controllers/setupController');

// ── Test ──
router.get('/me', requireAdmin, (req, res) => {
  res.json({ ok: true, message: 'You are an admin', adminId: req.adminId, userId: req.userId });
});

// ── Account Codes ──
router.post('/account-codes', requireAdmin, generateAccountCode);
router.get('/account-codes', requireAdmin, require('../controllers/generateCodeController').listCodes); // ensure listCodes is imported or defined

// ── Departments ──
router.get('/departments', requireAdmin, listDepartments);
router.post('/departments', requireAdmin, createDepartment);
router.put('/departments/:id/toggle', requireAdmin, toggleDepartment);

// ── Offices ──
router.get('/offices', requireAdmin, listOffices);
router.post('/offices', requireAdmin, createOffice);
router.put('/offices/:id/toggle', requireAdmin, toggleOffice);

module.exports = router;