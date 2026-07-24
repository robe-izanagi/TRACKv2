const { Op } = require('sequelize');
const { User, UserProfile, Department, Office, Role } = require('../models');

// ─── GET ALL USERS WITH FILTERS ──────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const { search, status, department_id, office_id, role_id } = req.query;

    // Build where clause for users
    const userWhere = {};
    if (status) {
      userWhere.status = status;
    }

    // If search is provided, find users by username or email
    let userIds = null;
    if (search) {
      const searchUsers = await User.findAll({
        where: {
          [Op.or]: [
            { username: { [Op.like]: `%${search}%` } },
            { email: { [Op.like]: `%${search}%` } }
          ]
        },
        attributes: ['id']
      });
      userIds = searchUsers.map(u => u.id);

      if (userIds.length === 0) {
        return res.json({ ok: true, users: [] });
      }
      userWhere.id = { [Op.in]: userIds };
    }

    // Get all users with filters
    const users = await User.findAll({
      where: userWhere,
      attributes: ['id', 'email', 'username', 'status', 'created_at'],
      order: [['created_at', 'DESC']]
    });

    // Manually fetch profile data for each user
    const result = [];
    for (const user of users) {
      const profile = await UserProfile.findOne({
        where: { user_id: user.id }
      });

      let department = null, office = null, role = null, fullName = null;
      let departmentId = null, officeId = null, roleId = null;
      let displayPicture = null;

      if (profile) {
        fullName = profile.full_name;
        displayPicture = profile.display_picture;
        departmentId = profile.department_id;
        officeId = profile.office_id;
        roleId = profile.role_id;

        if (profile.department_id) {
          const dept = await Department.findByPk(profile.department_id);
          if (dept) department = dept.name;
        }
        if (profile.office_id) {
          const off = await Office.findByPk(profile.office_id);
          if (off) office = off.name;
        }
        if (profile.role_id) {
          const r = await Role.findByPk(profile.role_id);
          if (r) role = r.name;
        }
      }

      // Apply filters on profile fields
      if (department_id && departmentId !== department_id) continue;
      if (office_id && officeId !== office_id) continue;
      if (role_id && roleId !== role_id) continue;

      result.push({
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status,
        full_name: fullName,
        display_picture: displayPicture,
        department,
        department_id: departmentId,
        office,
        office_id: officeId,
        role,
        role_id: roleId,
        created_at: user.created_at
      });
    }

    res.json({ ok: true, users: result });
  } catch (error) {
    console.error('Get all users error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};