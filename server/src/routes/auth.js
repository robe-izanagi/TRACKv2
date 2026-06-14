const express = require('express');
const router = express.Router();
const { login, register } = require('../controllers/authController');
const {
  googleLoginUrl,
  googleCallback,
  completeGoogleRegistration
} = require('../controllers/googleAuthController');

// Local admin login
router.post('/login', login);
router.post('/register', register);   // (old registration, may be unused later)

// Google SSO
router.get('/google', googleLoginUrl);
router.get('/google/callback', googleCallback);
router.post('/complete-google-registration', completeGoogleRegistration);

router.get('/me', require('../middleware/auth').authenticate, async (req, res) => {
  try {
    const { User, UserProfile, Department, Office, Role } = require('../models');
    const user = await User.findByPk(req.userId, {
      include: [{ model: UserProfile, include: [Department, Office, Role] }]
    });
    if (!user) return res.status(404).json({ ok: false, message: 'User not found.' });
    res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        role: user.UserProfile?.Role?.name,
        department: user.UserProfile?.Department?.name,
        office: user.UserProfile?.Office?.name
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

module.exports = router;