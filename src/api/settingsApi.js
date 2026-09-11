import { api } from './client';

export async function getSettings() {
  try {
    const response = await api.get('/api/settings');
    return response.data || null;
  } catch (error) {
    console.error("Failed to fetch settings", error);
    return null;
  }
}

export async function updateSettings(settingsData) {
  try {
    const response = await api.put('/api/settings', settingsData);
    return response;
  } catch (error) {
    console.error("Failed to update settings", error);
    throw error;
  }
}

export async function resetSettings() {
  try {
    const response = await api.post('/api/settings/reset', {});
    return response.data || null;
  } catch (error) {
    console.error("Failed to reset settings", error);
    throw error;
  }
}
