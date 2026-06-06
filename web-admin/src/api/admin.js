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