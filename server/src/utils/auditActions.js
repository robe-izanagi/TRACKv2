// src/utils/auditActions.js — single source of truth for audit action types
const ACTIONS = Object.freeze({
  // authentication
  LOGIN_SUCCESS: 'login_success',
  LOGIN_FAILED: 'login_failed',
  ADMIN_LOGIN: 'admin_login',
  // registration / onboarding
  USER_REGISTERED: 'user_registered',
  ADMIN_REGISTERED: 'admin_registered',
  ACCOUNT_CODE_USED: 'account_code_used',
  // requests
  ACCOUNT_CODE_REQUESTED: 'account_code_requested',
  ACCOUNT_CODE_APPROVED: 'account_code_approved',
  ACCOUNT_CODE_REJECTED: 'account_code_rejected',
  PROFILE_CHANGE_REQUESTED: 'profile_change_requested',
  PROFILE_CHANGE_APPROVED: 'profile_change_approved',
  PROFILE_CHANGE_REJECTED: 'profile_change_rejected',
  ADMIN_REVIEWED_REQUEST: 'admin_reviewed_request',
  // governance
  USER_BLOCKED: 'user_blocked',
  USER_UNBLOCKED: 'user_unblocked',
  ADMIN_UPDATED_USER: 'admin_updated_user',
  ADMIN_DELETED_USER: 'admin_deleted_user',
  ADMIN_ROLE_CHANGED: 'admin_role_changed',
  ADMIN_GENERATED_CODE: 'admin_generated_code',
  ADMIN_DEACTIVATED_CODE: 'admin_deactivated_code',
  ADMIN_DELETED_CODE: 'admin_deleted_code',
  // security
  SUSPICIOUS_ACTIVITY: 'suspicious_activity_detected',
});

const CATEGORIES = Object.freeze({
  authentication: ['login_success', 'login_failed', 'admin_login'],
  onboarding: ['user_registered', 'admin_registered', 'account_code_used'],
  requests: [
    'account_code_requested', 'account_code_approved', 'account_code_rejected',
    'profile_change_requested', 'profile_change_approved', 'profile_change_rejected',
    'admin_reviewed_request',
  ],
  governance: [
    'user_blocked', 'user_unblocked', 'admin_updated_user', 'admin_deleted_user', 'admin_role_changed',
    'admin_generated_code', 'admin_deactivated_code', 'admin_deleted_code',
  ],
  security: ['suspicious_activity_detected'],
});

module.exports = { ...ACTIONS, ACTIONS, CATEGORIES, ALL: Object.values(ACTIONS) };