// src/services/riskService.js
// Rule-based risk scoring + prescriptive recommendations.
// Everything here RECOMMENDS; nothing blocks/approves automatically (auto_action: false).
const { Op } = require('sequelize');
const {
  User, UserProfile, Department, Admin, AccountCodeRequest, ProfileChangeRequest,
  AccountCode, AuditLog, Position, PositionAssignment, Role,
} = require('../models');
const svc = require('./adminAnalyticsService');
const { fillDaily, linearSlope, trendLabel, mean, std, clamp, r1, r2 } = require('../utils/forecast');
const { maskEmail } = require('../utils/auditLogger');
const A = require('../utils/auditActions');

const { q, NOT_ADMIN, DAY, smoothedRate } = svc;
const num = v => Number(v) || 0;
const TZ_OFFSET_HOURS = Number(process.env.ANALYTICS_TZ_OFFSET_HOURS ?? 8); // DB stores UTC -> Manila
const PRIVILEGED_ROLES = (process.env.PRIVILEGED_ROLE_NAMES || 'admin,administrator,superadmin')
  .split(',').map(s => s.trim().toLowerCase()).filter(Boolean);

// ─── User risk scoring ──────────────────────────────────
const cap = (n, per, max) => Math.min(max, n * per);
const levelOf = s => (s >= 75 ? 'critical' : s >= 50 ? 'high' : s >= 25 ? 'medium' : 'low');

function scoreUser(s) {
  const parts = [
    ['failed_logins_24h', cap(s.failed_24h, 4, 40)],
    ['failed_logins_7d', cap(s.failed_7d, 1, 10)],
    ['multiple_ips', cap(Math.max(0, s.ips_24h - 1), 5, 15)],
    ['fail_then_success', s.failed_24h >= 3 && s.last_success && s.last_failed && new Date(s.last_success) > new Date(s.last_failed) ? 15 : 0],
    ['attempts_while_blocked', cap(s.blocked_attempts_7d, 5, 15)],
    ['block_history_30d', cap(s.blocks_30d, 10, 20)],
    ['suspicious_flags_7d', cap(s.flags_7d, 10, 20)],
    ['rejected_profile_changes_30d', cap(s.rejected_pc_30d, 5, 15)],
    ['frequent_profile_changes_30d', s.pc_30d > 3 ? 10 : 0],
    ['privileged_account_targeted', s.is_admin && s.failed_24h >= 3 ? 10 : 0],
  ].filter(([, pts]) => pts > 0);
  const score = clamp(parts.reduce((t, [, p]) => t + p, 0), 0, 100);
  return { score, level: levelOf(score), signals: parts.map(([key, points]) => ({ key, points })) };
}

const emptySignals = user_id => ({
  user_id, failed_24h: 0, failed_7d: 0, ips_24h: 0, blocked_attempts_7d: 0,
  last_failed: null, last_success: null, blocks_30d: 0, flags_7d: 0,
  rejected_pc_30d: 0, pc_30d: 0, is_admin: false,
});

// One grouped query per source (login_attempts, audit_logs) — never per user.
async function collectUserSignals(userId = null) {
  const now = Date.now();
  const rep = { d1: new Date(now - DAY), d7: new Date(now - 7 * DAY), d30: new Date(now - 30 * DAY) };
  if (userId) rep.uid = userId;
  const lf = userId ? ' AND user_id = :uid' : '';
  const af = userId ? ' AND target_user_id = :uid' : '';

  const [logins, audits, admins] = await Promise.all([
    q(`SELECT user_id,
         SUM(attempt_status = 'failed' AND created_at >= :d1) failed_24h,
         SUM(attempt_status = 'failed') failed_7d,
         COUNT(DISTINCT CASE WHEN attempt_status = 'failed' AND created_at >= :d1 THEN ip_address END) ips_24h,
         SUM(failure_reason = 'blocked') blocked_attempts_7d,
         MAX(CASE WHEN attempt_status = 'failed' THEN created_at END) last_failed,
         MAX(CASE WHEN attempt_status = 'success' THEN created_at END) last_success
       FROM login_attempts WHERE user_id IS NOT NULL AND created_at >= :d7${lf} GROUP BY user_id`, rep),
    q(`SELECT target_user_id user_id,
         SUM(action_type = 'user_blocked') blocks_30d,
         SUM(action_type = 'suspicious_activity_detected' AND created_at >= :d7) flags_7d,
         SUM(action_type = 'profile_change_rejected') rejected_pc_30d,
         SUM(action_type = 'profile_change_requested') pc_30d
       FROM audit_logs WHERE target_user_id IS NOT NULL AND created_at >= :d30${af} GROUP BY target_user_id`, rep),
    q(`SELECT user_id FROM admins${userId ? ' WHERE user_id = :uid' : ''}`, rep),
  ]);

  const map = new Map();
  const get = id => { if (!map.has(id)) map.set(id, emptySignals(id)); return map.get(id); };
  logins.forEach(r => Object.assign(get(r.user_id), {
    failed_24h: num(r.failed_24h), failed_7d: num(r.failed_7d), ips_24h: num(r.ips_24h),
    blocked_attempts_7d: num(r.blocked_attempts_7d), last_failed: r.last_failed, last_success: r.last_success,
  }));
  audits.forEach(r => Object.assign(get(r.user_id), {
    blocks_30d: num(r.blocks_30d), flags_7d: num(r.flags_7d),
    rejected_pc_30d: num(r.rejected_pc_30d), pc_30d: num(r.pc_30d),
  }));
  const adminIds = new Set(admins.map(a => a.user_id));
  map.forEach((s, id) => { s.is_admin = adminIds.has(id); });
  return map;
}

function recommendUser(score, s, status) {
  if (status === 'blocked' || status === 'suspended') {
    return { action: 'already_restricted', auto_action: false, reason: `Account is already ${status}` };
  }
  if ((s.failed_24h >= 10 && s.ips_24h >= 3) || score >= 75 || (s.flags_7d >= 2 && s.failed_24h >= 5)) {
    return {
      action: 'block', auto_action: false,
      reason: `${s.failed_24h} failed logins from ${s.ips_24h} IP(s) in 24h; risk score ${score}`,
    };
  }
  if (score >= 50) {
    return { action: 'review_security', auto_action: false, reason: `Risk score ${score}; review sessions and recent logins` };
  }
  if (score >= 25) return { action: 'monitor', auto_action: false, reason: `Elevated signals (score ${score})` };
  return { action: 'none', auto_action: false, reason: 'No significant risk signals' };
}

// 14-day failed-login slope -> projected failures/day -> re-scored
function projectUser(s, dailyRows, from, to) {
  const series = fillDaily(dailyRows, from, to);
  const counts = series.map(p => p.value);
  const slope = linearSlope(counts);
  const projected = Math.max(0, mean(counts.slice(-7)) + slope * 7);
  const re = scoreUser({ ...s, failed_24h: Math.round(projected) });
  return {
    trend: trendLabel(slope), slope: r2(slope), projected_failed_per_day: r1(projected),
    forecast_score: re.score, forecast_level: re.level,
    confidence: counts.reduce((a, b) => a + b, 0) >= 5 ? 'low' : 'insufficient_data',
  };
}

async function dailyFailed(ids, from) {
  if (!ids.length) return new Map();
  const rows = await q(
    `SELECT user_id, DATE_FORMAT(created_at, '%Y-%m-%d') d, COUNT(*) n FROM login_attempts
     WHERE attempt_status = 'failed' AND user_id IN (:ids) AND created_at >= :from GROUP BY user_id, d`,
    { ids, from }
  );
  const map = new Map();
  rows.forEach(r => { if (!map.has(r.user_id)) map.set(r.user_id, []); map.get(r.user_id).push({ d: r.d, n: num(r.n) }); });
  return map;
}

// Batched user lookup (no per-row queries). Email is masked.
async function userBrief(ids) {
  const unique = [...new Set(ids.filter(Boolean))];
  if (!unique.length) return new Map();
  const [users, profiles] = await Promise.all([
    User.findAll({ where: { id: { [Op.in]: unique } }, attributes: ['id', 'username', 'email', 'status'] }),
    UserProfile.findAll({ where: { user_id: { [Op.in]: unique } }, attributes: ['user_id', 'department_id'] }),
  ]);
  const deptIds = [...new Set(profiles.map(p => p.department_id).filter(Boolean))];
  const depts = deptIds.length
    ? await Department.findAll({ where: { id: { [Op.in]: deptIds } }, attributes: ['id', 'name'] })
    : [];
  const deptName = new Map(depts.map(d => [d.id, d.name]));
  const profileOf = new Map(profiles.map(p => [p.user_id, p]));
  return new Map(users.map(u => [u.id, {
    user_id: u.id, username: u.username, email: maskEmail(u.email), status: u.status,
    department: deptName.get(profileOf.get(u.id)?.department_id) || null,
  }]));
}

async function riskCounts() {
  const signals = await collectUserSignals();
  const counts = { critical: 0, high: 0, medium: 0, low: 0 };
  signals.forEach(s => { if (!s.is_admin) counts[scoreUser(s).level] += 1; });
  const [row] = await q(`SELECT COUNT(*) n FROM users u WHERE ${NOT_ADMIN}`);
  return {
    critical: counts.critical, high: counts.high, medium: counts.medium,
    low_or_none: Math.max(0, num(row?.n) - counts.critical - counts.high - counts.medium),
  };
}

async function getUserRisk(userId) {
  const user = await User.findByPk(userId, { attributes: ['id', 'username', 'email', 'status'] });
  if (!user) return null;
  const map = await collectUserSignals(userId);
  const s = map.get(userId) || (() => { const e = emptySignals(userId); return e; })();
  const admin = await Admin.findOne({ where: { user_id: userId }, attributes: ['id'] });
  s.is_admin = !!admin;
  const to = new Date(), from = new Date(Date.now() - 13 * DAY);
  const daily = await dailyFailed([userId], from);
  const scored = scoreUser(s);
  const brief = (await userBrief([userId])).get(userId);
  return {
    user: brief, ...scored,
    raw_signals: {
      failed_24h: s.failed_24h, failed_7d: s.failed_7d, distinct_ips_24h: s.ips_24h,
      blocks_30d: s.blocks_30d, suspicious_flags_7d: s.flags_7d,
      rejected_profile_changes_30d: s.rejected_pc_30d, profile_changes_30d: s.pc_30d,
    },
    forecast: projectUser(s, daily.get(userId) || [], from, to),
    recommendation: recommendUser(scored.score, s, user.status),
  };
}

// ─── Admins that may need review ────────────────────────
async function adminsToReview() {
  const now = Date.now();
  const rep = { d30: new Date(now - 30 * DAY), d60: new Date(now - 60 * DAY), d90: new Date(now - 90 * DAY), tz: TZ_OFFSET_HOURS };
  const [actions, failed, followed, dormant, admins] = await Promise.all([
    q(`SELECT actor_admin_id admin_id, COUNT(*) total,
         SUM(action_type IN ('account_code_approved','profile_change_approved')) approvals,
         SUM(action_type IN ('account_code_rejected','profile_change_rejected')) rejections,
         SUM(action_type = 'user_blocked') blocks,
         SUM(((HOUR(created_at) + :tz) % 24) >= 22 OR ((HOUR(created_at) + :tz) % 24) < 5) off_hours
       FROM audit_logs WHERE actor_admin_id IS NOT NULL AND action_type <> 'admin_login' AND created_at >= :d30
       GROUP BY actor_admin_id`, rep),
    q(`SELECT user_id, COUNT(*) failed FROM login_attempts
       WHERE is_admin_login = 1 AND attempt_status = 'failed' AND created_at >= :d30 AND user_id IS NOT NULL
       GROUP BY user_id`, rep),
    q(`SELECT r.reviewed_by_admin_id admin_id, COUNT(*) n
       FROM account_code_requests r
       JOIN users u ON u.email = r.email
       JOIN audit_logs b ON b.target_user_id = u.id AND b.action_type = 'user_blocked'
        AND b.created_at BETWEEN r.reviewed_at AND DATE_ADD(r.reviewed_at, INTERVAL 30 DAY)
       WHERE r.status = 'approved' AND r.reviewed_at >= :d90 AND r.reviewed_by_admin_id IS NOT NULL
       GROUP BY r.reviewed_by_admin_id`, rep),
    q(`SELECT a.id admin_id FROM admins a WHERE a.is_active = 1 AND a.created_at < :d60
       AND NOT EXISTS (SELECT 1 FROM login_attempts l WHERE l.user_id = a.user_id
                       AND l.attempt_status = 'success' AND l.created_at >= :d60)`, rep),
    q(`SELECT a.id admin_id, a.user_id, u.username FROM admins a LEFT JOIN users u ON u.id = a.user_id WHERE a.is_active = 1`),
  ]);

  const totals = actions.map(r => num(r.total));
  const m = mean(totals), s = std(totals);
  const failedBy = new Map(failed.map(r => [r.user_id, num(r.failed)]));
  const followedBy = new Map(followed.map(r => [r.admin_id, num(r.n)]));
  const dormantSet = new Set(dormant.map(r => r.admin_id));
  const actBy = new Map(actions.map(r => [r.admin_id, r]));

  const out = [];
  for (const a of admins) {
    const act = actBy.get(a.admin_id);
    const reasons = [];
    if (act) {
      const total = num(act.total);
      const z = s > 0 ? (total - m) / s : 0;
      if (actions.length >= 3 && z >= 2) reasons.push({ code: 'HIGH_ACTION_VOLUME', message: `Action volume ${total} is ${r1(z)}σ above peers` });
      const offShare = total ? num(act.off_hours) / total : 0;
      if (total >= 5 && offShare >= 0.3) reasons.push({ code: 'OFF_HOURS_ACTIONS', message: `${Math.round(offShare * 100)}% of actions between 22:00 and 05:00` });
      const decided = num(act.approvals) + num(act.rejections);
      if (decided >= 10 && num(act.rejections) / decided >= 0.8) reasons.push({ code: 'HIGH_REJECTION_RATE', message: 'Rejects 80%+ of reviewed requests' });
      if (num(act.blocks) >= 5) reasons.push({ code: 'BULK_BLOCKS', message: `${num(act.blocks)} users blocked in 30 days` });
    }
    const f = failedBy.get(a.user_id) || 0;
    if (f >= 5) reasons.push({ code: 'FAILED_LOGINS', message: `${f} failed admin logins in 30 days` });
    const fb = followedBy.get(a.admin_id) || 0;
    if (fb >= 2) reasons.push({ code: 'APPROVALS_LATER_BLOCKED', message: `${fb} approved requesters were blocked within 30 days` });
    if (dormantSet.has(a.admin_id)) reasons.push({ code: 'DORMANT_ADMIN', message: 'Active admin with no successful login in 60 days' });
    if (reasons.length) out.push({ admin_id: a.admin_id, username: a.username || null, reasons });
  }
  return out.sort((x, y) => y.reasons.length - x.reasons.length);
}

// ─── Next-step recommendations ──────────────────────────
async function buildNextSteps({ topUsers, admins, forecast }) {
  const steps = [];
  const d5 = new Date(Date.now() - 5 * DAY), d7 = new Date(Date.now() - 7 * DAY);
  const [pending, expiring] = await Promise.all([
    q(`SELECT (SELECT COUNT(*) FROM account_code_requests WHERE status = 'pending') acr,
              (SELECT COUNT(*) FROM profile_change_requests WHERE status = 'pending') pcr,
              (SELECT MIN(created_at) FROM account_code_requests WHERE status = 'pending') oldest`),
    q(`SELECT COUNT(*) n FROM account_codes WHERE status = 'unused' AND created_at <= :d5 AND created_at > :d7`, { d5, d7 }),
  ]);
  const acr = num(pending[0]?.acr), pcr = num(pending[0]?.pcr);
  const oldestHrs = pending[0]?.oldest ? (Date.now() - new Date(pending[0].oldest).getTime()) / 3600000 : 0;

  topUsers.filter(u => u.recommendation.action === 'block').forEach(u => steps.push({
    type: 'consider_block', title: `Review ${u.user?.username || 'user'} for blocking`, detail: u.recommendation.reason,
    target: { type: 'user', id: u.user?.user_id }, action: { label: 'Open user', endpoint: `PUT /admin/users/${u.user?.user_id}/toggle-block` },
  }));
  topUsers.filter(u => u.recommendation.action === 'review_security').forEach(u => steps.push({
    type: 'review_user_security', title: `Review account security for ${u.user?.username || 'user'}`, detail: u.recommendation.reason,
    target: { type: 'user', id: u.user?.user_id }, action: { label: 'View risk', endpoint: `GET /admin/analytics/risk/users/${u.user?.user_id}` },
  }));
  admins.slice(0, 3).forEach(a => steps.push({
    type: 'review_admin', title: `Review admin ${a.username || a.admin_id}`, detail: a.reasons.map(r => r.message).join('; '),
    target: { type: 'admin', id: a.admin_id }, action: { label: 'View audit log', endpoint: `GET /admin/audit-logs?admin_id=${a.admin_id}` },
  }));
  if (acr + pcr > 0 && (acr + pcr >= 5 || oldestHrs >= 72)) {
    steps.push({
      type: 'pending_backlog',
      title: `${acr} account code and ${pcr} profile change request(s) pending`,
      detail: oldestHrs ? `Oldest account code request is ${Math.round(oldestHrs / 24)} day(s) old` : 'Review the queue',
      target: { type: 'requests' }, action: { label: 'Open requests' },
    });
  }
  if (forecast?.expected_spike_days?.length) {
    steps.push({
      type: 'failed_login_spike_expected',
      title: `Failed-login spike expected on ${forecast.expected_spike_days[0]}`,
      detail: 'Consider tightening rate limits and monitoring repeat offenders that day',
      target: { type: 'login-security' }, action: { label: 'Open login security' },
    });
  }
  if (forecast?.current?.spike_active) {
    steps.push({
      type: 'failed_login_spike_active', title: 'Failed-login spike is active today',
      detail: `z-score ${forecast.current.z} versus 28-day baseline`,
      target: { type: 'login-security' }, action: { label: 'Open login security' },
    });
  }
  if (num(expiring[0]?.n) > 0) {
    steps.push({
      type: 'codes_expiring', title: `${num(expiring[0].n)} unused account code(s) nearing the 7-day auto-deactivation`,
      detail: 'Follow up with the recipients or regenerate', target: { type: 'account-codes' }, action: { label: 'Open account codes' },
    });
  }
  return steps.map((s, i) => ({ priority: i + 1, ...s }));
}

async function getRiskSummary() {
  const signals = await collectUserSignals();
  const scored = [...signals.values()]
    .filter(s => !s.is_admin)
    .map(s => ({ s, ...scoreUser(s) }))
    .filter(x => x.score > 0)
    .sort((a, b) => b.score - a.score);
  const top = scored.slice(0, 10);

  const to = new Date(), from = new Date(Date.now() - 13 * DAY);
  const [briefs, daily, admins, forecast, counts] = await Promise.all([
    userBrief(top.map(x => x.s.user_id)),
    dailyFailed(top.map(x => x.s.user_id), from),
    adminsToReview(),
    svc.loginForecast(),
    riskCounts(),
  ]);

  const users = top.map(x => {
    const brief = briefs.get(x.s.user_id) || { user_id: x.s.user_id };
    return {
      user: brief, score: x.score, level: x.level, signals: x.signals,
      forecast: projectUser(x.s, daily.get(x.s.user_id) || [], from, to),
      recommendation: recommendUser(x.score, x.s, brief.status),
    };
  });
  const next_steps = await buildNextSteps({ topUsers: users, admins, forecast });
  return { counts, users, admins_to_review: admins, next_steps };
}

// ─── Request recommendations (approve / reject / escalate / flag) ──
const SEVERITY_ORDER = ['reject', 'flag', 'escalate'];

function decide(reasons, approvalRate) {
  for (const sev of SEVERITY_ORDER) {
    const hit = reasons.filter(r => r.severity === sev);
    if (hit.length) {
      const base = { reject: 0.85, flag: 0.7, escalate: 0.65 }[sev];
      return { recommendation: sev, confidence: r2(Math.min(0.95, base + 0.05 * (hit.length - 1))) };
    }
  }
  return { recommendation: 'approve', confidence: r2(0.6 + 0.3 * (approvalRate ?? 0.5)) };
}

async function recommendAccountCodeRequest(id) {
  const r = await AccountCodeRequest.findByPk(id);
  if (!r) return null;
  const reasons = [];
  const add = (code, severity, message) => reasons.push({ code, severity, message });
  const d1 = new Date(Date.now() - DAY), d7 = new Date(Date.now() - 7 * DAY), d30 = new Date(Date.now() - 30 * DAY);

  const [existingUser, otherPending, priorApproved, rejected30, requests7d, reqAudit, sameDesc, deptStats] = await Promise.all([
    User.findOne({ where: { email: r.email }, attributes: ['id'] }),
    AccountCodeRequest.count({ where: { email: r.email, status: 'pending', id: { [Op.ne]: r.id } } }),
    AccountCodeRequest.findAll({ where: { email: r.email, status: 'approved', id: { [Op.ne]: r.id } }, attributes: ['id'] }),
    AccountCodeRequest.count({ where: { email: r.email, status: 'rejected', reviewed_at: { [Op.gte]: d30 } } }),
    AccountCodeRequest.count({ where: { email: r.email, created_at: { [Op.gte]: d7 } } }),
    AuditLog.findOne({ where: { action_type: A.ACCOUNT_CODE_REQUESTED, entity_id: r.id }, attributes: ['ip_address'] }),
    r.description && r.description.trim()
      ? AccountCodeRequest.count({ where: { description: r.description, id: { [Op.ne]: r.id }, created_at: { [Op.gte]: d30 } } })
      : 0,
    r.department_id
      ? q(`SELECT SUM(status = 'approved') approved, SUM(status = 'rejected') rejected
           FROM account_code_requests WHERE department_id = :dep AND id <> :id`, { dep: r.department_id, id: r.id })
      : [],
  ]);

  const unusedCodes = priorApproved.length
    ? await AccountCode.count({ where: { account_code_request_id: { [Op.in]: priorApproved.map(x => x.id) }, status: 'unused' } })
    : 0;
  const ipCount = reqAudit?.ip_address
    ? await AuditLog.count({ where: { action_type: A.ACCOUNT_CODE_REQUESTED, ip_address: reqAudit.ip_address, created_at: { [Op.gte]: d1 } } })
    : 0;

  if (existingUser) add('EMAIL_ALREADY_REGISTERED', 'reject', 'This email already belongs to a registered user');
  if (otherPending > 0) add('DUPLICATE_PENDING', 'reject', `${otherPending} other pending request(s) from this email`);
  if (unusedCodes > 0) add('UNUSED_CODE_EXISTS', 'reject', 'An approved, unused account code already exists for this email');
  if (rejected30 >= 3) add('REPEATED_REJECTIONS', 'reject', `${rejected30} rejections for this email in 30 days`);
  if (requests7d >= 3) add('REPEAT_EMAIL_7D', 'flag', `${requests7d} requests from this email in 7 days`);
  if (ipCount >= 3) add('IP_CLUSTER_24H', 'flag', `${ipCount} requests from the same IP in 24 hours`);
  if (!r.description || r.description.trim().length < 10) add('SHORT_DESCRIPTION', 'flag', 'Description missing or under 10 characters');
  if (sameDesc > 0) add('DUPLICATE_DESCRIPTION', 'flag', 'Identical description used in another recent request');

  if (r.position_id) {
    const [pos, assigned] = await Promise.all([
      Position.findByPk(r.position_id),
      PositionAssignment.count({ where: { position_id: r.position_id, status: 'active' } }),
    ]);
    if (pos && !pos.allow_multiple && assigned > 0) {
      add('POSITION_OCCUPIED', 'escalate', 'Requested single-occupancy position is already assigned');
    }
  }
  if (r.role_id) {
    const role = await Role.findByPk(r.role_id, { attributes: ['name'] });
    if (role && PRIVILEGED_ROLES.includes(String(role.name).toLowerCase())) {
      add('PRIVILEGED_ROLE', 'escalate', `Requested role "${role.name}" is privileged`);
    }
  }

  const st = deptStats[0] || {};
  const rate = r.department_id ? smoothedRate(num(st.approved), num(st.rejected)) : null;
  return {
    request_id: r.id, type: 'account-code', status: r.status,
    ...decide(reasons, rate), auto_action: false, reasons,
    context: {
      requester_email: maskEmail(r.email),
      department_smoothed_approval_rate: rate != null ? r2(rate) : null,
      prior_rejections_30d: rejected30, requests_7d: requests7d,
    },
  };
}

async function recommendProfileChangeRequest(id) {
  const r = await ProfileChangeRequest.findByPk(id);
  if (!r) return null;
  const reasons = [];
  const add = (code, severity, message) => reasons.push({ code, severity, message });
  const d30 = new Date(Date.now() - 30 * DAY);

  const [otherPending, rejected30, userRisk] = await Promise.all([
    ProfileChangeRequest.count({ where: { user_id: r.user_id, status: 'pending', id: { [Op.ne]: r.id } } }),
    ProfileChangeRequest.count({ where: { user_id: r.user_id, status: 'rejected', reviewed_at: { [Op.gte]: d30 } } }),
    getUserRisk(r.user_id),
  ]);

  const changedFields = r.changes && typeof r.changes === 'object' ? Object.keys(r.changes) : [];
  const touchesPrivilege = !!(r.requested_role_id || r.requested_position_id
    || changedFields.some(k => /role|position/i.test(k)));

  if (rejected30 >= 3) add('REPEATED_REJECTIONS', 'reject', `${rejected30} rejected profile changes in 30 days`);
  if (userRisk && ['high', 'critical'].includes(userRisk.level)) {
    add('USER_RISK_HIGH', 'flag', `Requester risk level is ${userRisk.level} (score ${userRisk.score})`);
  }
  if (otherPending > 0) add('MULTIPLE_PENDING', 'flag', `${otherPending} other pending request(s) from this user`);
  if (touchesPrivilege) add('ROLE_OR_POSITION_CHANGE', 'escalate', 'Changes role or position (privilege-affecting)');

  if (r.requested_position_id) {
    const [pos, assigned] = await Promise.all([
      Position.findByPk(r.requested_position_id),
      PositionAssignment.count({ where: { position_id: r.requested_position_id, status: 'active', user_id: { [Op.ne]: r.user_id } } }),
    ]);
    if (pos && !pos.allow_multiple && assigned > 0) add('POSITION_OCCUPIED', 'escalate', 'Requested single-occupancy position is assigned to someone else');
  }

  return {
    request_id: r.id, type: 'profile-change', status: r.status,
    ...decide(reasons, null), auto_action: false, reasons,
    context: { changed_fields: changedFields, other_pending: otherPending, rejected_30d: rejected30, requester_risk_level: userRisk?.level || 'low' },
  };
}

const recommendRequest = (type, id) =>
  type === 'account-code' ? recommendAccountCodeRequest(id) : recommendProfileChangeRequest(id);

module.exports = {
  scoreUser, levelOf, recommendUser, collectUserSignals, userBrief,
  riskCounts, getUserRisk, getRiskSummary, adminsToReview, recommendRequest,
};