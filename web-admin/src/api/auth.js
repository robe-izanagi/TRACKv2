import apiClient from './client';

export const loginAdmin = async (username, password) => {
  const { data } = await apiClient.post('/auth/login', { username, password });
  return data;
};