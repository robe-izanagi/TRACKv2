const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const requireOfficials = require('../middleware/requireOfficials');
const {
  createEvent,
  listEvents,
  getEventStats,
  getTodayEvent,
  getUpcomingEvents
} = require('../controllers/eventsController');

router.get('/', authenticate, listEvents);
router.get('/stats', authenticate, getEventStats);
router.get('/today', authenticate, getTodayEvent);
router.get('/upcoming', authenticate, getUpcomingEvents);

router.post('/', authenticate, (req, res, next) => {
  const visibility = req.body.visibility;
  if (visibility === 'campus' || visibility === 'department') {
    return requireOfficials(req, res, next);
  }
  next();
}, createEvent);

module.exports = router;