import apiClient from './client';

export const loginAdmin = async (username, password) => {
  const { data } = await apiClient.post('/auth/login', { username, password });
  return data;
};

export const getAdminMe = async () => {
  const { data } = await apiClient.get('/admin/me');
  return data;
};

export const changeAdminPassword = async (payload) => {
  const { data } = await apiClient.put('/admin/change-password', payload);
  return data;
};