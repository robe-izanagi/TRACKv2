const express = require('express');
const router = express.Router();
const { authenticate } = require('../middleware/auth');
const requireHeadsRole = require('../middleware/requireOfficials');
const {
  createEvent,
  listEvents,
  getEventStats,
  getTodayEvent,
  getUpcomingEvents,
  getCollaborationEvents,
  getEventById,
  updateEvent, listArchivedEvents, archiveEvent, deleteEvent,
} = require('../controllers/eventsController');

router.get('/', authenticate, listEvents);
router.get('/archived', authenticate, listArchivedEvents);
router.patch('/:id/archive', authenticate, archiveEvent);
router.delete('/:id', authenticate, deleteEvent);
router.get('/stats', authenticate, getEventStats);
router.get('/today', authenticate, getTodayEvent);
router.get('/upcoming', authenticate, getUpcomingEvents);
router.get('/collaborations', authenticate, getCollaborationEvents);
router.get('/:id', authenticate, getEventById);
router.put('/:id', authenticate, updateEvent); 

router.post('/', authenticate, (req, res, next) => {
  const visibility = req.body.visibility;
  if (visibility === 'campus' || visibility === 'department') {
    return requireHeadsRole(req, res, next);
  }
  next();
}, createEvent);

module.exports = router;