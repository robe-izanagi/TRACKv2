import axios from 'axios';

const configuredApiUrl = import.meta.env.VITE_API_URL?.replace(/\/+$/, '');
const defaultApiUrl = import.meta.env.DEV
  ? 'http://localhost:3001/api'
  : 'https://trackv2-68rg.onrender.com/api';
const apiBaseURL = configuredApiUrl
  ? (/\/api$/i.test(configuredApiUrl) ? configuredApiUrl : `${configuredApiUrl}/api`)
  : defaultApiUrl;

const apiClient = axios.create({
  baseURL: apiBaseURL,
  headers: { 'Content-Type': 'application/json' }
});

export const getMediaUrl = (url) => {
  if (!url || /^(data:|blob:|https?:\/\/)/i.test(url)) return url;
  return new URL(url, `${new URL(apiBaseURL).origin}/`).toString();
};

apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

apiClient.interceptors.response.use(
  (response) => response,
  (error) => {
    const status = error.response?.status;
    const serverMessage = error.response?.data?.message;
    const isGenericMessage = typeof serverMessage === 'string'
      && /^(server error|internal server error|something went wrong|request failed)\.?$/i.test(serverMessage.trim());
    const validationErrors = error.response?.data?.errors;
    const detailMessage = Array.isArray(validationErrors)
      ? validationErrors.map((item) => [item.field || item.path, item.message || item.msg].filter(Boolean).join(': ')).filter(Boolean).join(' ')
      : '';
    const setResponseMessage = (message) => {
      if (!error.response) return;
      if (!error.response.data || typeof error.response.data !== 'object') {
        error.response.data = {};
      }
      error.response.data.message = message;
    };

    if (detailMessage) {
      setResponseMessage(detailMessage);
      error.message = detailMessage;
    } else if (!serverMessage || isGenericMessage) {
      const messages = {
        401: 'Your session has expired or is no longer valid. Sign in again, then retry your action.',
        403: 'You do not have permission to do this. Check that you are signed in with the correct account.',
        404: 'This item could not be found. It may have been deleted, archived, or moved, or your access may have changed.',
        409: 'This change conflicts with the latest information. Refresh the page, review the current details, and try again.',
        413: 'The selected file is too large to upload. Choose a smaller file and try again.',
        422: 'Some of the information is invalid. Review the fields and correct the highlighted details.',
        429: 'Too many requests were made in a short time. Wait a moment, then try again.',
      };
      const friendlyMessage = !error.response
        ? 'TRACK could not reach the server. Check your internet connection and try again.'
        : messages[status] || (status >= 500
          ? 'The server could not complete this request. Your information has not been confirmed as saved. Try again, and contact support if the problem continues.'
          : 'We could not complete this request. Check the information and your connection, then try again.');
      setResponseMessage(friendlyMessage);
      error.message = friendlyMessage;
    } else {
      error.message = serverMessage;
    }
    return Promise.reject(error);
  },
);

export default apiClient;