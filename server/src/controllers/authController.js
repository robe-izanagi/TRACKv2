const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { User, Admin, UserSession, AccountCode, UserProfile, sequelize } = require('../models');
const { Op } = require('sequelize');

// Login (supports username OR email)
exports.login = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const credential = username || email;   // kung alin ang binigay

    if (!credential || !password) {
      return res.status(400).json({ ok: false, message: 'Username/email and password are required.' });
    }

    // Hanapin user gamit ang username o email
    const user = await User.findOne({
      where: {
        [Op.or]: [
          { username: credential },
          { email: credential }
        ]
      }
    });

    if (!user) {
      return res.status(401).json({ ok: false, message: 'Invalid credentials.' });
    }

    if (user.status === 'blocked' || user.status === 'suspended') {
      return res.status(403).json({ ok: false, message: 'Your account is blocked or suspended.' });
    }

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) {
      return res.status(401).json({ ok: false, message: 'Invalid credentials.' });
    }

    // Check kung admin (para sa admin login)
    const admin = await Admin.findOne({ where: { user_id: user.id, is_active: true } });

    const token = jwt.sign(
      { userId: user.id, isAdmin: !!admin },
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
      user: {
        id: user.id,
        username: user.username,
        email: user.email,
        status: user.status,
        is_admin: !!admin
      }
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// Register (gamit ang email, password, at account code)
exports.register = async (req, res) => {
  try {
    const { username, password, email, account_code } = req.body;

    if (!username || !password || !email || !account_code) {
      return res.status(400).json({ ok: false, message: 'All fields are required.' });
    }

    // Prevent duplicate
    const existing = await User.findOne({
      where: {
        [Op.or]: [
          { username },
          { email }
        ]
      }
    });
    if (existing) {
      return res.status(409).json({ ok: false, message: 'Username or email already in use.' });
    }

    // Validate account code
    const accountCode = await AccountCode.findOne({ where: { code: account_code } });
    if (!accountCode) {
      return res.status(400).json({ ok: false, message: 'Invalid account code.' });
    }
    if (accountCode.status === 'used') {
      return res.status(400).json({ ok: false, message: 'Account code already used.' });
    }
    if (accountCode.expires_at && accountCode.expires_at < new Date()) {
      return res.status(400).json({ ok: false, message: 'Account code has expired.' });
    }

    const t = await sequelize.transaction();
    try {
      const password_hash = await bcrypt.hash(password, 10);
      const user = await User.create({
        id: uuidv4(),
        username,
        email,
        password_hash,
        account_code_id: accountCode.id,
        status: 'active'
      }, { transaction: t });

      await UserProfile.create({
        user_id: user.id,
        department_id: accountCode.department_id,
        office_id: accountCode.office_id,
        role_id: accountCode.role_id
      }, { transaction: t });

      await accountCode.update({
        used_by_user_id: user.id,
        used_at: new Date(),
        status: 'used'
      }, { transaction: t });

      if (accountCode.is_admin) {
        await Admin.create({
          id: uuidv4(),
          user_id: user.id,
          admin_level: 'standard',
          is_active: true
        }, { transaction: t });
      }

      await t.commit();

      res.json({ ok: true, user: { id: user.id, username: user.username, email: user.email } });
    } catch (err) {
      await t.rollback();
      if (err.name === 'SequelizeUniqueConstraintError') {
        return res.status(409).json({ ok: false, message: 'Username or email already in use.' });
      }
      throw err;
    }
  } catch (error) {
    console.error('Register error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};