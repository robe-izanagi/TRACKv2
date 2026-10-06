// src/utils/auditLogger.js
// Reusable, NON-BREAKING audit helper. Never throws unless { strict: true }.
const { Op } = require('sequelize');
const { AuditLog, LoginAttempt, Admin, User, AccountCodeRequest } = require('../models');
const A = require('./auditActions');

const SENSITIVE_KEY = /pass|token|secret|hash|otp|authorization|cookie/i;

// Recursively drop credential-like keys, cap sizes, serialise dates
function scrub(v, depth = 0) {
  if (v == null || depth > 3) return v;
  if (v instanceof Date) return v.toISOString();
  if (Array.isArray(v)) return v.slice(0, 20).map(x => scrub(x, depth + 1));
  if (typeof v === 'object') {
    return Object.fromEntries(
      Object.entries(v)
        .filter(([k]) => !SENSITIVE_KEY.test(k))
        .map(([k, x]) => [k, scrub(x, depth + 1)])
    );
  }
  return typeof v === 'string' ? v.slice(0, 500) : v;
}

function maskEmail(email) {
  if (!email || typeof email !== 'string' || !email.includes('@')) return email || null;
  return email.replace(/^(.).*(@.*)$/, '$1***$2');
}

function clientIp(req) {
  const raw = req?.ip || req?.socket?.remoteAddress || '';
  const ip = String(raw).replace(/^::ffff:/, '').slice(0, 45);
  return ip || null;
}

// Snapshot the acting admin's username once per request so logs stay readable
// even if the admin is deleted later (FK is SET NULL).
async function adminSnapshot(req, adminId) {
  if (req?._auditActor?.admin_id === adminId) return req._auditActor;
  const admin = await Admin.findByPk(adminId, { attributes: ['id', 'user_id'] });
  const user = admin ? await User.findByPk(admin.user_id, { attributes: ['username'] }) : null;
  const snap = { admin_id: adminId, actor_username: user?.username || null };
  if (req) req._auditActor = snap;
  return snap;
}

/**
 * Write one audit row.
 *  - actorAdminId: omit/undefined -> req.adminId; pass null to force "no admin actor"
 *  - transaction: pass { transaction: t } so the log commits atomically with the action
 *  - strict: rethrow on failure (default: log the error and continue)
 */
async function logAudit({
  req = null, actorAdminId, actorType, targetUserId = null, actionType, entityTable,
  entityId = null, description = null, metadata = {}, severity = 'info',
  transaction = null, strict = false,
}) {
  try {
    const adminId = actorAdminId === undefined ? (req?.adminId ?? null) : actorAdminId;
    const type = actorType || (adminId ? 'admin' : targetUserId ? 'user' : 'system');
    const snap = adminId ? await adminSnapshot(req, adminId) : null;
    return await AuditLog.create({
      actor_admin_id: adminId,
      actor_type: type,
      target_user_id: targetUserId,
      action_type: actionType,
      entity_table: entityTable,
      entity_id: entityId,
      description: description ? String(description).slice(0, 2000) : null,
      severity,
      ip_address: clientIp(req),
      metadata: scrub({ ...(snap ? { actor_username: snap.actor_username } : {}), ...metadata }),
    }, { transaction });
  } catch (err) {
    console.error('Audit log write failed:', actionType, err.message);
    if (strict) throw err;
    return null;
  }
}

// System / anonymised events (detectors, scheduled jobs)
const logSystemEvent = opts => logAudit({ ...opts, actorAdminId: null, actorType: 'system' });

/**
 * One call = login_attempts row + audit row + burst detection.
 * reason: user_not_found | not_admin | blocked | invalid_password | domain_not_allowed | auth_failed
 */
async function recordLoginAttempt({
  req, user = null, username = null, email = null, method, success,
  reason = null, isAdminLogin = false, adminId = null,
}) {
  try {
    const row = await LoginAttempt.create({
      user_id: user?.id ?? null,
      username: username ? String(username).slice(0, 30) : null,
      email: email ? String(email).slice(0, 255) : null,
      method,
      attempt_status: success ? 'success' : 'failed',
      failure_reason: success ? null : reason,
      ip_address: clientIp(req),
      is_admin_login: !!isAdminLogin,
    });

    await logAudit({
      req,
      actorAdminId: success && isAdminLogin ? adminId : null,
      actorType: success ? (isAdminLogin ? 'admin' : 'user') : 'anonymous',
      targetUserId: user?.id ?? null,
      actionType: success ? (isAdminLogin ? A.ADMIN_LOGIN : A.LOGIN_SUCCESS) : A.LOGIN_FAILED,
      entityTable: 'login_attempts',
      entityId: row.id,
      severity: success ? 'info' : 'warning',
      description: success ? `${method} login succeeded` : `${method} login failed (${reason})`,
      metadata: {
        method, reason, is_admin_login: !!isAdminLogin,
        identifier: username || maskEmail(email) || null,
      },
    });

    if (!success) await detectFailedLoginBurst({ req, user, username, email });
    return row;
  } catch (err) {
    console.error('recordLoginAttempt failed:', err.message);
    return null;
  }
}

const BURST_WINDOW_MS = 15 * 60 * 1000;

// 5 failures / 15 min on one account, or 10 / 15 min from one IP -> suspicious_activity_detected
async function detectFailedLoginBurst({ req, user, username, email }) {
  try {
    const since = new Date(Date.now() - BURST_WINDOW_MS);
    const ip = clientIp(req);

    const identityOr = [username && { username }, email && { email }].filter(Boolean);
    const checks = [];
    if (user) checks.push({ scope: 'account', threshold: 5, where: { user_id: user.id } });
    else if (identityOr.length) checks.push({ scope: 'account', threshold: 5, where: { [Op.or]: identityOr } });
    if (ip) checks.push({ scope: 'ip', threshold: 10, where: { ip_address: ip } });

    for (const { scope, threshold, where } of checks) {
      const failed = await LoginAttempt.count({
        where: { ...where, attempt_status: 'failed', created_at: { [Op.gte]: since } },
      });
      if (failed < threshold) continue;

      // dedupe: one flag per scope per window
      const dedupeWhere = scope === 'ip'
        ? { ip_address: ip }
        : { target_user_id: user?.id ?? null };
      const already = await AuditLog.findOne({
        where: {
          action_type: A.SUSPICIOUS_ACTIVITY, entity_table: 'login_attempts',
          created_at: { [Op.gte]: since }, ...dedupeWhere,
        },
        attributes: ['id'],
      });
      if (already) continue;

      await logSystemEvent({
        req, targetUserId: user?.id ?? null, actionType: A.SUSPICIOUS_ACTIVITY,
        entityTable: 'login_attempts',
        severity: failed >= threshold * 2 ? 'critical' : 'warning',
        description: `${failed} failed logins in 15 min (${scope})`,
        metadata: {
          scope, failed_in_window: failed, window_minutes: 15,
          identifier: username || maskEmail(email) || null,
        },
      });
    }
  } catch (err) {
    console.error('detectFailedLoginBurst failed:', err.message);
  }
}

// Call right after an account code request is created (user-side flow). Logging only.
async function detectRequestSpam({ req, email, requestId }) {
  try {
    const ip = clientIp(req);
    const d7 = new Date(Date.now() - 7 * 86400000);
    const d1 = new Date(Date.now() - 86400000);
    const h1 = new Date(Date.now() - 3600000);

    const [sameEmail, sameIp] = await Promise.all([
      email ? AccountCodeRequest.count({ where: { email, created_at: { [Op.gte]: d7 } } }) : 0,
      ip ? AuditLog.count({
        where: { action_type: A.ACCOUNT_CODE_REQUESTED, ip_address: ip, created_at: { [Op.gte]: d1 } },
      }) : 0,
    ]);
    if (sameEmail < 3 && sameIp < 3) return;

    const already = await AuditLog.findOne({
      where: {
        action_type: A.SUSPICIOUS_ACTIVITY, entity_table: 'account_code_requests',
        ip_address: ip, created_at: { [Op.gte]: h1 },
      },
      attributes: ['id'],
    });
    if (already) return;

    await logSystemEvent({
      req, actionType: A.SUSPICIOUS_ACTIVITY, entityTable: 'account_code_requests',
      entityId: requestId || null,
      severity: sameEmail >= 5 || sameIp >= 5 ? 'critical' : 'warning',
      description: `Possible request spam: ${sameEmail} requests from one email (7d), ${sameIp} from one IP (24h)`,
      metadata: { requester_email: maskEmail(email), requests_same_email_7d: sameEmail, requests_same_ip_24h: sameIp },
    });
  } catch (err) {
    console.error('detectRequestSpam failed:', err.message);
  }
}

module.exports = {
  logAudit, logSystemEvent, recordLoginAttempt, detectRequestSpam,
  scrub, maskEmail, clientIp,
};