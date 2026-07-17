/**
 * predictionService.js
 * 
 * Mock ML Prediction Service for Food Safety Assessment.
 * 
 * IMPORTANT: This is a placeholder for your actual machine learning model.
 * Once your model is trained and deployed as an API (e.g., Flask/FastAPI),
 * you will replace the logic in `predictSafetyScore` with a real `fetch()` call.
 */

/**
 * Expected Feature Input for the Model:
 * 
 * 1. current_temp (float)       - Current reading in °C
 * 2. avg_temp_1h (float)        - Average temp over last 1 hour
 * 3. max_temp_1h (float)        - Maximum temp in last 1 hour
 * 4. avg_temp_24h (float)       - Average temp over last 24 hours
 * 5. max_temp_24h (float)       - Maximum temp in last 24 hours
 * 6. time_above_threshold (int) - Minutes spent above safe threshold (e.g., 4°C for fridge)
 * 7. breach_count_24h (int)     - Number of separate times threshold was crossed in 24h
 * 8. food_category (string)     - e.g., 'dairy', 'meat', 'seafood', 'vegetables', 'fruits'
 * 9. storage_duration (float)   - Hours since product was stored
 * 10. humidity (float)          - Current humidity percentage (if available, else 0)
 */

const SAFE_THRESHOLDS = {
  meat: 4.0,
  dairy: 4.0,
  seafood: 2.0,
  vegetables: 7.0,
  fruits: 7.0,
  beverages: 10.0,
  frozen: -18.0
};

/**
 * Simulates an ML model prediction based on input features.
 * @param {Object} features - The 10 input features
 * @returns {Promise<Object>} - The predicted safety score and risk level
 */
export const predictSafetyScore = async (features) => {
  // Simulate network latency for the API call
  await new Promise(resolve => setTimeout(resolve, 300));

  console.log('Sending features to model:', features);

  // MOCK LOGIC: Calculate a fake score based on features to mimic a model's behavior.
  // In reality, this will be: `const response = await fetch('YOUR_API_URL', { body: JSON.stringify(features) })`
  
  let score = 100;
  
  const threshold = SAFE_THRESHOLDS[features.food_category] || 4.0;
  
  // Penalize for current temp being too high
  if (features.current_temp > threshold) {
    score -= (features.current_temp - threshold) * 5;
  }
  
  // Penalize for max temp spikes
  if (features.max_temp_1h > threshold + 2) {
    score -= 10;
  }
  
  // Heavy penalty for cumulative time above threshold
  if (features.time_above_threshold > 0) {
    // e.g., lose 1 point for every 5 minutes above threshold
    score -= Math.min(40, features.time_above_threshold / 5);
  }
  
  // Penalty for multiple breaches
  if (features.breach_count_24h > 0) {
    score -= features.breach_count_24h * 5;
  }
  
  // Minor degradation over storage time (e.g. lose 1 point every 24h)
  score -= (features.storage_duration / 24);

  // Clamp score between 0 and 100
  score = Math.max(0, Math.min(100, Math.round(score)));

  // Determine Risk Level based on Score
  let riskLevel = 'Safe';
  let confidence = 0.85 + (Math.random() * 0.1); // Fake confidence 85-95%

  if (score < 50) {
    riskLevel = 'Unsafe';
  } else if (score < 80) {
    riskLevel = 'Caution';
  }

  return {
    safetyScore: score,
    riskLevel: riskLevel,
    confidence: parseFloat(confidence.toFixed(2)),
    predictedAt: new Date().toISOString()
  };
};
