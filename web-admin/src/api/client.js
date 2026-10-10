import axios from 'axios';

const apiClient = axios.create({
  // baseURL: 'http://localhost:3001/api', // localhost server
  baseURL: 'https://trackv2-68rg.onrender.com/api', // live server
  headers: { 'Content-Type': 'application/json' }
});

export const getMediaUrl = (url) => {
  if (!url || /^(data:|blob:|https?:\/\/)/i.test(url)) return url;
  return new URL(url, `${new URL(apiClient.defaults.baseURL).origin}/`).toString();
};

// Automatically attach token if present
apiClient.interceptors.request.use((config) => {
  const token = localStorage.getItem('admin_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

export default apiClient;