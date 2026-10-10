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
  return {
    ...data,
    items: Array.isArray(data.items)
      ? data.items.filter((role) => ['heads', 'staff', 'faculty'].includes(role.name))
      : data.items,
  };
};

export const getPositions = async () => {
  const { data } = await apiClient.get('/lookups/positions');
  return data;
};

export const getAvailablePositionsPublic = async () => {
  const { data } = await apiClient.get('/lookups/available-positions');
  return data;
};

export const getDomains = async () => {
  const { data } = await apiClient.get('/lookups/domains');
  return data;
};