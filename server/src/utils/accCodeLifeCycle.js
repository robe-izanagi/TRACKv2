const { Op } = require('sequelize');

// ─── Rules ──────────────────────────────────────────────
const DAY_MS = 24 * 60 * 60 * 1000;
const AUTO_DEACTIVATE_DAYS = 7;   // any unused code becomes inactive after this
const REQUEST_COOLDOWN_DAYS = 3;  // requested codes can't be deactivated/deleted before this
const SWEEP_INTERVAL_MS = 60 * 60 * 1000; // run the auto-deactivate sweep hourly

// A code is "requested" if it came from an approved account code request.
const isRequestedCode = (code) =>
  code.source_type === 'request_approved' || !!code.account_code_request_id;

const autoDeactivateAt = (code) =>
  new Date(new Date(code.created_at).getTime() + AUTO_DEACTIVATE_DAYS * DAY_MS);

const actionsAvailableAt = (code) =>
  new Date(new Date(code.created_at).getTime() + REQUEST_COOLDOWN_DAYS * DAY_MS);

const isPastAutoDeactivate = (code, now = new Date()) =>
  now >= autoDeactivateAt(code);

/**
 * Can the admin deactivate/delete this code right now?
 * Returns null if allowed, otherwise { status, message } to send back.
 */
function getActionBlock(code, now = new Date()) {
  if (code.status === 'used' || code.used_by_user_id) {
    return {
      status: 409,
      message: 'This account code is already used, so no actions are allowed.',
    };
  }

  if (isRequestedCode(code)) {
    const availableAt = actionsAvailableAt(code);
    if (now < availableAt) {
      const daysLeft = Math.ceil((availableAt - now) / DAY_MS);
      return {
        status: 403,
        message: `Requested codes can only be deactivated or deleted ${REQUEST_COOLDOWN_DAYS} days after they are created. Available in ${daysLeft} day${daysLeft === 1 ? '' : 's'}.`,
      };
    }
  }

  return null;
}

/**
 * Can this code still be used to register?
 * Returns null if usable, otherwise an error message.
 * Also enforces the 7-day rule directly, so a code can never be used
 * between sweeps.
 */
function getUsabilityError(code, now = new Date()) {
  if (code.status === 'used') return 'Account code already used.';
  if (code.status !== 'unused') {
    return 'This account code has been deactivated and can no longer be used.';
  }
  if (code.expires_at && new Date(code.expires_at) < now) {
    return 'Account code has expired.';
  }
  if (isPastAutoDeactivate(code, now)) {
    return 'This account code is older than 7 days and has been deactivated.';
  }
  return null;
}

// ─── Auto-deactivate sweep ──────────────────────────────
async function deactivateStaleCodes() {
  const { AccountCode } = require('../models');
  const cutoff = new Date(Date.now() - AUTO_DEACTIVATE_DAYS * DAY_MS);
  const [count] = await AccountCode.update(
    { status: 'inactive' },
    { where: { status: 'unused', created_at: { [Op.lt]: cutoff } } }
  );
  return count;
}

function startAutoDeactivate() {
  const run = async () => {
    try {
      const count = await deactivateStaleCodes();
      if (count > 0) {
        console.log(`[account-codes] Auto-deactivated ${count} code(s) older than ${AUTO_DEACTIVATE_DAYS} days.`);
      }
    } catch (err) {
      console.error('[account-codes] Auto-deactivate sweep failed:', err.message);
    }
  };

  run();
  const timer = setInterval(run, SWEEP_INTERVAL_MS);
  if (timer.unref) timer.unref();
}

module.exports = {
  AUTO_DEACTIVATE_DAYS,
  REQUEST_COOLDOWN_DAYS,
  isRequestedCode,
  autoDeactivateAt,
  actionsAvailableAt,
  isPastAutoDeactivate,
  getActionBlock,
  getUsabilityError,
  deactivateStaleCodes,
  startAutoDeactivate,
};