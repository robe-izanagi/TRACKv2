// src/services/adminAnalyticsService.js
// Descriptive + predictive aggregates for the admin dashboard.
// Raw grouped SQL (one query per aggregate) — no N+1. Dates use DATE_FORMAT so
// they come back as 'YYYY-MM-DD' strings. Table names follow the model files
// (users, admins, account_codes, account_code_requests, profile_change_requests,
// login_attempts, audit_logs, user_profile, departments, offices, roles).
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../models');
const { fillDaily, weekdayForecast, spikeCheck, mean, std, clamp, r1, r2 } = require('../utils/forecast');
const { maskEmail } = require('../utils/auditLogger');

const DAY = 86400000;
const q = (sql, replacements = {}) => sequelize.query(sql, { replacements, type: QueryTypes.SELECT });
const NOT_ADMIN = 'NOT EXISTS (SELECT 1 FROM admins a WHERE a.user_id = u.id)';

const num = v => Number(v) || 0;
const mapNums = row => Object.fromEntries(Object.entries(row || {}).map(([k, v]) => [k, num(v)]));
const byKey = (rows, key) => Object.fromEntries(rows.map(r => [String(r[key]), num(r.n)]));
const sumVals = o => Object.values(o).reduce((s, x) => s + x, 0);
const smoothedRate = (approved, rejected) => (approved + 1) / (approved + rejected + 2);

// ─── Descriptive ────────────────────────────────────────
exports.getTotals = async () => {
  const [admins, users, codes, acr, pcr] = await Promise.all([
    q('SELECT is_active k, COUNT(*) n FROM admins GROUP BY is_active'),
    q(`SELECT u.status k, COUNT(*) n FROM users u WHERE ${NOT_ADMIN} GROUP BY u.status`),
    q('SELECT status k, COUNT(*) n FROM account_codes GROUP BY status'),
    q('SELECT status k, COUNT(*) n FROM account_code_requests GROUP BY status'),
    q('SELECT status k, COUNT(*) n FROM profile_change_requests GROUP BY status'),
  ]);
  const a = byKey(admins, 'k'), u = byKey(users, 'k'), c = byKey(codes, 'k');
  const ar = byKey(acr, 'k'), pr = byKey(pcr, 'k');
  return {
    admins: { total: sumVals(a), active: a['1'] || 0, inactive: a['0'] || 0 },
    users: {
      total: sumVals(u), active: u.active || 0, pending: u.pending || 0,
      blocked: u.blocked || 0, suspended: u.suspended || 0,
      inactive_or_blocked: (u.blocked || 0) + (u.suspended || 0),
    },
    account_codes: {
      created: sumVals(c), used: c.used || 0, unused: c.unused || 0, inactive: c.inactive || 0,
      expired_or_revoked: (c.expired || 0) + (c.revoked || 0),
    },
    account_code_requests: {
      total: sumVals(ar), pending: ar.pending || 0, approved: ar.approved || 0, rejected: ar.rejected || 0,
    },
    profile_change_requests: {
      total: sumVals(pr), pending: pr.pending || 0, approved: pr.approved || 0, rejected: pr.rejected || 0,
    },
  };
};

exports.periodCounts = async (from, to) => {
  const [row] = await q(
    `SELECT
       (SELECT COUNT(*) FROM users u WHERE u.created_at BETWEEN :from AND :to AND ${NOT_ADMIN}) new_users,
       (SELECT COUNT(*) FROM account_codes WHERE created_at BETWEEN :from AND :to) codes_created,
       (SELECT COUNT(*) FROM account_codes WHERE used_at BETWEEN :from AND :to) codes_used,
       (SELECT COUNT(*) FROM account_code_requests WHERE created_at BETWEEN :from AND :to) account_code_requests,
       (SELECT COUNT(*) FROM profile_change_requests WHERE created_at BETWEEN :from AND :to) profile_change_requests`,
    { from, to }
  );
  return mapNums(row);
};

exports.loginTrend = async (from, to) => {
  const rows = await q(
    `SELECT DATE_FORMAT(created_at, '%Y-%m-%d') d,
            SUM(attempt_status = 'success') success, SUM(attempt_status = 'failed') failed
     FROM login_attempts WHERE created_at BETWEEN :from AND :to GROUP BY d ORDER BY d`,
    { from, to }
  );
  return rows.map(r => ({ d: r.d, success: num(r.success), failed: num(r.failed) }));
};

exports.loginSummary = async (from, to) => {
  const [row] = await q(
    `SELECT SUM(attempt_status = 'success') success,
            SUM(attempt_status = 'failed') failed,
            SUM(attempt_status = 'success' AND is_admin_login = 1) admin_success,
            SUM(attempt_status = 'failed' AND is_admin_login = 1) admin_failed,
            COUNT(DISTINCT CASE WHEN attempt_status = 'failed' THEN ip_address END) distinct_ips_failed,
            SUM(attempt_status = 'failed' AND user_id IS NULL) unknown_identifier_failed
     FROM login_attempts WHERE created_at BETWEEN :from AND :to`,
    { from, to }
  );
  const s = mapNums(row);
  const total = s.success + s.failed;
  return { ...s, failure_rate: total ? r2(s.failed / total) : 0 };
};

exports.failureReasons = async (from, to) => {
  const rows = await q(
    `SELECT COALESCE(failure_reason, 'unknown') reason, COUNT(*) count
     FROM login_attempts WHERE attempt_status = 'failed' AND created_at BETWEEN :from AND :to
     GROUP BY reason ORDER BY count DESC`,
    { from, to }
  );
  return rows.map(r => ({ reason: r.reason, count: num(r.count) }));
};

exports.requestTrend = async (from, to) => {
  const rows = await q(
    `SELECT d, SUM(kind = 'account_code') account_code, SUM(kind = 'profile_change') profile_change FROM (
       SELECT DATE_FORMAT(created_at, '%Y-%m-%d') d, 'account_code' kind
         FROM account_code_requests WHERE created_at BETWEEN :from AND :to
       UNION ALL
       SELECT DATE_FORMAT(created_at, '%Y-%m-%d'), 'profile_change'
         FROM profile_change_requests WHERE created_at BETWEEN :from AND :to
     ) t GROUP BY d ORDER BY d`,
    { from, to }
  );
  return rows.map(r => ({ d: r.d, account_code: num(r.account_code), profile_change: num(r.profile_change) }));
};

exports.registrationTrend = async (from, to) => {
  const rows = await q(
    `SELECT DATE_FORMAT(u.created_at, '%Y-%m-%d') d, COUNT(*) n FROM users u
     WHERE u.created_at BETWEEN :from AND :to AND ${NOT_ADMIN} GROUP BY d ORDER BY d`,
    { from, to }
  );
  return rows.map(r => ({ d: r.d, n: num(r.n) }));
};

exports.distribution = async () => {
  const [dept, office, role] = await Promise.all([
    q(`SELECT d.id, d.name, COUNT(*) users FROM user_profile up
       JOIN users u ON u.id = up.user_id JOIN departments d ON d.id = up.department_id
       WHERE ${NOT_ADMIN} GROUP BY d.id, d.name ORDER BY users DESC`),
    q(`SELECT o.id, o.name, COUNT(*) users FROM user_profile up
       JOIN users u ON u.id = up.user_id JOIN offices o ON o.id = up.office_id
       WHERE ${NOT_ADMIN} GROUP BY o.id, o.name ORDER BY users DESC`),
    q(`SELECT r.id, r.name, COUNT(*) users FROM user_profile up
       JOIN users u ON u.id = up.user_id JOIN roles r ON r.id = up.role_id
       WHERE ${NOT_ADMIN} GROUP BY r.id, r.name ORDER BY users DESC`),
  ]);
  const fix = rows => rows.map(r => ({ id: r.id, name: r.name, users: num(r.users) }));
  return { by_department: fix(dept), by_office: fix(office), by_role: fix(role) };
};

exports.adminActionSummary = async (from, to) => {
  const rows = await q(
    `SELECT al.actor_admin_id admin_id, u.username, COUNT(*) total,
       SUM(al.action_type IN ('account_code_approved','profile_change_approved')) approvals,
       SUM(al.action_type IN ('account_code_rejected','profile_change_rejected')) rejections,
       SUM(al.action_type = 'user_blocked') blocks,
       SUM(al.action_type = 'admin_generated_code') codes_generated,
       MAX(al.created_at) last_action_at
     FROM audit_logs al
     LEFT JOIN admins a ON a.id = al.actor_admin_id
     LEFT JOIN users u ON u.id = a.user_id
     WHERE al.actor_admin_id IS NOT NULL AND al.action_type <> 'admin_login'
       AND al.created_at BETWEEN :from AND :to
     GROUP BY al.actor_admin_id, u.username ORDER BY total DESC`,
    { from, to }
  );
  return rows.map(r => ({
    admin_id: r.admin_id, username: r.username || null, total: num(r.total),
    approvals: num(r.approvals), rejections: num(r.rejections), blocks: num(r.blocks),
    codes_generated: num(r.codes_generated), last_action_at: r.last_action_at,
  }));
};

// ─── Login security (descriptive + predictive) ──────────
exports.repeatFailures = async (since, min = 3) => {
  const [byUser, byIdentifier, byIp] = await Promise.all([
    q(`SELECT user_id, COUNT(*) failed, COUNT(DISTINCT ip_address) ips, MAX(created_at) last_failed_at
       FROM login_attempts WHERE attempt_status = 'failed' AND user_id IS NOT NULL AND created_at >= :since
       GROUP BY user_id HAVING failed >= :min ORDER BY failed DESC LIMIT 20`, { since, min }),
    q(`SELECT COALESCE(username, email) identifier, COUNT(*) failed, COUNT(DISTINCT ip_address) ips
       FROM login_attempts WHERE attempt_status = 'failed' AND user_id IS NULL AND created_at >= :since
       GROUP BY identifier HAVING failed >= :min ORDER BY failed DESC LIMIT 20`, { since, min }),
    q(`SELECT ip_address ip, COUNT(*) failed,
              COUNT(DISTINCT COALESCE(user_id, username, email)) identifiers
       FROM login_attempts WHERE attempt_status = 'failed' AND ip_address IS NOT NULL AND created_at >= :since
       GROUP BY ip_address HAVING failed >= :min ORDER BY failed DESC LIMIT 20`, { since, min }),
  ]);
  return {
    by_user: byUser.map(r => ({ user_id: r.user_id, failed: num(r.failed), ips: num(r.ips), last_failed_at: r.last_failed_at })),
    by_identifier: byIdentifier.map(r => ({ identifier: maskEmail(r.identifier), failed: num(r.failed), ips: num(r.ips) })),
    by_ip: byIp.map(r => ({ ip: r.ip, failed: num(r.failed), identifiers: num(r.identifiers) })),
  };
};

// Failed-login spike forecast: weekday baseline x growth + z-score on "today"
exports.loginForecast = async (to = new Date()) => {
  const from = new Date(to.getTime() - 28 * DAY);
  const rows = await exports.loginTrend(from, to);
  const series = fillDaily(rows.map(r => ({ d: r.d, n: r.failed })), from, to);
  const history = series.slice(0, -1);
  const today = series.length ? series[series.length - 1].value : 0;

  const f = weekdayForecast(history, 7);
  const current = spikeCheck(today, history.map(p => p.value));
  const threshold = Math.max(5, (f.baseline.mean || 0) + 2 * (f.baseline.std || 0));
  f.forecast.forEach(x => {
    x.spike_expected = f.confidence !== 'insufficient_data' && x.predicted >= threshold;
  });
  return {
    method: 'weekday_baseline_x_growth_with_zscore',
    confidence: f.confidence, growth: f.growth, slope: f.slope, trend: f.trend,
    moving_average_7d: f.moving_average_7d, baseline: f.baseline,
    spike_threshold: r1(threshold), current,
    next_7_days: f.forecast,
    expected_spike_days: f.forecast.filter(x => x.spike_expected).map(x => x.date),
  };
};

// ─── User activity ──────────────────────────────────────
exports.irregularRegistrations = async (from, to) => {
  const [hourly, fast, daily] = await Promise.all([
    q(`SELECT DATE_FORMAT(u.created_at, '%Y-%m-%d %H') h, COUNT(*) n FROM users u
       WHERE u.created_at BETWEEN :from AND :to AND ${NOT_ADMIN}
       GROUP BY h HAVING n >= :min ORDER BY n DESC LIMIT 10`, { from, to, min: 5 }),
    q(`SELECT COUNT(*) n FROM account_codes
       WHERE used_at BETWEEN :from AND :to AND source_type = 'admin_generated'
         AND TIMESTAMPDIFF(SECOND, created_at, used_at) < 60`, { from, to }),
    exports.registrationTrend(from, to),
  ]);
  const series = fillDaily(daily, from, to);
  const vals = series.map(p => p.value), m = mean(vals), s = std(vals);
  const daily_spikes = series
    .map(p => ({ date: p.date, count: p.value, z: s > 0 ? r1((p.value - m) / s) : 0 }))
    .filter(p => p.z >= 2.5 && p.count >= 5);
  return {
    hourly_bursts: hourly.map(r => ({ hour: `${r.h}:00`, registrations: num(r.n) })),
    daily_spikes,
    codes_used_within_60s_of_creation: num(fast[0]?.n),
  };
};

exports.registrationForecast = async (to = new Date()) => {
  const from = new Date(to.getTime() - 56 * DAY);
  const rows = await exports.registrationTrend(from, to);
  return weekdayForecast(fillDaily(rows, from, to), 7);
};

// ─── Requests ───────────────────────────────────────────
exports.requestSummary = async (from, to) => {
  const [acr, pcr, turnAcr, turnPcr, oldest] = await Promise.all([
    q(`SELECT status k, COUNT(*) n FROM account_code_requests WHERE created_at BETWEEN :from AND :to GROUP BY status`, { from, to }),
    q(`SELECT status k, COUNT(*) n FROM profile_change_requests WHERE created_at BETWEEN :from AND :to GROUP BY status`, { from, to }),
    q(`SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, reviewed_at)) / 60 h FROM account_code_requests
       WHERE reviewed_at IS NOT NULL AND created_at BETWEEN :from AND :to`, { from, to }),
    q(`SELECT AVG(TIMESTAMPDIFF(MINUTE, created_at, reviewed_at)) / 60 h FROM profile_change_requests
       WHERE reviewed_at IS NOT NULL AND created_at BETWEEN :from AND :to`, { from, to }),
    q(`SELECT MIN(created_at) oldest FROM account_code_requests WHERE status = 'pending'`),
  ]);
  const shape = rows => {
    const o = byKey(rows, 'k');
    const decided = (o.approved || 0) + (o.rejected || 0);
    return {
      total: sumVals(o), pending: o.pending || 0, approved: o.approved || 0, rejected: o.rejected || 0,
      approval_rate: decided ? r2((o.approved || 0) / decided) : null,
    };
  };
  const oldestAt = oldest[0]?.oldest ? new Date(oldest[0].oldest) : null;
  return {
    account_code: shape(acr),
    profile_change: shape(pcr),
    avg_review_hours: {
      account_code: turnAcr[0]?.h != null ? r1(num(turnAcr[0].h)) : null,
      profile_change: turnPcr[0]?.h != null ? r1(num(turnPcr[0].h)) : null,
    },
    oldest_pending_hours: oldestAt ? r1((Date.now() - oldestAt.getTime()) / 3600000) : null,
  };
};

exports.requestVolumeForecast = async (to = new Date()) => {
  const from = new Date(to.getTime() - 56 * DAY);
  const rows = await exports.requestTrend(from, to);
  const series = fillDaily(rows.map(r => ({ d: r.d, n: r.account_code + r.profile_change })), from, to);
  return { ...weekdayForecast(series, 14), method: 'weekday_baseline_x_growth' };
};

// Departments/offices likely to generate more account code requests
async function scopeOutlook(table, nameTable, idCol) {
  const now = Date.now();
  const d14 = new Date(now - 14 * DAY), d42 = new Date(now - 42 * DAY);
  const rows = await q(
    `SELECT r.${idCol} id, x.name,
            SUM(r.created_at >= :d14) last_14d,
            SUM(r.created_at < :d14 AND r.created_at >= :d42) prior_28d,
            SUM(r.status = 'approved') approved, SUM(r.status = 'rejected') rejected
     FROM ${table} r LEFT JOIN ${nameTable} x ON x.id = r.${idCol}
     WHERE r.${idCol} IS NOT NULL GROUP BY r.${idCol}, x.name`,
    { d14, d42 }
  );
  return rows.map(r => {
    const last = num(r.last_14d), priorScaled = num(r.prior_28d) / 2;
    const growth = clamp(priorScaled > 0 ? last / priorScaled : last > 0 ? 1.5 : 1, 0.5, 2);
    return {
      id: r.id, name: r.name || null,
      last_14d: last, prior_14d_scaled: r1(priorScaled),
      projected_next_14d: Math.round(last * growth),
      change_pct: priorScaled > 0 ? Math.round(((last - priorScaled) / priorScaled) * 100) : null,
      smoothed_approval_rate: r2(smoothedRate(num(r.approved), num(r.rejected))),
    };
  }).sort((a, b) => b.projected_next_14d - a.projected_next_14d);
}
exports.departmentOutlook = () => scopeOutlook('account_code_requests', 'departments', 'department_id');
exports.officeOutlook = () => scopeOutlook('account_code_requests', 'offices', 'office_id');

// Estimated approval/rejection pattern for the next 14 days
exports.approvalOutlook = async volumeForecast => {
  const d90 = new Date(Date.now() - 90 * DAY);
  const [row] = await q(
    `SELECT SUM(status = 'approved') approved, SUM(status = 'rejected') rejected
     FROM account_code_requests WHERE created_at >= :d90`, { d90 }
  );
  const approved = num(row?.approved), rejected = num(row?.rejected);
  const rate = smoothedRate(approved, rejected);
  const accountCodeShare = 0.6; // fallback when profile-change split is unknown
  const expectedTotal = (volumeForecast?.forecast || []).reduce((s, x) => s + x.predicted, 0) * accountCodeShare;
  return {
    sample_size: approved + rejected,
    expected_approval_rate: r2(rate),
    expected_requests_next_14d: Math.round(expectedTotal),
    expected_rejections_next_14d: Math.round(expectedTotal * (1 - rate)),
    confidence: approved + rejected >= 30 ? 'medium' : approved + rejected >= 10 ? 'low' : 'insufficient_data',
  };
};

exports.spamMarkers = async () => {
  const d7 = new Date(Date.now() - 7 * DAY);
  const [emails, ips, shortDesc] = await Promise.all([
    q(`SELECT email, COUNT(*) n FROM account_code_requests WHERE created_at >= :d7
       GROUP BY email HAVING n >= 3 ORDER BY n DESC LIMIT 10`, { d7 }),
    q(`SELECT ip_address ip, COUNT(*) n,
              COUNT(DISTINCT JSON_UNQUOTE(JSON_EXTRACT(metadata, '$.requester_email'))) emails
       FROM audit_logs WHERE action_type = 'account_code_requested' AND created_at >= :d7 AND ip_address IS NOT NULL
       GROUP BY ip_address HAVING n >= 3 ORDER BY n DESC LIMIT 10`, { d7 }),
    q(`SELECT COUNT(*) n FROM account_code_requests
       WHERE status = 'pending' AND CHAR_LENGTH(COALESCE(description, '')) < 10`),
  ]);
  const markers = [
    ...emails.map(r => ({ type: 'repeat_email', email_masked: maskEmail(r.email), requests_7d: num(r.n) })),
    ...ips.map(r => ({ type: 'ip_cluster', ip: r.ip, requests_7d: num(r.n), distinct_emails: num(r.emails) })),
  ];
  const pendingShort = num(shortDesc[0]?.n);
  if (pendingShort > 0) markers.push({ type: 'short_description_pending', count: pendingShort });
  return markers;
};

exports.q = q;
exports.NOT_ADMIN = NOT_ADMIN;
exports.smoothedRate = smoothedRate;
exports.DAY = DAY;