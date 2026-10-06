// src/routes/adminAuditLogs.js — mounted at /admin/audit-logs behind requireAdmin (see routes/admin.js)
const express = require('express');
const router = express.Router();
const c = require('../controllers/auditLogController');

// static paths first so they are not captured by any future /:id route
router.get('/summary', c.getAuditSummary);
router.get('/action-types', c.getActionTypes);
router.get('/', c.listAuditLogs);

module.exports = router;