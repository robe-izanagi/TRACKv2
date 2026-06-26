const express = require('express');
const router = express.Router();
const { login, register } = require('../controllers/authController');
const {
  googleLoginUrl,
  googleCallback,
  completeGoogleRegistration
} = require('../controllers/googleAuthController');

const { authenticate } = require('../middleware/auth');
const { User, UserProfile, Department, Office, Role, Admin, Position } = require('../models');
const { Op } = require('sequelize');

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

    const profile = await UserProfile.findByPk(req.userId);
    let role = null,
      department = null,
      office = null,
      fullName = null;

    if (profile) {
      fullName = profile.full_name;
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
        office,
        full_name: fullName
      }
    });
  } catch (error) {
    console.error('Get me error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

// List users (for Invite Attendees modal) – uses manual fetching
router.get('/users', authenticate, async (req, res) => {
  try {
    const { department_id, exclude_admins } = req.query;

    // Get all non‑admin user IDs if needed
    let userIds = null;
    if (exclude_admins === 'true') {
      const adminUsers = await Admin.findAll({ attributes: ['user_id'] });
      const adminIds = adminUsers.map(a => a.user_id);
      const allProfiles = await UserProfile.findAll({ attributes: ['user_id'] });
      userIds = allProfiles
        .map(p => p.user_id)
        .filter(id => !adminIds.includes(id));
    }

    // If a department_id is given, filter further
    if (department_id) {
      const deptProfiles = await UserProfile.findAll({
        where: { department_id },
        attributes: ['user_id']
      });
      const deptUserIds = deptProfiles.map(p => p.user_id);
      if (userIds) {
        userIds = userIds.filter(id => deptUserIds.includes(id));
      } else {
        userIds = deptUserIds;
      }
    }

    // Fetch users (either filtered or all)
    const where = userIds ? { id: userIds } : {};
    const users = await User.findAll({
      where,
      attributes: ['id', 'email', 'username']
    });

    // Manually build the response with profile data
    const result = [];
    for (const user of users) {
      const profile = await UserProfile.findByPk(user.id);
      let department = null,
        departmentId = null,
        office = null,
        officeId = null,
        position = null,
        fullName = null;

      if (profile) {
        fullName = profile.full_name;
        departmentId = profile.department_id;
        officeId = profile.office_id;

        if (profile.department_id) {
          const dept = await Department.findByPk(profile.department_id);
          if (dept) department = dept.name;
        }
        if (profile.office_id) {
          const off = await Office.findByPk(profile.office_id);
          if (off) office = off.name;
        }
        if (profile.position_id) {
          const pos = await Position.findByPk(profile.position_id);
          if (pos) position = pos.name;
        }
      }

      result.push({
        id: user.id,
        email: user.email,
        name: fullName || user.username || user.email,
        department,
        department_id: departmentId,
        office,
        office_id: officeId,
        position,
      });
    }

    res.json({ ok: true, users: result });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

module.exports = router;