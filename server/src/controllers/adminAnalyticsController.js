// src/controllers/adminAnalyticsController.js
// Admin-only analytics. Mounted behind requireAdmin (see routes/admin.js).
const svc = require('../services/adminAnalyticsService');
const risk = require('../services/riskService');

const DAY = 86400000;
const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const REQUEST_TYPES = ['account-code', 'profile-change'];

// ?range=30 (1-365) or ?from=&to=
function parseRange(query) {
  const to = query.to ? new Date(query.to) : new Date();
  let from;
  if (query.from) {
    from = new Date(query.from);
  } else {
    const days = Math.min(365, Math.max(1, Number(query.range) || 30));
    from = new Date(to.getTime() - days * DAY);
  }
  if (isNaN(to) || isNaN(from) || from > to) return null;
  from.setHours(0, 0, 0, 0);
  return { from, to, days: Math.max(1, Math.round((to - from) / DAY)) };
}

const badRange = res => res.status(400).json({ ok: false, message: 'Invalid date range.' });
const serverError = (res, label, error) => {
  console.error(`${label} error:`, error);
  res.status(500).json({ ok: false, message: 'Server error.' });
};

// ─── GET /admin/analytics/overview ─────────────────────
exports.getOverview = async (req, res) => {
  try {
    const r = parseRange(req.query);
    if (!r) return badRange(res);
    const { from, to, days } = r;

    const [totals, period, logins, loginSummary, requests, regs, dist, adminActions, riskMarkers] = await Promise.all([
      svc.getTotals(), svc.periodCounts(from, to), svc.loginTrend(from, to), svc.loginSummary(from, to),
      svc.requestTrend(from, to), svc.registrationTrend(from, to), svc.distribution(),
      svc.adminActionSummary(from, to), risk.riskCounts(),
    ]);

    res.json({
      ok: true, generated_at: new Date().toISOString(),
      range: { from, to, days },
      totals, period: { ...period, logins: loginSummary },
      trends: { logins, requests, registrations: regs },
      distribution: dist,
      admin_actions_summary: adminActions,
      risk_markers: riskMarkers,
    });
  } catch (error) {
    serverError(res, 'Admin overview', error);
  }
};

// ─── GET /admin/analytics/users ────────────────────────
exports.getUserActivity = async (req, res) => {
  try {
    const r = parseRange(req.query);
    if (!r) return badRange(res);
    const { from, to, days } = r;

    const [totals, regs, dist, irregular, forecast] = await Promise.all([
      svc.getTotals(), svc.registrationTrend(from, to), svc.distribution(),
      svc.irregularRegistrations(from, to), svc.registrationForecast(to),
    ]);

    res.json({
      ok: true, range: { from, to, days },
      status_breakdown: totals.users,
      registration_trend: regs,
      distribution: dist,
      irregular_patterns: irregular,
      registration_forecast: forecast,
    });
  } catch (error) {
    serverError(res, 'Admin user activity', error);
  }
};

// ─── GET /admin/analytics/requests ─────────────────────
exports.getRequestAnalytics = async (req, res) => {
  try {
    const r = parseRange(req.query);
    if (!r) return badRange(res);
    const { from, to, days } = r;

    const [summary, trend, volume, deptOutlook, officeOutlook, spam] = await Promise.all([
      svc.requestSummary(from, to), svc.requestTrend(from, to), svc.requestVolumeForecast(to),
      svc.departmentOutlook(), svc.officeOutlook(), svc.spamMarkers(),
    ]);
    const approvalOutlook = await svc.approvalOutlook(volume);

    res.json({
      ok: true, range: { from, to, days },
      summary, trend,
      volume_forecast: volume,
      department_outlook: deptOutlook,
      office_outlook: officeOutlook,
      approval_outlook: approvalOutlook,
      spam_markers: spam,
    });
  } catch (error) {
    serverError(res, 'Admin request analytics', error);
  }
};

// ─── GET /admin/analytics/login-security ───────────────
exports.getLoginSecurity = async (req, res) => {
  try {
    const r = parseRange(req.query);
    if (!r) return badRange(res);
    const { from, to, days } = r;

    const [summary, trend, reasons, offenders, forecast] = await Promise.all([
      svc.loginSummary(from, to), svc.loginTrend(from, to), svc.failureReasons(from, to),
      svc.repeatFailures(new Date(Date.now() - DAY)), svc.loginForecast(to),
    ]);

    // enrich repeat offenders by account with a batched (masked) user lookup
    const briefs = await risk.userBrief(offenders.by_user.map(o => o.user_id));
    offenders.by_user = offenders.by_user.map(o => ({ ...o, user: briefs.get(o.user_id) || null }));

    res.json({
      ok: true, range: { from, to, days },
      summary, trend, failure_reasons: reasons,
      repeat_offenders: offenders,
      forecast,
    });
  } catch (error) {
    serverError(res, 'Admin login security', error);
  }
};

// ─── GET /admin/analytics/risk-summary ─────────────────
exports.getRiskSummary = async (req, res) => {
  try {
    const data = await risk.getRiskSummary();
    res.json({ ok: true, generated_at: new Date().toISOString(), ...data });
  } catch (error) {
    serverError(res, 'Admin risk summary', error);
  }
};

// ─── GET /admin/analytics/risk/users/:userId ───────────
exports.getUserRisk = async (req, res) => {
  try {
    const { userId } = req.params;
    if (!UUID_RE.test(userId)) return res.status(400).json({ ok: false, message: 'Invalid user id.' });
    const data = await risk.getUserRisk(userId);
    if (!data) return res.status(404).json({ ok: false, message: 'User not found.' });
    res.json({ ok: true, ...data });
  } catch (error) {
    serverError(res, 'Admin user risk', error);
  }
};

// ─── GET /admin/analytics/recommendations/requests/:type/:id ──
exports.getRequestRecommendation = async (req, res) => {
  try {
    const { type, id } = req.params;
    if (!REQUEST_TYPES.includes(type)) {
      return res.status(400).json({ ok: false, message: `type must be one of: ${REQUEST_TYPES.join(', ')}` });
    }
    if (!UUID_RE.test(id)) return res.status(400).json({ ok: false, message: 'Invalid request id.' });
    const data = await risk.recommendRequest(type, id);
    if (!data) return res.status(404).json({ ok: false, message: 'Request not found.' });
    res.json({ ok: true, ...data });
  } catch (error) {
    serverError(res, 'Admin request recommendation', error);
  }
};