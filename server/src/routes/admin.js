const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { adminRegisterLimiter } = require('../middleware/rateLimiter');
const { registerAdmin } = require('../controllers/adminAuthController');
const { generateAccountCode, listCodes } = require('../controllers/generateCodeController');
const {
  listDepartments,
  createDepartment,
  toggleDepartment,
  deleteDepartment,
  updateDepartment,
  listOffices,
  createOffice,
  toggleOffice,
  deleteOffice,
  updateOffice,
} = require('../controllers/setupController');
const {
  listDomains,
  addDomain,
  toggleDomain,
  deleteDomain,
  updateDomain,
} = require('../controllers/domainController');
const {
  list: listPositions,
  create: createPosition,
  toggle: togglePosition,
  delete: deletePosition,
  available: availablePositions,
  reorder: reorderPositions,
  update: updatePosition,
  combine: combinePositions
} = require('../controllers/positionsController');
const {
  listAssignments,
  removeAssignment
} = require('../controllers/positionAssignmentsController');

const { getAllUsers, toggleBlockUser, deleteUser } = require('../controllers/adminUserController');
const { getFeedbackSummary, getTextMining, listFeedback } = require('../controllers/feedbackController');

const {
  listChangeRequests,
  approveChangeRequest,
  rejectChangeRequest,
} = require('../controllers/adminProfileRequestsController');

// --- Admin Registration (public — gated by account code + rate limit, no token required) ---
router.post('/register', adminRegisterLimiter, registerAdmin);

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

router.delete('/departments/:id', requireAdmin, deleteDepartment);
router.put('/departments/:id', requireAdmin, updateDepartment);
router.delete('/offices/:id', requireAdmin, deleteOffice);
router.put('/offices/:id', requireAdmin, updateOffice);
router.put('/domains/:id', requireAdmin, updateDomain);

// --- Positions ---
router.get('/positions', requireAdmin, listPositions);
router.post('/positions', requireAdmin, createPosition);
router.put('/positions/:id/toggle', requireAdmin, togglePosition);
router.delete('/positions/:id', requireAdmin, deletePosition);
router.get('/positions/available', requireAdmin, availablePositions);
router.put('/positions/reorder', requireAdmin, reorderPositions);
router.put('/positions/:id', requireAdmin, updatePosition);
router.post('/positions/:id/combine', requireAdmin, combinePositions);

// --- Position Assignments ---
router.get('/position-assignments', requireAdmin, listAssignments);
router.put('/position-assignments/:id/remove', requireAdmin, removeAssignment);

// ─── User Management ─────────────────────────────
router.get('/users', requireAdmin, getAllUsers);
router.put('/users/:id/toggle-block', requireAdmin, toggleBlockUser);
router.delete('/users/:id', requireAdmin, deleteUser);

// ─── Profile Change Requests ──────────────────────
router.get('/profile-change-requests', requireAdmin, listChangeRequests);
router.put('/profile-change-requests/:id/approve', requireAdmin, approveChangeRequest);
router.put('/profile-change-requests/:id/reject', requireAdmin, rejectChangeRequest);


// ─── Feedback (Text Mining Dashboard) ───────────────
router.get('/feedback/summary', requireAdmin, getFeedbackSummary);
router.get('/feedback/text-mining', requireAdmin, getTextMining);
router.get('/feedback', requireAdmin, listFeedback);

module.exports = router;