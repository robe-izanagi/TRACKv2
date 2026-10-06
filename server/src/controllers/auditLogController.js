// src/controllers/auditLogController.js
// Admin-only audit trail reader. Mounted behind requireAdmin.
const { Op, QueryTypes } = require('sequelize');
const { sequelize, AuditLog, Admin, User } = require('../models');
const A = require('../utils/auditActions');
const { maskEmail } = require('../utils/auditLogger');

const SEVERITIES = ['info', 'warning', 'critical'];
const ACTOR_TYPES = ['admin', 'user', 'system', 'anonymous'];
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
const num = v => Number(v) || 0;

function buildWhere(query) {
  const { admin_id, user_id, action_type, entity_table, entity_id, actor_type, severity, from, to, search } = query;
  const where = {};
  if (admin_id) where.actor_admin_id = admin_id;
  if (user_id) where.target_user_id = user_id;
  if (action_type) {
    const types = String(action_type).split(',').map(s => s.trim()).filter(s => A.ALL.includes(s));
    where.action_type = { [Op.in]: types.length ? types : ['__none__'] };
  }
  if (entity_table) where.entity_table = String(entity_table).slice(0, 100);
  if (entity_id) where.entity_id = entity_id;
  if (actor_type && ACTOR_TYPES.includes(actor_type)) where.actor_type = actor_type;
  if (severity && SEVERITIES.includes(severity)) where.severity = severity;
  if (from || to) {
    where.created_at = {};
    if (from) where.created_at[Op.gte] = new Date(from);
    if (to) where.created_at[Op.lte] = new Date(to);
  }
  if (search) where.description = { [Op.like]: `%${String(search).slice(0, 100)}%` };
  return where;
}

function validIds(query) {
  return ['admin_id', 'user_id', 'entity_id'].every(k => !query[k] || UUID_RE.test(query[k]));
}

// ─── GET /admin/audit-logs ─────────────────────────────
exports.listAuditLogs = async (req, res) => {
  try {
    if (!validIds(req.query)) return res.status(400).json({ ok: false, message: 'Invalid id filter.' });
    const page = Math.max(1, Number(req.query.page) || 1);
    const limit = Math.min(100, Math.max(1, Number(req.query.limit) || 25));
    const where = buildWhere(req.query);

    const { rows, count } = await AuditLog.findAndCountAll({
      where, order: [['created_at', 'DESC'], ['id', 'DESC']], limit, offset: (page - 1) * limit,
    });

    // two batched lookups instead of per-row queries
    const adminIds = [...new Set(rows.map(r => r.actor_admin_id).filter(Boolean))];
    const targetIds = [...new Set(rows.map(r => r.target_user_id).filter(Boolean))];
    const admins = adminIds.length
      ? await Admin.findAll({ where: { id: { [Op.in]: adminIds } }, attributes: ['id', 'user_id'] })
      : [];
    const userIds = [...new Set([...targetIds, ...admins.map(a => a.user_id)])];
    const users = userIds.length
      ? await User.findAll({ where: { id: { [Op.in]: userIds } }, attributes: ['id', 'username', 'email', 'status'] })
      : [];
    const uById = new Map(users.map(u => [u.id, u]));
    const adminName = new Map(admins.map(a => [a.id, uById.get(a.user_id)?.username || null]));

    res.json({
      ok: true,
      pagination: { page, limit, total: count, total_pages: Math.ceil(count / limit) },
      logs: rows.map(r => {
        const m = r.metadata || {};
        const t = uById.get(r.target_user_id);
        return {
          id: r.id, created_at: r.created_at, action_type: r.action_type,
          severity: r.severity, actor_type: r.actor_type,
          actor: r.actor_admin_id
            ? { admin_id: r.actor_admin_id, username: adminName.get(r.actor_admin_id) || m.actor_username || null }
            : null,
          target_user: r.target_user_id
            ? {
              id: r.target_user_id,
              username: t?.username || m.target_username || null,
              email: maskEmail(t?.email || m.target_email || null),
              status: t?.status || null,
            }
            : null,
          entity: { table: r.entity_table, id: r.entity_id },
          description: r.description, ip_address: r.ip_address, metadata: m,
        };
      }),
    });
  } catch (error) {
    console.error('List audit logs error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── GET /admin/audit-logs/summary?from&to ─────────────
exports.getAuditSummary = async (req, res) => {
  try {
    const to = req.query.to ? new Date(req.query.to) : new Date();
    const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 30 * 86400000);
    if (isNaN(to) || isNaN(from) || from > to) return res.status(400).json({ ok: false, message: 'Invalid date range.' });
    const rep = { from, to };

    const [byAction, byAdmin, byDay, bySeverity, byActorType] = await Promise.all([
      q(`SELECT action_type, COUNT(*) count FROM audit_logs WHERE created_at BETWEEN :from AND :to
         GROUP BY action_type ORDER BY count DESC`, rep),
      q(`SELECT al.actor_admin_id admin_id, u.username, COUNT(*) count
         FROM audit_logs al LEFT JOIN admins a ON a.id = al.actor_admin_id LEFT JOIN users u ON u.id = a.user_id
         WHERE al.actor_admin_id IS NOT NULL AND al.created_at BETWEEN :from AND :to
         GROUP BY al.actor_admin_id, u.username ORDER BY count DESC`, rep),
      q(`SELECT DATE_FORMAT(created_at, '%Y-%m-%d') d, COUNT(*) count FROM audit_logs
         WHERE created_at BETWEEN :from AND :to GROUP BY d ORDER BY d`, rep),
      q(`SELECT severity, COUNT(*) count FROM audit_logs WHERE created_at BETWEEN :from AND :to GROUP BY severity`, rep),
      q(`SELECT actor_type, COUNT(*) count FROM audit_logs WHERE created_at BETWEEN :from AND :to GROUP BY actor_type`, rep),
    ]);

    const fix = rows => rows.map(r => ({ ...r, count: num(r.count) }));
    res.json({
      ok: true, range: { from, to },
      by_action: fix(byAction), by_admin: fix(byAdmin), by_day: fix(byDay),
      by_severity: fix(bySeverity), by_actor_type: fix(byActorType),
    });
  } catch (error) {
    console.error('Audit summary error:', error);
    res.status(500).json({ ok: false, message: 'Server error.' });
  }
};

// ─── GET /admin/audit-logs/action-types ────────────────
exports.getActionTypes = (req, res) => {
  const categories = Object.entries(A.CATEGORIES).map(([category, types]) => ({ category, action_types: types }));
  res.json({ ok: true, action_types: A.ALL, categories, severities: SEVERITIES, actor_types: ACTOR_TYPES });
};