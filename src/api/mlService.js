/**
 * ColdGuard AI - Machine Learning Integration Service
 * 
 * Connects to the FastAPI backend to fetch real-time XGBoost and Random Forest predictions.
 */

export const ML_STATUS = {
  NOT_AVAILABLE: 'ML_NOT_AVAILABLE',
  MESSAGE: 'AI prediction model unavailable. Ensure FastAPI backend is running.'
};

export async function fetchLatestPrediction(milkId) {
  try {
    const response = await fetch(`/api/predictions/latest/${milkId}`);
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (err) {
    console.warn('[ML Service] ML endpoint offline or non-responsive:', err.message);
  }
  return { success: false, code: ML_STATUS.NOT_AVAILABLE, message: ML_STATUS.MESSAGE };
}

export async function forceLivePrediction(milkId) {
  try {
    const response = await fetch(`/api/predict/${milkId}`, { method: 'POST' });
    if (response.ok) {
      const data = await response.json();
      return data;
    }
  } catch (err) {
    console.warn('[ML Service] ML endpoint offline or non-responsive:', err.message);
  }
  return { success: false, code: ML_STATUS.NOT_AVAILABLE, message: ML_STATUS.MESSAGE };
}

// Adapters for the existing UI which expected these specific function signatures:
export async function predictSafetyStatus(productData, tempHistory) {
  // Try to force a live prediction or get the latest from the backend
  const res = await forceLivePrediction(productData.product_code || productData.id);
  if (res && res.success) {
    return {
      available: true,
      status_text: res.prediction.safety_status,
      probabilities: res.prediction.probabilities
    };
  }
  return { available: false, code: ML_STATUS.NOT_AVAILABLE, status_text: 'Unknown', message: ML_STATUS.MESSAGE };
}

export async function predictRemainingShelfLife(productData, tempHistory) {
  const res = await forceLivePrediction(productData.product_code || productData.id);
  if (res && res.success) {
    return {
      available: true,
      status_text: `${res.prediction.remaining_shelf_life_hours.toFixed(1)} hours`,
      remaining_hours: res.prediction.remaining_shelf_life_hours
    };
  }
  return { available: false, code: ML_STATUS.NOT_AVAILABLE, status_text: 'Unknown', message: ML_STATUS.MESSAGE };
}
