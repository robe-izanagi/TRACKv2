const { AccountCodeRequest, Department, Office, Role, Position, Admin, User, PositionAssignment } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { generateUniqueCode } = require('../utils/codeGenerator');
const { sendAccountCodeEmail } = require('../services/emailService');

// ─── Public – Create request ──────────────────────────
exports.createRequest = async (req, res) => {
  try {
    const { email, full_name, department_id, office_id, role_id, position_id, description } = req.body;

    if (!email) {
      return res.status(400).json({ ok: false, message: 'Email is required.' });
    }

    const normalizedEmail = email.trim().toLowerCase();

    // Check if email already has a pending request
    const existingPending = await AccountCodeRequest.findOne({
      where: { email: normalizedEmail, status: 'pending' }
    });
    if (existingPending) {
      return res.status(409).json({ ok: false, message: 'You already have a pending request.' });
    }

    // Check if email already has an approved request
    const existingApproved = await AccountCodeRequest.findOne({
      where: { email: normalizedEmail, status: 'approved' }
    });
    if (existingApproved) {
      return res.status(409).json({ ok: false, message: 'This email already has an approved account code request.' });
    }

    //Check if email is already registered as a user
    const existingUser = await User.findOne({
      where: { email: normalizedEmail }
    });
    if (existingUser) {
      return res.status(409).json({ ok: false, message: 'Email already registered.' });
    }

    const request = await AccountCodeRequest.create({
      id: uuidv4(),
      email: normalizedEmail,
      full_name: full_name?.trim() || null,
      department_id: department_id || null,
      office_id: office_id || null,
      role_id: role_id || null,
      position_id: position_id || null,
      description: description || null,
      status: 'pending'
    });

    res.status(201).json({ ok: true, request });
  } catch (error) {
    console.error('Create code request error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── Admin – List all requests ─────────────────────────
exports.listRequests = async (req, res) => {
  try {
    const { status, search } = req.query;

    const where = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }
    if (search) {
      where[Op.or] = [
        { email: { [Op.like]: `%${search}%` } },
        { full_name: { [Op.like]: `%${search}%` } }
      ];
    }

    const requests = await AccountCodeRequest.findAll({
      where,
      order: [['created_at', 'DESC']]
    });

    // Manually fetch department, office, role, position names
    const enrichedRequests = await Promise.all(
      requests.map(async (req) => {
        const enriched = req.toJSON();

        if (req.department_id) {
          const dept = await Department.findByPk(req.department_id, { attributes: ['name'] });
          enriched.department_name = dept ? dept.name : null;
        } else {
          enriched.department_name = null;
        }

        if (req.office_id) {
          const office = await Office.findByPk(req.office_id, { attributes: ['name'] });
          enriched.office_name = office ? office.name : null;
        } else {
          enriched.office_name = null;
        }

        if (req.role_id) {
          const role = await Role.findByPk(req.role_id, { attributes: ['name'] });
          enriched.role_name = role ? role.name : null;
        } else {
          enriched.role_name = null;
        }

        if (req.position_id) {
          const position = await Position.findByPk(req.position_id, { attributes: ['name'] });
          enriched.position_name = position ? position.name : null;
        } else {
          enriched.position_name = null;
        }

        return enriched;
      })
    );

    res.json({ ok: true, requests: enrichedRequests });
  } catch (error) {
    console.error('List code requests error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── Admin – Get single request ────────────────────────
exports.getRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await AccountCodeRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ ok: false, message: 'Request not found.' });
    }
    res.json({ ok: true, request });
  } catch (error) {
    console.error('Get code request error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── Admin – Approve request ───────────────────────────
exports.approveRequest = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await AccountCodeRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ ok: false, message: 'Request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ ok: false, message: 'Request already reviewed.' });
    }

    // ─── Check if position is still available ──────────
    if (request.position_id) {
      const pos = await Position.findByPk(request.position_id);
      if (pos && !pos.allow_multiple) {
        // Check if this position is already assigned to someone
        const existingAssignment = await PositionAssignment.findOne({
          where: { position_id: request.position_id, status: 'active' }
        });
        if (existingAssignment) {
          // Auto-reject the request
          request.status = 'rejected';
          request.admin_notes = 'Position is already assigned to another user.';
          request.reviewed_by_admin_id = req.adminId;
          request.reviewed_at = new Date();
          await request.save();

          return res.json({
            ok: true,
            request,
            message: 'Request auto-rejected: position is already taken.'
          });
        }
      }
    }

    // Generate account code
    const code = await generateUniqueCode({
      department_id: request.department_id,
      office_id: request.office_id,
      role_id: request.role_id,
      position_id: request.position_id,
      is_admin: false,
      source_type: 'request_approved',
      account_code_request_id: request.id,
      generated_by_admin_id: req.adminId
    });

    request.status = 'approved';
    request.reviewed_by_admin_id = req.adminId;
    request.reviewed_at = new Date();
    request.generated_code = code.code;
    await request.save();

    res.json({
      ok: true,
      request,
      generated_code: code.code
    });
  } catch (error) {
    console.error('Approve request error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── Admin – Reject request ────────────────────────────
exports.rejectRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { admin_notes } = req.body;

    const request = await AccountCodeRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ ok: false, message: 'Request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ ok: false, message: 'Request already reviewed.' });
    }

    request.status = 'rejected';
    request.admin_notes = admin_notes || null;
    request.reviewed_by_admin_id = req.adminId;
    request.reviewed_at = new Date();
    await request.save();

    res.json({ ok: true, request });
  } catch (error) {
    console.error('Reject request error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── Admin – Send code email ───────────────────────────
exports.sendCodeEmail = async (req, res) => {
  try {
    const { id } = req.params;

    const request = await AccountCodeRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ ok: false, message: 'Request not found.' });
    }

    if (request.status !== 'approved' || !request.generated_code) {
      return res.status(400).json({ ok: false, message: 'No code to send.' });
    }

    await sendAccountCodeEmail({
      email: request.email,
      full_name: request.full_name,
      code: request.generated_code
    });

    request.code_sent_at = new Date();
    await request.save();

    res.json({ ok: true, message: 'Code sent successfully.' });
  } catch (error) {
    console.error('Send code email error:', error);
    res.status(500).json({
      ok: false,
      message: error.message || 'Failed to send email. Please check SMTP configuration.'
    });
  }
};