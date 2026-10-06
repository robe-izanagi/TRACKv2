// src/routes/adminAnalytics.js — mounted at /admin/analytics behind requireAdmin (see routes/admin.js)
const express = require('express');
const router = express.Router();
const c = require('../controllers/adminAnalyticsController');

router.get('/overview', c.getOverview);
router.get('/users', c.getUserActivity);
router.get('/requests', c.getRequestAnalytics);
router.get('/login-security', c.getLoginSecurity);
router.get('/risk-summary', c.getRiskSummary);
router.get('/risk/users/:userId', c.getUserRisk);
router.get('/recommendations/requests/:type/:id', c.getRequestRecommendation);

module.exports = router;