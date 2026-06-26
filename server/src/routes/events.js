const express = require('express');
const router = express.Router();
const { createEvent, listEvents } = require('../controllers/eventsController');
const { authenticate } = require('../middleware/auth');
const requireOfficials = require('../middleware/requireOfficials');

router.get('/', authenticate, listEvents);

router.post('/', authenticate, (req, res, next) => {
  const visibility = req.body.visibility;
  if (visibility === 'campus' || visibility === 'department') {
    return requireOfficials(req, res, next);
  }
  next();
}, createEvent);

module.exports = router;