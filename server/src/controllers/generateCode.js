const { v4: uuidv4 } = require('uuid');
const { Sequelize } = require('sequelize');
const { AccountCode, Department, Office, Role } = require('../models');

function makePrefix(name) {
  if (!name) return 'ADM';
  const cleaned = name.replace(/[^a-zA-Z0-9 ]/g, ' ').trim();
  const parts = cleaned.split(/\s+/).filter(Boolean);
  if (parts.length === 0) return 'ADM';
  if (parts.length === 1) return parts[0].substring(0, 3).toUpperCase();
  return parts.map(p => p[0]).join('').substring(0, 3).toUpperCase();
}

exports.generateAccountCode = async (req, res) => {
  try {
    const { department_id, office_id, role_id, is_admin = false, expires_at } = req.body;

    // Para sa admin code, hindi kailangan ng office/role/department
    if (!is_admin) {
      if (!office_id || !role_id) {
        return res.status(400).json({
          ok: false,
          message: 'office_id and role_id are required for user codes.'
        });
      }
    }

    let dept = null, office = null, role = null;

    if (department_id) {
      dept = await Department.findByPk(department_id);
      if (!dept) return res.status(404).json({ ok: false, message: 'Department not found.' });
    }
    if (office_id) {
      office = await Office.findByPk(office_id);
      if (!office) return res.status(404).json({ ok: false, message: 'Office not found.' });
    }
    if (role_id) {
      role = await Role.findByPk(role_id);
      if (!role) return res.status(404).json({ ok: false, message: 'Role not found.' });
    }

    const deptPrefix = makePrefix(dept?.name);
    const officePrefix = makePrefix(office?.name);
    const rolePrefix = makePrefix(role?.name);

    let created = null;
    for (let attempt = 0; attempt < 6; attempt++) {
      const rand = Math.random().toString(36).substring(2, 8).toUpperCase();
      const code = `${deptPrefix}-${officePrefix}-${rolePrefix}-${rand}`;
      try {
        created = await AccountCode.create({
          id: uuidv4(),
          code,
          department_id: dept?.id || null,
          office_id: office?.id || null,
          role_id: role?.id || null,
          is_admin: !!is_admin,
          generated_by_admin_id: req.adminId || null,
          status: 'unused',
          expires_at: expires_at ? new Date(expires_at) : null
        });
        break;
      } catch (err) {
        if (err instanceof Sequelize.UniqueConstraintError) continue;
        throw err;
      }
    }

    if (!created) {
      return res.status(500).json({ ok: false, message: 'Failed to generate unique account code.' });
    }

    res.status(201).json({ ok: true, account_code: created });
  } catch (error) {
    console.error('Generate account code error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

exports.listCodes = async (req, res) => {
  try {
    const codes = await AccountCode.findAll({
      include: [
        { model: Department, attributes: ['id', 'name'] },
        { model: Office, attributes: ['id', 'name'] },
        { model: Role, attributes: ['id', 'name'] }
      ],
      order: [['created_at', 'DESC']],
      limit: 100
    });
    res.json({ ok: true, codes });
  } catch (error) {
    console.error('List codes error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};