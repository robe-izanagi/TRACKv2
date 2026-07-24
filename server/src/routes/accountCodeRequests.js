const express = require('express');
const router = express.Router();
const {
  createRequest,
  listRequests,
  getRequest,
  approveRequest,
  rejectRequest,
  sendCodeEmail
} = require('../controllers/accountCodeRequestsController');

const { requireAdmin } = require('../middleware/auth');

// ─── Public ─────────────────────────────────────────────
router.post('/', createRequest);

// ─── Admin ──────────────────────────────────────────────
router.get('/', requireAdmin, listRequests);
router.get('/:id', requireAdmin, getRequest);
router.post('/:id/approve', requireAdmin, approveRequest);
router.post('/:id/reject', requireAdmin, rejectRequest);
router.post('/:id/send-code', requireAdmin, sendCodeEmail);

module.exports = router;