const express = require('express');
const router = express.Router();
const { login, register } = require('../controllers/authController');
const {
  googleLoginUrl,
  googleCallback,
  completeGoogleRegistration
} = require('../controllers/googleAuthController');

const { authenticate } = require('../middleware/auth');
const { User, UserProfile, Department, Office, Role } = require('../models');

// Local admin login
router.post('/login', login);
router.post('/register', register);

// Google SSO
router.get('/google', googleLoginUrl);
router.get('/google/callback', googleCallback);
router.post('/complete-google-registration', completeGoogleRegistration);

// Get current authenticated user
router.get('/me', authenticate, async (req, res) => {
  try {
    const user = await User.findByPk(req.userId, {
      attributes: ['id', 'email', 'status']
    });
    if (!user) return res.status(404).json({ ok: false, message: 'User not found.' });

    // Manually fetch the profile and lookups
    const profile = await UserProfile.findByPk(req.userId);
    let role = null,
        department = null,
        office = null;

    if (profile) {
      if (profile.role_id) {
        const roleObj = await Role.findByPk(profile.role_id);
        if (roleObj) role = roleObj.name;
      }
      if (profile.department_id) {
        const deptObj = await Department.findByPk(profile.department_id);
        if (deptObj) department = deptObj.name;
      }
      if (profile.office_id) {
        const officeObj = await Office.findByPk(profile.office_id);
        if (officeObj) office = officeObj.name;
      }
    }

    res.json({
      ok: true,
      user: {
        id: user.id,
        email: user.email,
        status: user.status,
        role,
        department,
        office
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

// ── New endpoint for Invite Attendees ─────────────────
router.get('/users', authenticate, async (req, res) => {
  try {
    const { department_id } = req.query;
    const whereProfile = {};
    if (department_id) {
      whereProfile.department_id = department_id;
    }

    const profiles = await UserProfile.findAll({
      where: whereProfile,
      include: [
        { model: User, attributes: ['id', 'email', 'username'] },
        { model: Department, attributes: ['id', 'name'] }
      ]
    });

    const users = profiles.map(profile => ({
      id: profile.User.id,
      email: profile.User.email,
      name: profile.User.username || profile.User.email,
      department: profile.Department ? profile.Department.name : null,
    }));

    res.json({ ok: true, users });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

module.exports = router;