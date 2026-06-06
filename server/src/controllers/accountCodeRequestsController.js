const { AccountCodeRequest, Department, Office, Role, Admin } = require('../models');

// Public – anyone can submit a code request
exports.createRequest = async (req, res) => {
  try {
    const { full_name, email, department_id, office_id, role_id, description } = req.body;

    if (!full_name || !email) {
      return res.status(400).json({ ok: false, message: 'Full name and email are required.' });
    }

    const request = await AccountCodeRequest.create({
      full_name: full_name.trim(),
      email: email.trim().toLowerCase(),
      department_id: department_id || null,
      office_id: office_id || null,
      role_id: role_id || null,
      description: description || null,
      status: 'pending'
    });

    res.status(201).json({ ok: true, request });
  } catch (error) {
    console.error('Create code request error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// Admin – list all code requests
exports.listRequests = async (req, res) => {
  try {
    const { status, page = 1, limit = 50 } = req.query;
    const where = {};
    if (status && ['pending', 'approved', 'rejected'].includes(status)) {
      where.status = status;
    }

    const pageNum = Math.max(parseInt(page, 10), 1);
    const limitNum = Math.min(parseInt(limit, 10), 100);
    const offset = (pageNum - 1) * limitNum;

    const { count, rows } = await AccountCodeRequest.findAndCountAll({
      where,
      include: [
        { model: Department, attributes: ['id', 'name'] },
        { model: Office, attributes: ['id', 'name'] },
        { model: Role, attributes: ['id', 'name'] },
        { model: Admin, attributes: ['id', 'user_id'] }
      ],
      order: [['created_at', 'DESC']],
      limit: limitNum,
      offset
    });

    res.json({
      ok: true,
      total: count,
      page: pageNum,
      per_page: limitNum,
      requests: rows
    });
  } catch (error) {
    console.error('List code requests error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// Admin – get single request
exports.getRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const request = await AccountCodeRequest.findByPk(id, {
      include: [
        { model: Department, attributes: ['id', 'name'] },
        { model: Office, attributes: ['id', 'name'] },
        { model: Role, attributes: ['id', 'name'] },
        { model: Admin, attributes: ['id', 'user_id'] }
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

// Admin – approve or reject
exports.reviewRequest = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, admin_notes } = req.body;

    if (!['approved', 'rejected'].includes(status)) {
      return res.status(400).json({ ok: false, message: 'Invalid status. Use "approved" or "rejected".' });
    }

    const request = await AccountCodeRequest.findByPk(id);
    if (!request) {
      return res.status(404).json({ ok: false, message: 'Request not found.' });
    }

    if (request.status !== 'pending') {
      return res.status(400).json({ ok: false, message: 'Request has already been reviewed.' });
    }

    request.status = status;
    request.admin_notes = admin_notes || null;
    request.reviewed_by_admin_id = req.adminId;
    request.reviewed_at = new Date();

    await request.save();

    res.json({ ok: true, request });
  } catch (error) {
    console.error('Review code request error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};