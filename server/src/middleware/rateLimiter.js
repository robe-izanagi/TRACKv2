const rateLimit = require('express-rate-limit');

// ─── For Admin Register (guessable account codes = brute-force risk) ───
exports.adminRegisterLimiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 5,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many account-creation attempts were made in a short time. Wait 15 minutes, then try again.' },
});

// ─── For Admin Login ───
exports.adminLoginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 8,
  standardHeaders: true,
  legacyHeaders: false,
  message: { ok: false, message: 'Too many sign-in attempts were made in a short time. Wait 15 minutes, then try again.' },
});