const { OAuth2Client } = require('google-auth-library');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { User, Admin, UserSession, AccountCode, UserProfile, AllowedDomain, PositionAssignment, sequelize } = require('../models');

const client = new OAuth2Client(
  process.env.GOOGLE_CLIENT_ID,
  process.env.GOOGLE_CLIENT_SECRET,
  process.env.GOOGLE_REDIRECT_URI
);

exports.googleLoginUrl = (req, res) => {
  const url = client.generateAuthUrl({
    access_type: 'offline',
    scope: ['email', 'profile']
  });
  res.json({ url });
};

exports.googleCallback = async (req, res) => {
  const { code } = req.query;
  if (!code) {
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
    const name = payload.name || '';

    const domain = email.split('@')[1];
    if (!domain) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=invalid_email`);
    }

    const allowed = await AllowedDomain.findOne({
      where: { domain, is_active: true }
    });
    if (!allowed) {
      return res.redirect(`${process.env.FRONTEND_URL}/login?error=domain_not_allowed`);
    }

    let user = await User.findOne({ where: { email } });
    if (user) {
      if (user.status === 'blocked' || user.status === 'suspended') {
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
      return res.redirect(`${process.env.FRONTEND_URL}/auth/callback?token=${token}`);
    }

    const regToken = jwt.sign(
      { email, name, purpose: 'google-registration' },
      process.env.JWT_SECRET,
      { expiresIn: '5m' }
    );
    return res.redirect(
      `${process.env.FRONTEND_URL}/register?registration_token=${regToken}&email=${encodeURIComponent(email)}&name=${encodeURIComponent(name)}`
    );
  } catch (error) {
    console.error('Google callback error:', error);
    return res.redirect(`${process.env.FRONTEND_URL}/login?error=auth_failed`);
  }
};

exports.completeGoogleRegistration = async (req, res) => {
  try {
    const { registration_token, account_code } = req.body;
    if (!registration_token || !account_code) {
      return res.status(400).json({ ok: false, message: 'Registration token and account code are required.' });
    }

    let decoded;
    try {
      decoded = jwt.verify(registration_token, process.env.JWT_SECRET);
    } catch (err) {
      return res.status(401).json({ ok: false, message: 'Registration token expired or invalid.' });
    }
    if (decoded.purpose !== 'google-registration') {
      return res.status(400).json({ ok: false, message: 'Invalid registration token.' });
    }

    const { email, name } = decoded;

    const code = await AccountCode.findOne({ where: { code: account_code } });
    if (!code) {
      return res.status(400).json({ ok: false, message: 'Invalid account code.' });
    }
    if (code.status === 'used') {
      return res.status(400).json({ ok: false, message: 'Account code already used.' });
    }
    if (code.expires_at && code.expires_at < new Date()) {
      return res.status(400).json({ ok: false, message: 'Account code has expired.' });
    }
    if (code.is_admin) {
      return res.status(400).json({ ok: false, message: 'This code is for admin accounts only.' });
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

      // Save full_name from Google
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

      res.json({
        ok: true,
        token,
        user: { id: user.id, email: user.email, status: user.status, is_admin: false }
      });
    } catch (error) {
      await t.rollback();
      if (error.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ ok: false, message: 'Email already registered.' });
      }
      throw error;
    }
  } catch (error) {
    console.error('Complete Google registration error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};