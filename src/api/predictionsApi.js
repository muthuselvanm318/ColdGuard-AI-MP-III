import { api } from './client';

export async function getPredictions(milkId) {
  const response = await api.get(`/api/predictions/${milkId}`);
  return response.data || [];
}

export async function getLatestPrediction(milkId) {
  const response = await api.get(`/api/predictions/latest/${milkId}`);
  return response.prediction; // Assumes backend format: { success: true, prediction: {...} }
}

export async function forceLivePrediction(milkId) {
  const response = await api.post(`/api/predict/${milkId}`, {});
  return response.prediction;
}
