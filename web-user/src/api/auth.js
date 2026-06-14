import apiClient from './client';

export const getGoogleUrl = async (redirectUrl) => {
  const params = redirectUrl ? { redirect: redirectUrl } : {};
  const { data } = await apiClient.get('/auth/google', { params });
  return data;
};

export const completeGoogleRegistration = async (registrationToken, accountCode) => {
  const { data } = await apiClient.post('/auth/complete-google-registration', {
    registration_token: registrationToken,
    account_code: accountCode
  });
  return data;
};

export const getMe = async () => {
  const { data } = await apiClient.get('/auth/me');
  return data;
};