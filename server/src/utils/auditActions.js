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
  ADMIN_DEPARTMENT_CREATED: 'admin_department_created',
  ADMIN_DEPARTMENT_UPDATED: 'admin_department_updated',
  ADMIN_DEPARTMENT_TOGGLED: 'admin_department_toggled',
  ADMIN_DEPARTMENT_DELETED: 'admin_department_deleted',
  ADMIN_OFFICE_CREATED: 'admin_office_created',
  ADMIN_OFFICE_UPDATED: 'admin_office_updated',
  ADMIN_OFFICE_TOGGLED: 'admin_office_toggled',
  ADMIN_OFFICE_DELETED: 'admin_office_deleted',
  ADMIN_DOMAIN_CREATED: 'admin_domain_created',
  ADMIN_DOMAIN_UPDATED: 'admin_domain_updated',
  ADMIN_DOMAIN_TOGGLED: 'admin_domain_toggled',
  ADMIN_DOMAIN_DELETED: 'admin_domain_deleted',
  ADMIN_POSITION_CREATED: 'admin_position_created',
  ADMIN_POSITION_UPDATED: 'admin_position_updated',
  ADMIN_POSITION_TOGGLED: 'admin_position_toggled',
  ADMIN_POSITION_DELETED: 'admin_position_deleted',
  ADMIN_POSITIONS_REORDERED: 'admin_positions_reordered',
  ADMIN_POSITIONS_COMBINED: 'admin_positions_combined',
  ADMIN_POSITION_ASSIGNMENT_REMOVED: 'admin_position_assignment_removed',
  ADMIN_CODE_EMAIL_SENT: 'admin_code_email_sent',
  ADMIN_API_MUTATION: 'admin_api_mutation',
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
    'admin_department_created', 'admin_department_updated', 'admin_department_toggled', 'admin_department_deleted',
    'admin_office_created', 'admin_office_updated', 'admin_office_toggled', 'admin_office_deleted',
    'admin_domain_created', 'admin_domain_updated', 'admin_domain_toggled', 'admin_domain_deleted',
    'admin_position_created', 'admin_position_updated', 'admin_position_toggled', 'admin_position_deleted',
    'admin_positions_reordered', 'admin_positions_combined', 'admin_position_assignment_removed',
    'admin_code_email_sent',
    'admin_api_mutation',
  ],
  security: ['suspicious_activity_detected'],
});

module.exports = { ...ACTIONS, ACTIONS, CATEGORIES, ALL: Object.values(ACTIONS) };