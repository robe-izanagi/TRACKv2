import apiClient from './client';

// ── Account Codes ──
export const generateCode = async (payload) => {
  const { data } = await apiClient.post('/admin/account-codes', payload);
  return data;
};

export const listCodes = async () => {
  const { data } = await apiClient.get('/admin/account-codes');
  return data;
};

// Unused -> inactive (blocked for used codes and during the 3-day cooldown of requested codes)
export const deactivateAccountCode = async (id) => {
  const { data } = await apiClient.put(`/admin/account-codes/${id}/deactivate`);
  return data;
};

// Hard delete (same restrictions as deactivate)
export const deleteAccountCode = async (id) => {
  const { data } = await apiClient.delete(`/admin/account-codes/${id}`);
  return data;
};

// ── Departments (TODO: backend CRUD) ──
export const getDepartments = async () => {
  const { data } = await apiClient.get('/admin/departments');
  return data;
};

export const createDepartment = async (name) => {
  // TODO: replace with actual admin endpoint when ready
  const { data } = await apiClient.post('/admin/departments', { name });
  return data;
};

export const toggleDepartment = async (id, active) => {
  const { data } = await apiClient.put(`/admin/departments/${id}/toggle`, { active });
  return data;
};

// ── Offices (TODO: backend CRUD) ──
export const getOffices = async () => {
  const { data } = await apiClient.get('/admin/offices');
  return data;
};

export const createOffice = async (name) => {
  const { data } = await apiClient.post('/admin/offices', { name });
  return data;
};

export const toggleOffice = async (id, active) => {
  const { data } = await apiClient.put(`/admin/offices/${id}/toggle`, { active });
  return data;
};

// ── Roles (read‑only) ──
export const getRoles = async () => {
  const { data } = await apiClient.get('/lookups/roles');
  return data;
};


// ── Allowed Domains ──
export const getDomains = async () => {
  const { data } = await apiClient.get('/admin/domains');
  return data;
};

export const addDomain = async (domain) => {
  const { data } = await apiClient.post('/admin/domains', { domain });
  return data;
};

export const toggleDomain = async (id) => {
  const { data } = await apiClient.put(`/admin/domains/${id}/toggle`);
  return data;
};

export const deleteDomain = async (id) => {
  const { data } = await apiClient.delete(`/admin/domains/${id}`);
  return data;
};

export const getPositions = async () => {
  const { data } = await apiClient.get('/admin/positions');
  return data;
};

export const createPosition = async (payload) => {
  const { data } = await apiClient.post('/admin/positions', payload);
  return data;
};

export const togglePosition = async (id) => {
  const { data } = await apiClient.put(`/admin/positions/${id}/toggle`);
  return data;
};

export const deletePosition = async (id) => {
  const { data } = await apiClient.delete(`/admin/positions/${id}`);
  return data;
};

export const getPositionAssignments = async () => {
  const { data } = await apiClient.get('/admin/position-assignments');
  return data;
};

export const removeAssignment = async (id) => {
  const { data } = await apiClient.put(`/admin/position-assignments/${id}/remove`);
  return data;
};

export const getAvailablePositions = async () => {
  const { data } = await apiClient.get('/admin/positions/available');
  return data;
};

export const reorderPositions = async (positions) => {
  const { data } = await apiClient.put('/admin/positions/reorder', { positions });
  return data;
};

export const updatePosition = async (id, payload) => {
  const { data } = await apiClient.put(`/admin/positions/${id}`, payload);
  return data;
};

export const combinePositions = async (sourceId, targetId) => {
  const { data } = await apiClient.post(`/admin/positions/${sourceId}/combine`, {
    target_position_id: targetId,
  });
  return data;
};

// ─── Delete Department ──────────────────────────────────
export const deleteDepartment = async (id) => {
  const { data } = await apiClient.delete(`/admin/departments/${id}`);
  return data;
};

// ─── Update Department ──────────────────────────────────
export const updateDepartment = async (id, payload) => {
  const { data } = await apiClient.put(`/admin/departments/${id}`, payload);
  return data;
};

// ─── Delete Office ──────────────────────────────────────
export const deleteOffice = async (id) => {
  const { data } = await apiClient.delete(`/admin/offices/${id}`);
  return data;
};

// ─── Update Office ──────────────────────────────────────
export const updateOffice = async (id, payload) => {
  const { data } = await apiClient.put(`/admin/offices/${id}`, payload);
  return data;
};

// ─── Update Domain ──────────────────────────────────────
export const updateDomain = async (id, payload) => {
  const { data } = await apiClient.put(`/admin/domains/${id}`, payload);
  return data;
};


export const getAdminOverview = async (params) => {
  const { data } = await apiClient.get('/admin/analytics/overview', { params });
  return data;
};

export const getAdminUserActivity = async (params) => {
  const { data } = await apiClient.get('/admin/analytics/users', { params });
  return data;
};

export const getAdminRequestAnalytics = async (params) => {
  const { data } = await apiClient.get('/admin/analytics/requests', { params });
  return data;
};

export const getAdminLoginSecurity = async (params) => {
  const { data } = await apiClient.get('/admin/analytics/login-security', { params });
  return data;
};

export const getAdminRiskSummary = async () => {
  const { data } = await apiClient.get('/admin/analytics/risk-summary');
  return data;
};

export const getAdminUserRisk = async (userId) => {
  const { data } = await apiClient.get(`/admin/analytics/risk/users/${userId}`);
  return data;
};

// type: 'account-code' | 'profile-change'
export const getRequestRecommendation = async (type, id) => {
  const { data } = await apiClient.get(`/admin/analytics/recommendations/requests/${type}/${id}`);
  return data;
};

// ── Audit logs ──
// params: { admin_id, user_id, action_type (comma list), entity_table, entity_id,
//           actor_type, severity, from, to, search, page, limit }
export const getAuditLogs = async (params) => {
  const { data } = await apiClient.get('/admin/audit-logs', { params });
  return data;
};

export const getAuditLogSummary = async (params) => {
  const { data } = await apiClient.get('/admin/audit-logs/summary', { params });
  return data;
};

export const getAuditActionTypes = async () => {
  const { data } = await apiClient.get('/admin/audit-logs/action-types');
  return data;
};