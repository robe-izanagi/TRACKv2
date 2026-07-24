const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { generateAccountCode, listCodes } = require('../controllers/generateCodeController');
const {
  listDepartments,
  createDepartment,
  toggleDepartment,
  listOffices,
  createOffice,
  toggleOffice
} = require('../controllers/setupController');
const {
  listDomains,
  addDomain,
  toggleDomain,
  deleteDomain
} = require('../controllers/domainController');
const {
  list: listPositions,
  create: createPosition,
  toggle: togglePosition,
  delete: deletePosition,
  available: availablePositions
} = require('../controllers/positionsController');
const {
  listAssignments,
  removeAssignment
} = require('../controllers/positionAssignmentsController');

// ─── User Management (NEW) ────────────────────────────
const { getAllUsers } = require('../controllers/adminUserController');

// --- Test ---
router.get('/me', requireAdmin, (req, res) => {
  res.json({ ok: true, message: 'You are an admin', adminId: req.adminId, userId: req.userId });
});

// --- Account Codes ---
router.post('/account-codes', requireAdmin, generateAccountCode);
router.get('/account-codes', requireAdmin, listCodes);

// --- Departments ---
router.get('/departments', requireAdmin, listDepartments);
router.post('/departments', requireAdmin, createDepartment);
router.put('/departments/:id/toggle', requireAdmin, toggleDepartment);

// --- Offices ---
router.get('/offices', requireAdmin, listOffices);
router.post('/offices', requireAdmin, createOffice);
router.put('/offices/:id/toggle', requireAdmin, toggleOffice);

// --- Domains ---
router.get('/domains', requireAdmin, listDomains);
router.post('/domains', requireAdmin, addDomain);
router.put('/domains/:id/toggle', requireAdmin, toggleDomain);
router.delete('/domains/:id', requireAdmin, deleteDomain);

// --- Positions ---
router.get('/positions', requireAdmin, listPositions);
router.post('/positions', requireAdmin, createPosition);
router.put('/positions/:id/toggle', requireAdmin, togglePosition);
router.delete('/positions/:id', requireAdmin, deletePosition);
router.get('/positions/available', requireAdmin, availablePositions);

// --- Position Assignments ---
router.get('/position-assignments', requireAdmin, listAssignments);
router.put('/position-assignments/:id/remove', requireAdmin, removeAssignment);

// ─── User Management Routes (NEW) ─────────────────────
router.get('/users', requireAdmin, getAllUsers);

module.exports = router;