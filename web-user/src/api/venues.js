import apiClient from './client';

export const getVenues = async () => {
  const { data } = await apiClient.get('/venues');
  return data;
};

export const createVenue = async (payload) => {
  const { data } = await apiClient.post('/venues', payload);
  return data;
};

export const updateVenue = async (id, payload) => {
  const { data } = await apiClient.put(`/venues/${id}`, payload);
  return data;
};

export const archiveVenue = async (id) => {
  const { data } = await apiClient.delete(`/venues/${id}`);
  return data;
};