const { UserProfile, Role } = require('../models');

module.exports = async (req, res, next) => {
  try {
    const profile = await UserProfile.findOne({
      where: { user_id: req.userId },
      include: [{ model: Role, where: { name: 'officials' } }]
    });
    if (!profile) {
      return res.status(403).json({ ok: false, message: 'Only officials can create campus or department events.' });
    }
    next();
  } catch (error) {
    console.error('Require officials error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};