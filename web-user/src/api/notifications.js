import apiClient from './client';

export const getInvitations = async (params = {}) => {
  const { data } = await apiClient.get('/notifications/invitations', { params });
  return data;
};

export const respondToInvitation = async (eventId, response) => {
  const { data } = await apiClient.put(`/notifications/${eventId}/respond`, { response });
  return data;
};

export const getNotificationFeed = async (params = {}) => {
  const { data } = await apiClient.get('/notifications/feed', { params });
  return data;
};

export const getUnreadCount = async () => {
  const { data } = await apiClient.get('/notifications/unread-count');
  return data;
};

export const markNotificationRead = async (id) => {
  const { data } = await apiClient.put(`/notifications/${id}/read`);
  return data;
};

export const deleteNotification = async (id) => {
  const { data } = await apiClient.delete(`/notifications/${id}`);
  return data;
};

export const restoreNotification = async (id) => {
  const { data } = await apiClient.post(`/notifications/${id}/restore`);
  return data;
};

export const markAllNotificationsRead = async () => {
  const { data } = await apiClient.put('/notifications/read-all');
  return data;
};
