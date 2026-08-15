const {
  sequelize, ProfileChangeRequest, UserProfile, User,
  Department, Office, Role, Position, PositionAssignment, Notification
} = require('../models');
const { v4: uuidv4 } = require('uuid');

const CHANGE_LABELS = {
  department_change: 'Department Change',
  office_change: 'Office Change',
  role_update: 'Role Update',
  position_update: 'Position Update',
};

async function resolveName(model, id) {
  if (!id) return null;
  const record = await model.findByPk(id);
  return record ? record.name : null;
}

async function enrichRequest(request) {
  const user = await User.findByPk(request.user_id, { attributes: ['id', 'username', 'email'] });
  const profile = await UserProfile.findOne({ where: { user_id: request.user_id } });

  const [
    currentDepartment, currentOffice, currentRole, currentPosition,
    requestedDepartment, requestedOffice, requestedRole, requestedPosition,
  ] = await Promise.all([
    resolveName(Department, profile?.department_id),
    resolveName(Office, profile?.office_id),
    resolveName(Role, profile?.role_id),
    resolveName(Position, profile?.position_id),
    resolveName(Department, request.requested_department_id),
    resolveName(Office, request.requested_office_id),
    resolveName(Role, request.requested_role_id),
    resolveName(Position, request.requested_position_id),
  ]);

  let reviewedByName = null;
  if (request.reviewed_by_admin_id) {
    const { Admin } = require('../models');
    const admin = await Admin.findByPk(request.reviewed_by_admin_id);
    if (admin) {
      const adminUser = await User.findByPk(admin.user_id, { attributes: ['username'] });
      reviewedByName = adminUser?.username || null;
    }
  }

  return {
    id: request.id,
    status: request.status,
    changes: request.changes,
    changeLabels: (request.changes || []).map((c) => CHANGE_LABELS[c] || c),
    details: request.details,
    created_at: request.created_at,
    reviewed_at: request.reviewed_at,
    reviewed_by: reviewedByName,
    user: {
      id: user?.id,
      username: user?.username,
      email: user?.email,
      full_name: profile?.full_name || user?.username,
    },
    current: {
      department: currentDepartment,
      office: currentOffice,
      role: currentRole,
      position: currentPosition,
    },
    requested: {
      department_id: request.requested_department_id,
      department: requestedDepartment,
      office_id: request.requested_office_id,
      office: requestedOffice,
      role_id: request.requested_role_id,
      role: requestedRole,
      position_id: request.requested_position_id,
      position: requestedPosition,
    },
  };
}

// ─── LIST ───────────────────────────────────────────────
exports.listChangeRequests = async (req, res) => {
  try {
    const { status = 'pending' } = req.query;
    const where = {};
    if (status !== 'all') where.status = status;

    const requests = await ProfileChangeRequest.findAll({
      where,
      order: [['created_at', 'DESC']],
    });

    const enriched = await Promise.all(requests.map(enrichRequest));
    res.json({ ok: true, requests: enriched });
  } catch (error) {
    console.error('List profile change requests error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── APPROVE ────────────────────────────────────────────
exports.approveChangeRequest = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { id } = req.params;

    const request = await ProfileChangeRequest.findByPk(id);
    if (!request) {
      await t.rollback();
      return res.status(404).json({ ok: false, message: 'Request not found.' });
    }
    if (request.status !== 'pending') {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'This request has already been reviewed.' });
    }

    let profile = await UserProfile.findOne({ where: { user_id: request.user_id }, transaction: t });
    if (!profile) {
      await t.rollback();
      return res.status(404).json({ ok: false, message: 'User profile not found.' });
    }

    const changes = request.changes || [];
    const updates = {};

    if (changes.includes('department_change')) {
      updates.department_id = request.requested_department_id;
    }
    if (changes.includes('office_change')) {
      updates.office_id = request.requested_office_id;
    }
    if (changes.includes('role_update')) {
      updates.role_id = request.requested_role_id;
    }
    if (changes.includes('position_update')) {
      updates.position_id = request.requested_position_id;

      // Deactivate the user's current active position assignment(s), then
      // create a fresh active assignment for the newly-approved position.
      await PositionAssignment.update(
        { status: 'inactive', updated_at: new Date() },
        { where: { user_id: request.user_id, status: 'active' }, transaction: t }
      );
      await PositionAssignment.create({
        id: uuidv4(),
        position_id: request.requested_position_id,
        user_id: request.user_id,
        status: 'active',
      }, { transaction: t });
    }

    if (Object.keys(updates).length > 0) {
      await profile.update(updates, { transaction: t });
    }

    request.status = 'approved';
    request.reviewed_by_admin_id = req.adminId;
    request.reviewed_at = new Date();
    await request.save({ transaction: t });

    await t.commit();

    try {
      await Notification.create({
        id: uuidv4(),
        user_id: request.user_id,
        type: 'profile_change_approved',
        title: 'Profile Change Approved',
        message: 'Your profile change request has been approved. Click this notification to apply it to your account.',
        is_read: false,
      });
    } catch (notifErr) {
      console.error('Failed to create approval notification:', notifErr);
    }

    res.json({ ok: true, message: 'Request approved and applied.' });
  } catch (error) {
    await t.rollback();
    console.error('Approve profile change request error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── REJECT ─────────────────────────────────────────────
exports.rejectChangeRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;

    const request = await ProfileChangeRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ ok: false, message: 'Request not found.' });
    }
    if (request.status !== 'pending') {
      return res.status(400).json({ ok: false, message: 'This request has already been reviewed.' });
    }

    request.status = 'rejected';
    request.reviewed_by_admin_id = req.adminId;
    request.reviewed_at = new Date();
    await request.save();

    try {
      await Notification.create({
        id: uuidv4(),
        user_id: request.user_id,
        type: 'profile_change_rejected',
        title: 'Profile Change Rejected',
        message: reason
          ? `Your profile change request was not approved. Reason: ${reason}`
          : 'Your profile change request was not approved.',
        is_read: false,
      });
    } catch (notifErr) {
      console.error('Failed to create rejection notification:', notifErr);
    }

    res.json({ ok: true, message: 'Request rejected.' });
  } catch (error) {
    console.error('Reject profile change request error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};