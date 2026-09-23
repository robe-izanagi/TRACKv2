import apiClient from './client';

export const submitFeedback = async (rating, comment) => {
  const { data } = await apiClient.post('/feedback', { rating, comment });
  return data;
};