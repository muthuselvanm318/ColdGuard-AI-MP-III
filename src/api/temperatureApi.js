import { api } from './client';

export async function getLatestTemperature(milkId) {
  const response = await api.get(`/api/temperature/latest/${milkId}`);
  return response.data;
}

export async function getTemperatureHistory(milkId) {
  const response = await api.get(`/api/temperature/history/${milkId}`);
  return response.data || [];
}

export async function postTemperature(data) {
  const response = await api.post('/api/temperature', data);
  return response;
}
