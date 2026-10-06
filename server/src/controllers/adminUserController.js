const { Op } = require('sequelize');
const {
  sequelize, User, UserProfile, Department, Office, Role,
  EventAttendee, EventCollaborator, TaskAssignee, TaskCollaborator,
  TaskChecklistComment, TaskChecklistItem, PositionAssignment,
  Notification, AccountCode, Admin, UserSession,
} = require('../models');
const A = require('../utils/auditActions');
const { logAudit, maskEmail } = require('../utils/auditLogger');

// ─── GET ALL USERS WITH FILTERS ──────────────────────
exports.getAllUsers = async (req, res) => {
  try {
    const { search, status, department_id, office_id, role_id } = req.query;

    const userWhere = {};
    if (status) {
      userWhere.status = status;
    }

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

    const users = await User.findAll({
      where: userWhere,
      attributes: ['id', 'email', 'username', 'status', 'created_at'],
      order: [['created_at', 'DESC']]
    });

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

// ─── BLOCK / UNBLOCK USER (toggle) ────────────────────
// Setting status to 'blocked' prevents login (loginAdmin/user login controller
// checks this). Also revokes any active sessions so the block is effective
// immediately, not just on the next login attempt.
exports.toggleBlockUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) return res.status(404).json({ ok: false, message: 'User not found.' });

    if (user.status === 'blocked') {
      user.status = 'active';
      await user.save();
      await logAudit({
        req, targetUserId: user.id, actionType: A.USER_UNBLOCKED,
        entityTable: 'users', entityId: user.id, description: 'Admin unblocked a user',
        metadata: { target_username: user.username, target_email: maskEmail(user.email) },
      });
      return res.json({ ok: true, message: 'User has been unblocked.', status: 'active' });
    }

    user.status = 'blocked';
    await user.save();

    try {
      await UserSession.update(
        { status: 'revoked' },
        { where: { user_id: id, status: 'active' } }
      );
    } catch (sessionErr) {
      console.error('Failed to revoke sessions on block (non-fatal):', sessionErr);
    }

    await logAudit({
      req, targetUserId: user.id, actionType: A.USER_BLOCKED,
      entityTable: 'users', entityId: user.id, description: 'Admin blocked a user',
      metadata: { target_username: user.username, target_email: maskEmail(user.email) },
    });

    res.json({ ok: true, message: 'User has been blocked.', status: 'blocked' });
  } catch (error) {
    console.error('Toggle block user error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── DELETE USER (cascading — removes their own records) ──
// Events/tasks the user CREATED are intentionally left in place (deleting
// them would wipe other attendees' calendars too) — creator_id becomes an
// orphaned reference, handled gracefully elsewhere ("Unknown" fallback).
// Position assignment is deleted outright, so a single-occupancy position
// becomes available again for other users immediately.
exports.deleteUser = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;
    const user = await User.findByPk(id);
    if (!user) {
      await t.rollback();
      return res.status(404).json({ ok: false, message: 'User not found.' });
    }

    // ── If these Event/Task models don't exist in this backend's models/index.js,
    // remove this block — the rest of the deletion (below) still works fine. ──
    if (EventAttendee) await EventAttendee.destroy({ where: { user_id: id }, transaction: t });
    if (EventCollaborator) await EventCollaborator.destroy({ where: { user_id: id }, transaction: t });
    if (TaskAssignee) await TaskAssignee.destroy({ where: { user_id: id }, transaction: t });
    if (TaskCollaborator) await TaskCollaborator.destroy({ where: { user_id: id }, transaction: t });
    if (TaskChecklistComment) await TaskChecklistComment.destroy({ where: { user_id: id }, transaction: t });
    if (TaskChecklistItem) {
      await TaskChecklistItem.update(
        { completed_by_user_id: null, completed_at: null },
        { where: { completed_by_user_id: id }, transaction: t }
      );
    }
    if (PositionAssignment) await PositionAssignment.destroy({ where: { user_id: id }, transaction: t });
    if (Notification) await Notification.destroy({ where: { user_id: id }, transaction: t });
    if (AccountCode) {
      await AccountCode.update(
        { used_by_user_id: null },
        { where: { used_by_user_id: id }, transaction: t }
      );
    }
    if (Admin) await Admin.destroy({ where: { user_id: id }, transaction: t });
    if (UserSession) {
      try {
        await UserSession.destroy({ where: { user_id: id }, transaction: t });
      } catch (sessionErr) {
        console.error('Failed to clear sessions on delete (non-fatal):', sessionErr);
      }
    }

    await logAudit({
      req, targetUserId: user.id, actionType: A.ADMIN_DELETED_USER,
      entityTable: 'users', entityId: user.id, description: 'Admin permanently deleted a user',
      metadata: { target_username: user.username, target_email: maskEmail(user.email) },
      transaction: t,
    });

    await UserProfile.destroy({ where: { user_id: id }, transaction: t });
    await user.destroy({ transaction: t });

    await t.commit();
    res.json({ ok: true, message: 'User and all their records have been permanently deleted.' });
  } catch (error) {
    await t.rollback();
    console.error('Delete user error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};