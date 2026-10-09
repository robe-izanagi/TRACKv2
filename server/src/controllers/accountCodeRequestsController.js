const { AccountCodeRequest, AccountCode, Department, Office, Role, Position, Admin, User, PositionAssignment, AllowedDomain, EmailQueue, sequelize } = require('../models');
const { Op } = require('sequelize');
const { v4: uuidv4 } = require('uuid');
const { generateUniqueCode } = require('../utils/codeGenerator');
const { getUsabilityError } = require('../utils/accCodeLifeCycle');
const { sendAccountCodeEmail } = require('../services/emailService');
const A = require('../utils/auditActions');
const { logAudit, detectRequestSpam, maskEmail } = require('../utils/auditLogger');

const escapeHtml = (value) => String(value || '').replace(/[&<>"']/g, (character) => ({
  '&': '&amp;',
  '<': '&lt;',
  '>': '&gt;',
  '"': '&quot;',
  "'": '&#39;',
}[character]));

const queueRejectionEmail = (request, transaction) => EmailQueue.create({
  id: uuidv4(),
  recipient_email: request.email,
  subject: 'Update on your TRACK account code request',
  body: `
    <h2>Hello ${escapeHtml(request.full_name || 'there')},</h2>
    <p>Your request for a TRACK account code has been reviewed and was not approved.</p>
    ${request.admin_notes ? `<p><strong>Administrator's note:</strong> ${escapeHtml(request.admin_notes)}</p>` : ''}
    <p>If you believe this decision was made in error or have questions, please contact your administrator.</p>
  `,
  scheduled_for: null,
  entity_type: 'account_code_request',
  email_type: 'account_code_rejected',
  status: 'pending',
}, { transaction });

// ─── Public – Create request ──────────────────────────
exports.createRequest = async (req, res) => {
  try {
    const { email, full_name, department_id, office_id, role_id, position_id, description } = req.body;

    if (typeof email !== 'string' || !email.trim()) {
      return res.status(400).json({ ok: false, message: 'Enter your institutional email address to request an account code.' });
    }
    if (typeof full_name !== 'string' || !full_name.trim()) {
      return res.status(400).json({ ok: false, message: 'Enter your full name so the administrator can identify your request.' });
    }
    if (!department_id && !office_id) {
      return res.status(400).json({ ok: false, message: 'Select at least one department or office so your request can be assigned correctly.' });
    }
    if (!role_id) {
      return res.status(400).json({ ok: false, message: 'Select your role before submitting the account-code request.' });
    }

    const normalizedEmail = email.trim().toLowerCase();
    const emailParts = normalizedEmail.split('@');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(normalizedEmail)) {
      return res.status(400).json({ ok: false, message: 'Enter a valid email address, including the part after @ (for example, name@school.edu).' });
    }

    const activeDomains = await AllowedDomain.findAll({
      where: { is_active: true },
      attributes: ['domain'],
    });
    const allowedDomain = activeDomains.some(
      (item) => item.domain.toLowerCase() === emailParts[1],
    );
    if (!allowedDomain) {
      return res.status(403).json({
        ok: false,
        message: `The email domain "${emailParts[1]}" is not approved for account requests. Use your official institutional email address or contact an administrator to ask whether this domain can be approved.`
      });
    }

    const [department, office, role, position] = await Promise.all([
      department_id ? Department.findByPk(department_id) : null,
      office_id ? Office.findByPk(office_id) : null,
      Role.findByPk(role_id),
      position_id ? Position.findByPk(position_id) : null,
    ]);
    if (department_id && (!department || !department.is_active)) {
      return res.status(400).json({ ok: false, message: 'The selected department is no longer available. Refresh the page and choose an active department.' });
    }
    if (office_id && (!office || !office.is_active)) {
      return res.status(400).json({ ok: false, message: 'The selected office is no longer available. Refresh the page and choose an active office.' });
    }
    if (!role || !role.is_active) {
      return res.status(400).json({ ok: false, message: 'The selected role is no longer available. Refresh the page and choose an active role.' });
    }
    if (position_id && (!position || !position.is_active)) {
      return res.status(400).json({ ok: false, message: 'The selected position is no longer available. Refresh the page and choose an active position, or leave it blank.' });
    }

    // Check if email already has a pending request
    const existingPending = await AccountCodeRequest.findOne({
      where: { email: normalizedEmail, status: 'pending' }
    });
    if (existingPending) {
      return res.status(409).json({ ok: false, message: 'There is already an account-code request waiting for review for this email address. Please wait for the administrator\'s decision instead of submitting another request.' });
    }

    // Check if email already has an approved request
    const existingApproved = await AccountCodeRequest.findOne({
      where: { email: normalizedEmail, status: 'approved' }
    });
    if (existingApproved) {
      return res.status(409).json({ ok: false, message: 'An account-code request for this email has already been approved. Check your inbox, including the spam folder, for the account code. Contact an administrator if you cannot find it.' });
    }

    //Check if email is already registered as a user
    const existingUser = await User.findOne({
      where: { email: normalizedEmail }
    });
    if (existingUser) {
      return res.status(409).json({ ok: false, message: 'This email address is already linked to a registered account. Return to the sign-in page and continue with this email address.' });
    }

    const request = await AccountCodeRequest.create({
      id: uuidv4(),
      email: normalizedEmail,
      full_name: full_name.trim(),
      department_id: department_id || null,
      office_id: office_id || null,
      role_id: role_id || null,
      position_id: position_id || null,
      description: typeof description === 'string' ? description.trim() || null : null,
      status: 'pending'
    });

    await Promise.all([
      logAudit({
        req, actorType: 'anonymous', actionType: A.ACCOUNT_CODE_REQUESTED,
        entityTable: 'account_code_requests', entityId: request.id,
        description: 'Account code request submitted',
        metadata: { requester_email: maskEmail(normalizedEmail) },
      }),
      detectRequestSpam({ req, email: normalizedEmail, requestId: request.id }),
    ]);

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
          const transaction = await sequelize.transaction();
          try {
            request.status = 'rejected';
            request.admin_notes = 'Position is already assigned to another user.';
            request.reviewed_by_admin_id = req.adminId;
            request.reviewed_at = new Date();
            await request.save({ transaction });
            await queueRejectionEmail(request, transaction);
            await transaction.commit();
          } catch (error) {
            await transaction.rollback();
            throw error;
          }
          await logAudit({
            req, targetUserId: null, actionType: A.ACCOUNT_CODE_REJECTED,
            entityTable: 'account_code_requests', entityId: request.id,
            description: 'Admin auto-rejected an account code request because its position was occupied',
            metadata: { requester_email: maskEmail(request.email), reason: 'position_occupied' },
          });

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
    await logAudit({
      req, actionType: A.ACCOUNT_CODE_APPROVED,
      entityTable: 'account_code_requests', entityId: request.id,
      description: 'Admin approved an account code request and generated a code',
      metadata: { requester_email: maskEmail(request.email), account_code_id: code.id },
    });

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

    const transaction = await sequelize.transaction();
    try {
      request.status = 'rejected';
      request.admin_notes = admin_notes || null;
      request.reviewed_by_admin_id = req.adminId;
      request.reviewed_at = new Date();
      await request.save({ transaction });
      await queueRejectionEmail(request, transaction);
      await transaction.commit();
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
    await logAudit({
      req, actionType: A.ACCOUNT_CODE_REJECTED,
      entityTable: 'account_code_requests', entityId: request.id,
      description: 'Admin rejected an account code request',
      metadata: { requester_email: maskEmail(request.email) },
    });

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

    // Don't email a code that was deleted, deactivated, expired, or already used
    const codeRecord = await AccountCode.findOne({ where: { code: request.generated_code } });
    if (!codeRecord) {
      return res.status(404).json({ ok: false, message: 'This account code was deleted, so it can no longer be sent.' });
    }
    const usabilityError = getUsabilityError(codeRecord);
    if (usabilityError) {
      return res.status(400).json({ ok: false, message: `Can't send this code. ${usabilityError}` });
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