const jwt = require('jsonwebtoken');
const { UserSession, Admin } = require('../models');

// Required login – any authenticated user
exports.authenticate = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, message: 'No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check session is active
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

// Admin only
exports.requireAdmin = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json({ ok: false, message: 'No token provided.' });
    }

    const token = authHeader.split(' ')[1];
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    // Check session
    const session = await UserSession.findOne({
      where: { token, status: 'active' }
    });
    if (!session || new Date() > session.expires_at) {
      return res.status(401).json({ ok: false, message: 'Session expired.' });
    }

    // Verify admin
    const admin = await Admin.findOne({
      where: { user_id: decoded.userId, is_active: true }
    });
    if (!admin) {
      return res.status(403).json({ ok: false, message: 'Admin access required.' });
    }

    req.userId = decoded.userId;
    req.adminId = admin.id;
    next();
  } catch (error) {
    return res.status(401).json({ ok: false, message: 'Invalid token.' });
  }
};

exports.authenticate = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    if (!token) return res.status(401).json({ ok: false, message: 'No token provided.' });

    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    const session = await UserSession.findOne({ where: { token, status: 'active' } });
    if (!session || session.expires_at < new Date()) {
      return res.status(401).json({ ok: false, message: 'Session expired.' });
    }

    req.userId = decoded.userId;
    req.isAdmin = decoded.isAdmin;
    next();
  } catch (err) {
    return res.status(401).json({ ok: false, message: 'Invalid token.' });
  }
};