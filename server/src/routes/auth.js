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

// List users (for Invite Attendees modal)
router.get('/users', authenticate, async (req, res) => {
  try {
    const { department_id, exclude_admins } = req.query;

    // Build the initial where clause for users
    const where = {};

    // If a department is specified, restrict to users in that department
    if (department_id) {
      const profiles = await UserProfile.findAll({
        where: { department_id },
        attributes: ['user_id']
      });
      const userIds = profiles.map(p => p.user_id);
      where.id = userIds;
    }

    // Exclude admin users if requested (exclude_admins=true)
    if (exclude_admins === 'true') {
      const adminUsers = await Admin.findAll({ attributes: ['user_id'] });
      const adminIds = adminUsers.map(a => a.user_id);
      if (where.id) {
        // Filter out admin IDs from the existing list
        where.id = { [Op.in]: where.id, [Op.notIn]: adminIds };
      } else {
        // Exclude all admin IDs
        where.id = { [Op.notIn]: adminIds };
      }
    }

    const users = await User.findAll({
      where,
      attributes: ['id', 'email', 'username'],
      include: [
        {
          model: UserProfile,
          attributes: ['full_name', 'department_id', 'office_id', 'position_id'],
          include: [
            { model: Department, attributes: ['id', 'name'] },
            { model: Office, attributes: ['id', 'name'] },
            { model: Position, attributes: ['id', 'name'] }
          ]
        }
      ]
    });

    const result = users.map(user => ({
      id: user.id,
      email: user.email,
      name: user.UserProfile?.full_name || user.username || user.email,
      department: user.UserProfile?.Department?.name || null,
      department_id: user.UserProfile?.department_id || null,
      office: user.UserProfile?.Office?.name || null,
      office_id: user.UserProfile?.office_id || null,
      position: user.UserProfile?.Position?.name || null,
    }));

    res.json({ ok: true, users: result });
  } catch (error) {
    console.error('List users error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
});

module.exports = router;