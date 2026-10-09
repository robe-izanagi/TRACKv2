const { UserProfile, Role } = require('../models');

module.exports = async (req, res, next) => {
  try {
    const profile = await UserProfile.findOne({
      where: { user_id: req.userId },
      include: [{ model: Role, where: { name: 'heads' } }]
    });
    if (!profile) {
      return res.status(403).json({ ok: false, message: 'Only users with the Heads role can create campus or department events.' });
    }
    next();
  } catch (error) {
    console.error('Require heads role error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};