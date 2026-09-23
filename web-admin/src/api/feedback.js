import apiClient from './client';

export const getFeedbackSummary = async () => {
  const { data } = await apiClient.get('/admin/feedback/summary');
  return data;
};

export const getTextMining = async () => {
  const { data } = await apiClient.get('/admin/feedback/text-mining');
  return data;
};

export const getFeedbackList = async (rating = 'all') => {
  const { data } = await apiClient.get('/admin/feedback', { params: { rating } });
  return data;
};