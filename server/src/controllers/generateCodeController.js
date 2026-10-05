const { v4: uuidv4 } = require('uuid');
const { Sequelize, Op } = require('sequelize');
const {
  AccountCode, AccountCodeRequest, Department, Office, Role, Position, PositionAssignment,
  Admin, User
} = require('../models');
const {
  isRequestedCode,
  actionsAvailableAt,
  autoDeactivateAt,
  getActionBlock,
  deactivateStaleCodes,
} = require('../utils/accountCodeLifecycle');

function makePrefix(name) {
  if (!name) return 'NON';
  const cleaned = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'NON';
  if (parts.length === 1) return parts[0].substring(0, 3).toUpperCase();
  return parts.map(p => p[0]).join('').substring(0, 3).toUpperCase();
}

// ─── Admin generate account code ──────────────────────
exports.generateAccountCode = async (req, res) => {
  try {
    const { department_id, office_id, role_id, position_id, is_admin = false, expires_at } = req.body;

    let dept = null, office = null, role = null, pos = null;

    if (department_id) {
      dept = await Department.findByPk(department_id);
      if (!dept) return res.status(404).json({ ok: false, message: 'Department not found.' });
    }
    if (office_id) {
      office = await Office.findByPk(office_id);
      if (!office) return res.status(404).json({ ok: false, message: 'Office not found.' });
    }
    if (role_id) {
      role = await Role.findByPk(role_id);
      if (!role) return res.status(404).json({ ok: false, message: 'Role not found.' });
    }
    if (position_id) {
      pos = await Position.findByPk(position_id);
      if (!pos) return res.status(404).json({ ok: false, message: 'Position not found.' });
      if (!pos.is_active) return res.status(400).json({ ok: false, message: 'Position is inactive.' });
      if (!pos.allow_multiple) {
        const existingAssign = await PositionAssignment.findOne({
          where: { position_id, status: 'active' }
        });
        if (existingAssign) {
          return res.status(409).json({ ok: false, message: 'Position already assigned to another user.' });
        }
      }
    }

    const deptPrefix = makePrefix(dept?.name);
    const officePrefix = makePrefix(office?.name);
    const rolePrefix = makePrefix(role?.name);

    let created = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `${deptPrefix}-${officePrefix}-${rolePrefix}-${rand}`;
      try {
        created = await AccountCode.create({
          id: uuidv4(),
          code,
          department_id: dept?.id || null,
          office_id: office?.id || null,
          role_id: role?.id || null,
          position_id: pos?.id || null,
          is_admin: !!is_admin,
          generated_by_admin_id: req.adminId || null,
          status: 'unused',
          expires_at: expires_at ? new Date(expires_at) : null,
          source_type: 'admin_generated',
          account_code_request_id: null
        });
        break;
      } catch (err) {
        if (err instanceof Sequelize.UniqueConstraintError) continue;
        throw err;
      }
    }

    if (!created) {
      return res.status(500).json({ ok: false, message: 'Failed to generate unique account code.' });
    }

    res.status(201).json({ ok: true, account_code: created });
  } catch (error) {
    console.error('Generate account code error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── List all generated codes ─────────────────────────
exports.listCodes = async (req, res) => {
  try {
    // Make sure the list never shows a stale "unused" code older than 7 days
    try {
      await deactivateStaleCodes();
    } catch (err) {
      console.error('Auto-deactivate (list) failed:', err.message);
    }

    const codes = await AccountCode.findAll({
      order: [['created_at', 'DESC']],
      limit: 100,
      include: [
        {
          model: AccountCodeRequest,
          as: 'request',
          attributes: ['full_name', 'email']
        }
      ]
    });

    const resolved = await Promise.all(codes.map(async (code) => {
      let department = null, office = null, role = null, position = null, generatedBy = null;

      if (code.department_id) {
        const dept = await Department.findByPk(code.department_id);
        if (dept) department = dept.name;
      }
      if (code.office_id) {
        const off = await Office.findByPk(code.office_id);
        if (off) office = off.name;
      } else {
        office = '—';
      }
      if (code.role_id) {
        const rol = await Role.findByPk(code.role_id);
        if (rol) role = rol.name;
      } else {
        role = '—';
      }
      if (code.position_id) {
        const pos = await Position.findByPk(code.position_id);
        if (pos) position = pos.name;
      }

      if (code.generated_by_admin_id) {
        const admin = await Admin.findByPk(code.generated_by_admin_id, {
          attributes: ['user_id']
        });
        if (admin) {
          const user = await User.findByPk(admin.user_id, {
            attributes: ['username']
          });
          if (user) generatedBy = user.username;
        }
      }

      let requestedBy = null;
      if (code.request) {
        requestedBy = code.request.full_name || code.request.email;
      }

      // What can the admin do with this code right now? (server is the authority)
      const block = getActionBlock(code);

      return {
        id: code.id,
        code: code.code,
        is_admin: code.is_admin,
        status: code.status,
        created_at: code.created_at,
        department,
        office,
        role,
        position,
        generated_by: generatedBy,
        source_type: code.source_type,
        requested_by: requestedBy,
        // ─── Actions ─────────────────────────────────────
        can_deactivate: !block && code.status === 'unused',
        can_delete: !block,
        lock_reason: block ? block.message : null,
        actions_available_at: isRequestedCode(code) ? actionsAvailableAt(code) : null,
        auto_deactivate_at: code.status === 'unused' ? autoDeactivateAt(code) : null
      };
    }));

    res.json({ ok: true, codes: resolved });
  } catch (error) {
    console.error('List codes error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── Deactivate a code (unused -> inactive) ───────────
exports.deactivateCode = async (req, res) => {
  try {
    const code = await AccountCode.findByPk(req.params.id);
    if (!code) {
      return res.status(404).json({ ok: false, message: 'Account code not found.' });
    }

    const block = getActionBlock(code);
    if (block) {
      return res.status(block.status).json({ ok: false, message: block.message });
    }

    if (code.status === 'inactive') {
      return res.status(400).json({ ok: false, message: 'This account code is already inactive.' });
    }
    if (code.status !== 'unused') {
      return res.status(400).json({ ok: false, message: 'Only unused codes can be deactivated.' });
    }

    // Conditional update so a code that was just used can't be deactivated
    const [affected] = await AccountCode.update(
      { status: 'inactive' },
      { where: { id: code.id, status: 'unused' } }
    );
    if (!affected) {
      return res.status(409).json({ ok: false, message: 'This account code is no longer unused.' });
    }

    res.json({ ok: true, message: 'Account code deactivated.', id: code.id, status: 'inactive' });
  } catch (error) {
    console.error('Deactivate code error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── Hard delete a code ───────────────────────────────
exports.deleteCode = async (req, res) => {
  try {
    const code = await AccountCode.findByPk(req.params.id);
    if (!code) {
      return res.status(404).json({ ok: false, message: 'Account code not found.' });
    }

    const block = getActionBlock(code);
    if (block) {
      return res.status(block.status).json({ ok: false, message: block.message });
    }

    // Conditional delete so a code that was just used can't be deleted
    const deleted = await AccountCode.destroy({
      where: { id: code.id, status: { [Op.ne]: 'used' } }
    });
    if (!deleted) {
      return res.status(409).json({ ok: false, message: 'This account code was just used and cannot be deleted.' });
    }

    res.json({ ok: true, message: 'Account code deleted.' });
  } catch (error) {
    if (error instanceof Sequelize.ForeignKeyConstraintError) {
      return res.status(409).json({ ok: false, message: 'This account code is still referenced by another record.' });
    }
    console.error('Delete code error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};