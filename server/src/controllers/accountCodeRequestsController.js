const { AccountCodeRequest, Department, Office, Role, Position, Admin, User } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { generateUniqueCode } = require('../utils/codeGenerator');
const { sendAccountCodeEmail } = require('../services/emailService');

// ─── Public – Create request (with Google SSO) ────────
exports.createRequest = async (req, res) => {
  try {
    const { email, full_name, department_id, office_id, role_id, position_id, description } = req.body;

    if (!email) {
      return res.status(400).json({ ok: false, message: 'Email is required.' });
    }

    // Check if email already has a pending request
    const existing = await AccountCodeRequest.findOne({
      where: { email: email.trim().toLowerCase(), status: 'pending' }
    });
    if (existing) {
      return res.status(409).json({ ok: false, message: 'You already have a pending request.' });
    }

    const request = await AccountCodeRequest.create({
      id: uuidv4(),
      email: email.trim().toLowerCase(),
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
      include: [
        { model: Department, attributes: ['id', 'name'] },
        { model: Office, attributes: ['id', 'name'] },
        { model: Role, attributes: ['id', 'name'] },
        { model: Position, attributes: ['id', 'name'] },
        { model: Admin, attributes: ['id'] }
      ],
      order: [['created_at', 'DESC']]
    });

    res.json({ ok: true, requests });
  } catch (error) {
    console.error('List code requests error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── Admin – Get single request ────────────────────────
exports.getRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await AccountCodeRequest.findByPk(id, {
      include: [
        { model: Department, attributes: ['id', 'name'] },
        { model: Office, attributes: ['id', 'name'] },
        { model: Role, attributes: ['id', 'name'] },
        { model: Position, attributes: ['id', 'name'] }
      ]
    });

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

    // Generate account code
    const code = await generateUniqueCode({
      department_id: request.department_id,
      office_id: request.office_id,
      role_id: request.role_id,
      position_id: request.position_id,
      is_admin: false
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
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};