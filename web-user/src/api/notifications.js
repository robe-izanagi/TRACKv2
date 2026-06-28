import apiClient from './client';

export const getInvitations = async (params = {}) => {
  const { data } = await apiClient.get('/notifications/invitations', { params });
  return data;
};

export const respondToInvitation = async (eventId, response) => {
  const { data } = await apiClient.put(`/notifications/${eventId}/respond`, { response });
  return data;
};