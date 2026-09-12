const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const { submitFeedback } = require('../controllers/feedbackController');

router.post('/', authenticate, submitFeedback);

module.exports = router;