const express = require('express');
const router = express.Router();
const {
  createRequest,
  listRequests,
  getRequest,
  reviewRequest
} = require('../controllers/accountCodeRequestsController');

const { requireAdmin } = require('../middleware/auth');

router.post('/', createRequest);
router.get('/', requireAdmin, listRequests);
router.get('/:id', requireAdmin, getRequest);
router.post('/:id/review', requireAdmin, reviewRequest);

module.exports = router;
