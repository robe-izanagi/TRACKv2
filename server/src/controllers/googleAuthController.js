const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { User, Admin, UserSession, AccountCode, UserProfile, AllowedDomain, PositionAssignment, sequelize } = require('../models');
const { getUsabilityError } = require('../utils/accCodeLifeCycle');
const A = require('../utils/auditActions');
const { logAudit, recordLoginAttempt } = require('../utils/auditLogger');

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

// ─── Generate Google Login URL ────────────────────────
exports.googleLoginUrl = (req, res) => {
  const { redirect, mode } = req.query;
  const state = mode || 'login'; // 'login' or 'request'

  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['email', 'profile'],
    state: state, // ← Pass mode as state
  });

  res.json({ url });
};

// ─── Google Callback ──────────────────────────────────
exports.googleCallback = async (req, res) => {
  const { code, state } = req.query;
  const mode = state || 'login';
  let emailForAudit = null;

  if (!code) {
    if (mode === 'login') {
      await recordLoginAttempt({ req, method: 'google', success: false, reason: 'auth_failed' });
    }
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=missing_code`);
  }

  try {
    const { tokens } = await client.getToken(code);
    const ticket = await client.verifyIdToken({
      idToken: tokens.id_token,
      audience: process.env.GOOGLE_CLIENT_ID
    });
    const payload = ticket.getPayload();
    const email = payload.email;
    emailForAudit = email;
    const name = payload.name || '';

    const domain = typeof email === 'string' ? email.split('@')[1]?.toLowerCase() : null;
    if (!domain) {
      if (mode === 'login') {
        await recordLoginAttempt({ req, email, method: 'google', success: false, reason: 'auth_failed' });
      }
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_email`);
    }

    const activeDomains = await AllowedDomain.findAll({
      where: { is_active: true },
      attributes: ['domain'],
    });
    const allowed = activeDomains.some(
      (item) => item.domain.toLowerCase() === domain,
    );
    if (!allowed) {
      if (mode === 'login') {
        await recordLoginAttempt({ req, email, method: 'google', success: false, reason: 'domain_not_allowed' });
      }
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=domain_not_allowed`);
    }

    let user = await User.findOne({ where: { email } });

    // ─── Existing User ──────────────────────────────
    if (user) {
      if (user.status === 'blocked' || user.status === 'suspended') {
        if (mode === 'login') {
          await recordLoginAttempt({ req, user, email, method: 'google', success: false, reason: 'blocked' });
        }
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=blocked`);
      }

      const token = jwt.sign(
        { userId: user.id, isAdmin: false },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      await UserSession.create({
        id: uuidv4(),
        user_id: user.id,
        token,
        status: 'active',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      if (mode === 'request') {
        return res.redirect(
          `${process.env.FRONTEND_URL}/request-account-code?token=${token}`
        );
      }
      await recordLoginAttempt({ req, user, email, method: 'google', success: true });
      if (!user) {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent("Can't find your account or your account has been deleted.")}`);
      }
      if (user.status === 'blocked') {
        return res.redirect(`${process.env.FRONTEND_URL}/login?error=${encodeURIComponent("Your account has been blocked. Please contact the admin office for restoring your account.")}`);
      }
      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    }

    // ─── New User ─────────────────────────────────────
    const regToken = jwt.sign(
      { email, name, purpose: 'google-registration' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );

    if (mode === 'request') {
      return res.redirect(
        `${process.env.FRONTEND_URL}/request-account-code?registration_token=${regToken}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`
      );
    }

    return res.redirect(
      `${process.env.FRONTEND_URL}/register?registration_token=${regToken}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`
    );
  } catch (error) {
    console.error('Google callback error:', error);
    if (mode === 'login') {
      await recordLoginAttempt({
        req, email: emailForAudit, method: 'google', success: false, reason: 'auth_failed',
      });
    }
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
};

// ─── Complete Google Registration ─────────────────────
exports.completeGoogleRegistration = async (req, res) => {
  try {
    const { registration_token, account_code } = req.body;
    if (!registration_token || !account_code) {
      return res.status(400).json({ ok: false, message: 'Your registration session or account code is missing. Start registration again and enter the code provided by your administrator.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(registration_token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ ok: false, message: 'Your registration session has expired or is no longer valid. Start registration again with your Google account.' });
    }
    if (decoded.purpose !== 'google-registration') {
      return res.status(400).json({ ok: false, message: 'This registration link is not valid for creating a user account. Start again from the user registration page.' });
    }

    const { email, name } = decoded;
    const domain = typeof email === 'string' ? email.split('@')[1]?.toLowerCase() : null;
    const activeDomains = domain
      ? await AllowedDomain.findAll({ where: { is_active: true }, attributes: ['domain'] })
      : [];
    const allowedDomain = activeDomains.some(
      (item) => item.domain.toLowerCase() === domain,
    );
    if (!allowedDomain) {
      return res.status(403).json({
        ok: false,
        message: 'The Google email domain for this registration is no longer approved. Start again with an authorized institutional email address or contact an administrator.'
      });
    }

    const code = await AccountCode.findOne({ where: { code: account_code } });
    if (!code) {
      return res.status(400).json({ ok: false, message: 'We could not find that account code. Check that you entered it exactly as provided by your administrator, then try again.' });
    }

    // Rejects used, inactive/deactivated, expired, and older-than-7-days codes
    const usabilityError = getUsabilityError(code);
    if (usabilityError) {
      return res.status(400).json({ ok: false, message: usabilityError });
    }

    if (code.is_admin) {
      return res.status(400).json({ ok: false, message: 'This code is for an administrator account, not a user account. Use a user account code or contact your administrator.' });
    }

    const t = await sequelize.transaction();
    try {
      const user = await User.create({
        id: uuidv4(),
        email,
        password_hash: null,
        account_code_id: code.id,
        status: 'active'
      }, { transaction: t });

      await UserProfile.create({
        user_id: user.id,
        department_id: code.department_id,
        office_id: code.office_id,
        role_id: code.role_id,
        position_id: code.position_id,
        full_name: name || email
      }, { transaction: t });

      if (code.position_id) {
        await PositionAssignment.create({
          position_id: code.position_id,
          user_id: user.id,
          status: 'active'
        }, { transaction: t });
      }

      await code.update({
        used_by_user_id: user.id,
        used_at: new Date(),
        status: 'used'
      }, { transaction: t });

      await t.commit();

      const token = jwt.sign(
        { userId: user.id, isAdmin: false },
        process.env.JWT_SECRET,
        { expiresIn: '1d' }
      );

      await UserSession.create({
        id: uuidv4(),
        user_id: user.id,
        token,
        status: 'active',
        expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000)
      });

      await Promise.all([
        recordLoginAttempt({ req, user, email, method: 'google', success: true }),
        logAudit({
          req, actorType: 'user', targetUserId: user.id,
          actionType: A.USER_REGISTERED, entityTable: 'users', entityId: user.id,
          description: 'User registered with Google and signed in',
          metadata: { method: 'google' },
        }),
      ]);

      res.json({
        ok: true,
        token,
        user: { id: user.id, email: user.email, status: user.status, is_admin: false }
      });
    } catch (error) {
      await t.rollback();
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ ok: false, message: 'An account has already been registered with this Google email address. Return to sign-in and choose the account you registered with.' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Complete Google registration error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};