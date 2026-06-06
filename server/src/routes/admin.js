const express = require('express');
const router = express.Router();
const { requireAdmin } = require('../middleware/auth');
const { listRequests, getRequest, reviewRequest } = require('../controllers/accountCodeRequestsController');
const { generateAccountCode, listCodes } = require('../controllers/generateCode');

router.get('/me', requireAdmin, (req, res) => {
  res.json({ ok: true, message: 'You are an admin', adminId: req.adminId, userId: req.userId });
});

// Account codes
router.post('/account-codes', requireAdmin, generateAccountCode);
router.get('/account-codes', requireAdmin, listCodes);

// Code requests (admin side)
router.get('/code-requests', requireAdmin, listRequests);
router.get('/code-requests/:id', requireAdmin, getRequest);
router.post('/code-requests/:id/review', requireAdmin, reviewRequest);

module.exports = router;