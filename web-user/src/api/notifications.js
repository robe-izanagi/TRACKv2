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

export const markAllNotificationsRead = async () => {
  const { data } = await apiClient.put('/notifications/read-all');
  return data;
};

export const getPushPublicKey = async () => {
  const { data } = await apiClient.get('/push-notifications/public-key');
  return data;
};

export const savePushSubscription = async (subscription) => {
  const { data } = await apiClient.post('/push-notifications/subscriptions', subscription);
  return data;
};

export const removePushSubscription = async (endpoint) => {
  const { data } = await apiClient.delete('/push-notifications/subscriptions', {
    data: { endpoint },
  });
  return data;
};