const express = require('express');
const router = express.Router();
const { uploadAttachments } = require('../controllers/attachmentController');
const { authenticate } = require('../middleware/auth');
const upload = require('../config/upload');

// POST /api/attachments/event/:id   or   /api/attachments/task/:id
router.post('/:entity_type/:entity_id', authenticate, upload.array('files', 10), uploadAttachments);

module.exports = router;