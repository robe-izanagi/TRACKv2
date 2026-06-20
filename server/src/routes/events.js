const express = require('express');
const router = express.Router();
const { createEvent } = require('../controllers/eventsController');
const { authenticate } = require('../middleware/auth');
const requireOfficials = require('../middleware/requireOfficials');

// All authenticated users can create a PRIVATE event.
// Campus & Department events require the 'officials' role.
router.post('/', authenticate, (req, res, next) => {
  const visibility = req.body.visibility;
  if (visibility === 'campus' || visibility === 'department') {
    return requireOfficials(req, res, next);
  }
  // staff & faculty – only private events allowed (already enforced by the UI, but server checks too)
  next();
}, createEvent);

module.exports = router;