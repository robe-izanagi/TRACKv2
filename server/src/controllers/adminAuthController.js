const { v4: uuidv4 } = require('uuid');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sequelize, User, Admin, AccountCode, UserSession } = require('../models');
const { getUsabilityError } = require('../utils/accCodeLifeCycle');
const A = require('../utils/auditActions');
const { logAudit, recordLoginAttempt } = require('../utils/auditLogger');

exports.registerAdmin = async (req, res) => {
  const t = await sequelize.transaction();
  try {
    const { username, password, account_code } = req.body;

    if (typeof username !== 'string' || !username.trim()
      || typeof password !== 'string' || !password
      || typeof account_code !== 'string' || !account_code.trim()) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'Enter a username, password, and admin account code to create your account.' });
    }

    const trimmedUsername = username.trim();
    if (trimmedUsername.length < 3) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'Username must be at least 3 characters.' });
    }
    if (password.length < 8) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'Password must be at least 8 characters.' });
    }

    const codeRecord = await AccountCode.findOne({ where: { code: account_code.trim() }, transaction: t });
    if (!codeRecord) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: 'We could not find that account code. Check that you entered it exactly as provided by your administrator, then try again.' });
    }

    // Rejects used, inactive/deactivated, expired, and older-than-7-days codes
    const usabilityError = getUsabilityError(codeRecord);
    if (usabilityError) {
      await t.rollback();
      return res.status(400).json({ ok: false, message: usabilityError });
    }

    if (!codeRecord.is_admin) {
      await t.rollback();
      return res.status(403).json({ ok: false, message: 'This code is for a regular user account, not an administrator account. Use an admin account code or contact your system administrator.' });
    }

    const existingUser = await User.findOne({ where: { username: trimmedUsername }, transaction: t });
    if (existingUser) {
      await t.rollback();
      return res.status(409).json({ ok: false, message: 'That username is already in use. Choose a different username for your administrator account.' });
    }

    const password_hash = await bcrypt.hash(password, 10);
    const placeholderEmail = `${trimmedUsername.toLowerCase()}@admin.local`;

    const newUser = await User.create({
      id: uuidv4(),
      username: trimmedUsername,
      email: placeholderEmail,
      password_hash,
      account_code_id: codeRecord.id,
      status: 'active',
    }, { transaction: t });

    const admin = await Admin.create({
      id: uuidv4(),
      user_id: newUser.id,
      admin_level: null,
      is_active: true,
    }, { transaction: t });

    codeRecord.status = 'used';
    codeRecord.used_at = new Date();
    codeRecord.used_by_user_id = newUser.id;
    await codeRecord.save({ transaction: t });

    await t.commit();
    await logAudit({
      req, actorType: 'anonymous', targetUserId: newUser.id,
      actionType: A.ADMIN_REGISTERED, entityTable: 'admins', entityId: admin.id,
      description: 'Admin account registered',
      metadata: { username: newUser.username },
    });

    res.status(201).json({
      ok: true,
      message: 'Admin account created successfully.',
      admin: { id: admin.id, user_id: newUser.id, username: newUser.username },
    });
  } catch (error) {
    await t.rollback();
    console.error('Admin register error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── LOGIN ADMIN ────────────────────────────────────────
// Response shape (`token`, `user`) matches what AuthContext.jsx expects:
// `localStorage.setItem('admin_token', result.token); setUser(result.user);`
exports.loginAdmin = async (req, res) => {
  try {
    const { username, password } = req.body;

    if (typeof username !== 'string' || !username.trim()
      || typeof password !== 'string' || !password) {
      await recordLoginAttempt({
        req, username, method: 'local', success: false,
        reason: 'auth_failed', isAdminLogin: true,
      });
      return res.status(400).json({ ok: false, message: 'Username and password are required.' });
    }

    const user = await User.findOne({ where: { username: username.trim() } });
    if (!user) {
      await recordLoginAttempt({
        req, username: username.trim(), method: 'local', success: false,
        reason: 'user_not_found', isAdminLogin: true,
      });
      return res.status(404).json({ ok: false, message: 'We could not find an active administrator account with that username. Check the spelling, or contact your system administrator if you believe you should have access.' });
    }

    const admin = await Admin.findOne({ where: { user_id: user.id, is_active: true } });
    if (!admin) {
      await recordLoginAttempt({
        req, user, username: user.username, email: user.email, method: 'local',
        success: false, reason: 'not_admin', isAdminLogin: true,
      });
      return res.status(404).json({ ok: false, message: 'We could not find an active administrator account with that username. Check the spelling, or contact your system administrator if you believe you should have access.' });
    }

    if (user.status === 'blocked' || user.status === 'suspended') {
      await recordLoginAttempt({
        req, user, username: user.username, email: user.email, method: 'local',
        success: false, reason: 'blocked', isAdminLogin: true,
      });
      return res.status(403).json({ ok: false, message: 'Your administrator account is blocked or suspended, so sign-in is unavailable. Contact your system administrator to restore access.' });
    }

    const validPassword = await bcrypt.compare(password, user.password_hash);
    if (!validPassword) {
      await recordLoginAttempt({
        req, user, username: user.username, email: user.email, method: 'local',
        success: false, reason: 'invalid_password', isAdminLogin: true,
      });
      return res.status(401).json({ ok: false, message: 'The username or password does not match our records. Check the spelling of your username and make sure Caps Lock is off, then try again.' });
    }

    const token = jwt.sign({ userId: user.id, isAdmin: true }, process.env.JWT_SECRET, { expiresIn: '7d' });
    const expires_at = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);

    await UserSession.create({
      id: uuidv4(),
      user_id: user.id,
      token,
      status: 'active',
      expires_at,
    });

    await recordLoginAttempt({
      req, user, username: user.username, email: user.email, method: 'local',
      success: true, isAdminLogin: true, adminId: admin.id,
    });

    res.json({
      ok: true,
      token,
      user: { id: admin.id, user_id: user.id, username: user.username },
    });
  } catch (error) {
    console.error('Admin login error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

exports.changeAdminPassword = async (req, res) => {
  try {
    const { current_password, new_password, confirm_password } = req.body || {};
    if ([current_password, new_password, confirm_password].some(
      value => typeof value !== 'string' || value.length === 0,
    )) {
      return res.status(400).json({
        ok: false,
        message: 'Current password, new password, and confirmation are required.',
      });
    }
    if (new_password.length < 8) {
      return res.status(400).json({ ok: false, message: 'New password must be at least 8 characters.' });
    }
    if (new_password !== confirm_password) {
      return res.status(400).json({ ok: false, message: 'New password confirmation does not match.' });
    }
    if (new_password === current_password) {
      return res.status(400).json({ ok: false, message: 'New password must be different from the current password.' });
    }

    const user = await User.findByPk(req.userId);
    if (!user) return res.status(404).json({ ok: false, message: 'Admin account not found.' });
    if (!user.password_hash || !(await bcrypt.compare(current_password, user.password_hash))) {
      return res.status(400).json({ ok: false, message: 'Current password is incorrect.' });
    }

    user.password_hash = await bcrypt.hash(new_password, 10);
    await user.save({ fields: ['password_hash'] });
    await logAudit({
      req,
      targetUserId: user.id,
      actionType: A.ADMIN_PASSWORD_CHANGED,
      entityTable: 'users',
      entityId: user.id,
      description: 'Admin changed their account password',
      metadata: { username: user.username },
    });

    return res.json({ ok: true, message: 'Password changed. You are still signed in.' });
  } catch (error) {
    console.error('Admin password change error:', error);
    return res.status(500).json({ ok: false, message: 'Could not change password.' });
  }
};