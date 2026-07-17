import { useState, useEffect, useCallback } from 'react';
import { predictSafetyScore } from '../services/predictionService';

/**
 * Custom hook that wraps the ML prediction service.
 * Automatically computes necessary features from a device's history and product data,
 * then calls the ML model.
 */
export const usePrediction = (product, device, history) => {
  const [prediction, setPrediction] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [error, setError] = useState(null);

  const runPrediction = useCallback(async () => {
    if (!product || !device || !history || history.length === 0) return;

    setIsPredicting(true);
    setError(null);

    try {
      // 1. Compute features based on available data
      const temps = history.map(h => h.temp);
      const recentTemps = temps.slice(-12); // Last hour (assuming 5min intervals)
      const currentTemp = device.currentTemp;
      
      const avgTemp1h = recentTemps.length ? recentTemps.reduce((a, b) => a + b, 0) / recentTemps.length : currentTemp;
      const maxTemp1h = recentTemps.length ? Math.max(...recentTemps) : currentTemp;
      const avgTemp24h = temps.length ? temps.reduce((a, b) => a + b, 0) / temps.length : currentTemp;
      const maxTemp24h = temps.length ? Math.max(...temps) : currentTemp;
      
      const safeThreshold = device.targetTemp + 1.0;
      const breaches = temps.filter(t => t > safeThreshold);
      const timeAboveThreshold = breaches.length * 5; // 5 mins per reading
      
      // Simple breach count heuristic: count transitions from <= threshold to > threshold
      let breachCount = 0;
      for (let i = 1; i < temps.length; i++) {
        if (temps[i-1] <= safeThreshold && temps[i] > safeThreshold) {
          breachCount++;
        }
      }

      const storageHours = (Date.now() - new Date(product.storageDate).getTime()) / (1000 * 60 * 60);

      const features = {
        current_temp: currentTemp,
        avg_temp_1h: avgTemp1h,
        max_temp_1h: maxTemp1h,
        avg_temp_24h: avgTemp24h,
        max_temp_24h: maxTemp24h,
        time_above_threshold: timeAboveThreshold,
        breach_count_24h: breachCount,
        food_category: product.category,
        storage_duration: storageHours,
        humidity: 60.0 // Mock fixed humidity for now
      };

      // 2. Call ML Service
      const result = await predictSafetyScore(features);
      setPrediction(result);
      
    } catch (err) {
      console.error("Prediction failed", err);
      setError(err.message);
    } finally {
      setIsPredicting(false);
    }
  }, [product, device, history]);

  // Optionally, run prediction automatically on a timer or when critical data changes
  // For now, we expose it so components can trigger it or we trigger it once on mount
  useEffect(() => {
    runPrediction();
  }, [runPrediction]);

  return { prediction, isPredicting, error, refetch: runPrediction };
};
