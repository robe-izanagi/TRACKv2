const jwt = require('jsonwebtoken');
const { UserSession, Admin } = require('../models');
const { watchAdminMutation } = require('../utils/auditLogger');

exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, message: 'No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const session = await UserSession.findOne({
      where: { token, status: 'active' }
    });
    if (!session || new Date() > session.expires_at) {
      return res.status(401).json({ ok: false, message: 'Session expired.' });
    }

    req.userId = decoded.userId;
    req.isAdmin = decoded.isAdmin;
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, message: 'Invalid token.' });
  }
};

exports.requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, message: 'No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    const session = await UserSession.findOne({
      where: { token, status: 'active' }
    });
    if (!session || new Date() > session.expires_at) {
      return res.status(401).json({ ok: false, message: 'Session expired.' });
    }

    const admin = await Admin.findOne({
      where: { user_id: decoded.userId, is_active: true }
    });
    if (!admin) {
      return res.status(403).json({ ok: false, message: 'Admin access required.' });
    }

    req.userId = decoded.userId;
    req.adminId = admin.id;
    watchAdminMutation(req, res);
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, message: 'Invalid token.' });
  }
};