import { api } from './client';

/**
 * Returns the full v2.0 prediction response object.
 * The Dashboard normalises whichever shape arrives.
 */
export async function getLatestPrediction(milkId) {
  try {
    const response = await api.get(`/api/predictions/latest/${milkId}`);
    if (!response.success) return null;
    // Return the full response so Dashboard can read shelf_life / safety / dashboard blocks
    return response;
  } catch {
    return null;
  }
}

export async function forceLivePrediction(milkId) {
  try {
    const response = await api.post(`/api/predict/${milkId}`, {});
    if (!response.success) return null;
    return response;
  } catch {
    return null;
  }
}

export async function getPredictions(milkId) {
  const response = await api.get(`/api/predictions/${milkId}`);
  return response.data || [];
}
