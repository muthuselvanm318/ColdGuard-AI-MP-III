import React, { useState, useEffect } from 'react';
import { useData } from '../context/DataContext';
import TemperatureChart from '../components/TemperatureChart';
import DemoBanner from '../components/DemoBanner';
import { BarChart3, Filter, ShieldCheck, Activity, AlertCircle, BrainCircuit, Play, Clock, CheckCircle2 } from 'lucide-react';
import { forceLivePrediction, getLatestPrediction } from '../api/predictionsApi';

// Normalise prediction across both old and new API shapes
function normalisePrediction(raw) {
  if (!raw) return null;
  // new v2.0 shape has shelf_life / safety / dashboard blocks
  if (raw.shelf_life && raw.safety) {
    return {
      predicted_shelf_life_days:  raw.shelf_life.remaining_days,
      predicted_status:           raw.safety.label,
      prediction_time:            raw.prediction_time || new Date().toISOString()
    };
  }
  // old / prediction wrapper shape
  const p = raw.prediction || raw;
  return {
    predicted_shelf_life_days:  p.remaining_shelf_life_hours ? +(p.remaining_shelf_life_hours / 24).toFixed(2) : null,
    predicted_status:           p.safety_status ?? null,
    prediction_time:            p.prediction_time || p.timestamp || new Date().toISOString()
  };
}

export default function Analytics() {
  const { temperatureReadings, alerts, products, devices } = useData();
  const [selectedProduct, setSelectedProduct] = useState('ALL');
  
  // Model Prediction State
  const safeProducts = products || [];
  const [predictingProduct, setPredictingProduct] = useState(safeProducts.length > 0 ? safeProducts[0].milk_id : '');
  const [predictionResult, setPredictionResult] = useState(null);
  const [isPredicting, setIsPredicting] = useState(false);
  const [predictionError, setPredictionError] = useState(null);

  // Sync predictingProduct once products load (they may be empty on first render)
  useEffect(() => {
    if (!predictingProduct && safeProducts.length > 0) {
      setPredictingProduct(safeProducts[0].milk_id);
    }
  }, [safeProducts, predictingProduct]);

  useEffect(() => {
    if (predictingProduct) {
      loadLatestPrediction();
    }
  }, [predictingProduct]);

  const loadLatestPrediction = async () => {
    try {
      setPredictionError(null);
      const result = await getLatestPrediction(predictingProduct);
      setPredictionResult(normalisePrediction(result));
    } catch (err) {
      // It's okay if there's no latest prediction
      setPredictionResult(null);
    }
  };

  const handleForcePrediction = async () => {
    if (!predictingProduct) return;
    setIsPredicting(true);
    setPredictionError(null);
    try {
      const result = await forceLivePrediction(predictingProduct);
      if (result) {
        setPredictionResult(normalisePrediction(result));
      } else {
        setPredictionError("Failed to generate prediction. Ensure device has recent temperature data.");
      }
    } catch (err) {
      setPredictionError("Failed to generate prediction. Ensure device has recent temperature data.");
    } finally {
      setIsPredicting(false);
    }
  };

  const safeReadings = temperatureReadings || [];
  const safeAlerts = alerts || [];
  const safeDevices = devices || [];
  const filtered = selectedProduct === 'ALL'
    ? safeReadings
    : safeReadings.filter(r => r.milk_id === selectedProduct || r.product_id === selectedProduct); // Support both keys

  const hasData = filtered.length > 0;

  return (
    <div className="page-container">
      <DemoBanner />

      <div className="page-header">
        <h2 className="page-title">Cold-Chain Analytics & AI Predictions</h2>
        <p className="page-subtitle">Aggregated metrics, breach occurrences, and ML-powered shelf life forecasting</p>
      </div>

      <div className="glass-card table-toolbar mb-6">
        <div className="filter-group">
          <label className="text-xs text-muted flex-align"><Filter size={14} /> Filter Chart Data:</label>
          <select value={selectedProduct} onChange={e => setSelectedProduct(e.target.value)} className="select-input">
            <option value="ALL">All Food Items</option>
            {safeProducts.map(p => (
              <option key={p.id || p.milk_id} value={p.milk_id}>{p.product_name} ({p.milk_id})</option>
            ))}
          </select>
        </div>
      </div>

      {/* Analytics Summary Cards */}
      <div className="stats-grid-4 mb-6">
        <div className="stat-card">
          <span className="metric-label">Products Monitored</span>
          <span className="metric-val text-primary">{safeProducts.length}</span>
          <span className="metric-sub">Active batches</span>
        </div>
        <div className="stat-card">
          <span className="metric-label">Device Uptime</span>
          <span className="metric-val text-success">98.4%</span>
          <span className="metric-sub">ESP32 wireless reliability</span>
        </div>
        <div className="stat-card">
          <span className="metric-label">Total Breaches</span>
          <span className="metric-val text-warning">{safeAlerts.length}</span>
          <span className="metric-sub">Threshold events</span>
        </div>
        <div className="stat-card">
          <span className="metric-label">Node Count</span>
          <span className="metric-val text-info">{safeDevices.length}</span>
          <span className="metric-sub">Deployed sensors</span>
        </div>
      </div>

      <div className="dashboard-grid-2 mb-6">
        {/* Charts */}
        <div className="glass-card section-card" style={{ gridColumn: 'span 1' }}>
          <h3 className="section-title mb-4">
            <BarChart3 size={18} className="text-primary" /> Thermal Stream Trend
          </h3>
          {hasData ? (
            <TemperatureChart data={filtered} height={320} />
          ) : (
            <div className="chart-empty-state py-12 text-center text-muted border border-dashed border-glass rounded">
              <AlertCircle size={32} className="text-muted mx-auto mb-2" />
              <p>No data available for the selected analytics filter</p>
            </div>
          )}
        </div>

        {/* AI Model Integration Panel */}
        <div className="glass-card section-card">
          <h3 className="section-title mb-4">
            <BrainCircuit size={18} className="text-purple" /> ML Model Integration
          </h3>
          <p className="text-sm text-muted mb-4">Select a product batch to run the XGBoost/RandomForest models and predict remaining shelf life and safety status based on thermal history.</p>
          
          <div className="mb-4">
            <label className="text-xs font-bold text-muted block mb-2">Target Product Batch:</label>
            <select 
              value={predictingProduct} 
              onChange={e => setPredictingProduct(e.target.value)} 
              className="select-input"
              style={{width: '100%'}}
            >
              {safeProducts.map(p => (
                <option key={p.id || p.milk_id} value={p.milk_id}>{p.product_name} ({p.milk_id})</option>
              ))}
            </select>
          </div>

          <button 
            className="btn-primary flex-center justify-center mb-6" 
            style={{width: '100%'}}
            onClick={handleForcePrediction}
            disabled={isPredicting || !predictingProduct}
          >
            {isPredicting ? (
              <><div className="spinner mr-2" style={{width: '16px', height: '16px', borderTopColor: 'white'}}></div> Running Model...</>
            ) : (
              <><Play size={16} className="mr-2"/> Force Live Prediction</>
            )}
          </button>

          {predictionError && (
            <div className="text-danger text-sm mb-4 p-3" style={{backgroundColor: '#FEF2F2', borderRadius: '4px', border: '1px solid #FECACA'}}>
              <AlertCircle size={14} className="inline mr-1" /> {predictionError}
            </div>
          )}

          {predictionResult && (
            <div className="prediction-results bg-subtle p-4 border border-glass" style={{borderRadius: '8px', padding: '16px', background: 'var(--bg-subtle)'}}>
              <h4 className="text-sm font-bold mb-3 flex-align"><CheckCircle2 size={16} className="text-success mr-2"/> Latest Prediction Result</h4>
              
              <div style={{display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px'}}>
                <div style={{background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-crisp)'}}>
                  <div className="text-xs text-muted mb-1 flex-align"><Clock size={12} className="mr-1"/> Shelf Life</div>
                  <div className="text-lg font-bold text-primary">{predictionResult.predicted_shelf_life_days?.toFixed(1) ?? '—'} Days</div>
                </div>
                <div style={{background: 'var(--bg-card)', padding: '12px', borderRadius: '8px', border: '1px solid var(--border-glass)', boxShadow: 'var(--shadow-crisp)'}}>
                  <div className="text-xs text-muted mb-1 flex-align"><ShieldCheck size={12} className="mr-1"/> Safety Status</div>
                  <div className={`text-lg font-bold ${predictionResult.predicted_status === 'SAFE' ? 'text-success' : predictionResult.predicted_status === 'UNSAFE' ? 'text-danger' : 'text-warning'}`}>
                    {predictionResult.predicted_status || 'UNKNOWN'}
                  </div>
                </div>
              </div>
              <div className="text-xs text-muted mt-3 text-right">
                Generated at: {predictionResult.prediction_time ? new Date(predictionResult.prediction_time).toLocaleTimeString() : 'Just now'}
              </div>
            </div>
          )}
          
          {!predictionResult && !predictionError && !isPredicting && (
             <div className="text-sm text-muted text-center py-6 border border-dashed border-glass rounded">
                Click 'Force Live Prediction' to query the ML model.
             </div>
          )}
        </div>
      </div>

    </div>
  );
}
