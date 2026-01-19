import Constants from 'expo-constants';

export function getApiBaseUrl() {
  if (process.env.EXPO_PUBLIC_API_BASE_URL) {
    return process.env.EXPO_PUBLIC_API_BASE_URL;
  }

  const hostUri = Constants.expoConfig?.hostUri ?? Constants.manifest2?.extra?.expoClient?.hostUri;
  if (hostUri) {
    const host = hostUri.split(':')[0];
    return `http://${host}:8000`;
  }

  return 'http://localhost:8000';
}

export const API_BASE_URL = getApiBaseUrl();
