import apiClient from './client';

export const getDepartments = async () => {
  const { data } = await apiClient.get('/lookups/departments');
  return data;
};

export const getOffices = async () => {
  const { data } = await apiClient.get('/lookups/offices');
  return data;
};

export const getRoles = async () => {
  const { data } = await apiClient.get('/lookups/roles');
  return data;
};