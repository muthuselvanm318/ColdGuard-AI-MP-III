import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import SafetyBadge from '../components/SafetyBadge';
import TemperatureChart from '../components/TemperatureChart';
import { getProductById } from '../api/productsApi';
import { getTemperatureHistory, getLatestTemperature } from '../api/temperatureApi';
import { getPredictions, getLatestPrediction } from '../api/predictionsApi';
import { 
  ArrowLeft, 
  Package, 
  Box, 
  Cpu, 
  Calendar, 
  Clock, 
  Thermometer, 
  BrainCircuit, 
  AlertTriangle 
} from 'lucide-react';

export default function ProductDetails() {
  const { id } = useParams(); // Using milk_id

  const [product, setProduct] = useState(null);
  const [temperatureHistory, setTemperatureHistory] = useState([]);
  const [latestTemperature, setLatestTemperature] = useState(null);
  const [predictionHistory, setPredictionHistory] = useState([]);
  const [latestPrediction, setLatestPrediction] = useState(null);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadData() {
      try {
        setLoading(true);
        // The id from useParams might be the database auto-increment ID or the milk_id.
        // Assuming we look up by milk_id. Our backend getProductById usually takes the auto-increment ID or milk_id. 
        // We will fetch it directly.
        const [prod, tempHist, latestTemp, predHist, latestPred] = await Promise.all([
          getProductById(id).catch(() => null),
          getTemperatureHistory(id).catch(() => []),
          getLatestTemperature(id).catch(() => null),
          getPredictions(id).catch(() => []),
          getLatestPrediction(id).catch(() => null)
        ]);

        if (!mounted) return;

        if (prod) {
          setProduct(prod);
          setTemperatureHistory(tempHist || []);
          setLatestTemperature(latestTemp || null);
          setPredictionHistory(predHist || []);
          setLatestPrediction(latestPred || null);
        } else {
          setError("Product not found");
        }
      } catch (err) {
        if (mounted) setError("Unable to load data. Please try again.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadData();
    const interval = setInterval(loadData, 15000); // Polling every 15s

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, [id]);

  if (loading && !product) {
    return (
      <div className="page-container flex-center">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p>Loading product details...</p>
        </div>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="page-container">
        <div className="glass-card section-card text-center py-12">
          <AlertTriangle size={48} className="mx-auto text-danger mb-4" />
          <h3>{error || "Product Not Found"}</h3>
          <Link to="/products" className="btn-primary mt-4 inline-block">Back to Products</Link>
        </div>
      </div>
    );
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <Link to="/products" className="back-link">
          <ArrowLeft size={16} /> Back to Products
        </Link>
        <div className="header-title-row mt-2">
          <h2 className="page-title">{product.product_name}</h2>
          <SafetyBadge status={latestPrediction ? latestPrediction.safety_status : product.status} size="large" />
        </div>
        <p className="page-subtitle">Product Code: {product.milk_id}</p>
      </div>

      <div className="grid-2-col gap-6">
        
        {/* Left Column: Product Information */}
        <div className="space-y-6">
          <div className="glass-card section-card">
            <h3 className="section-title">
              <Package size={18} className="text-primary" /> Product Information
            </h3>
            <div className="details-info-grid mt-4">
              <div className="info-item">
                <span className="info-label">Product Name</span>
                <span className="info-value">{product.product_name}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Milk Type</span>
                <span className="info-value">{product.milk_type}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Batch ID</span>
                <span className="info-value"><code>{product.milk_id}</code></span>
              </div>
              <div className="info-item">
                <span className="info-label">Storage Date</span>
                <span className="info-value"><Calendar size={14} /> {new Date(product.storage_start_time).toLocaleString()}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Expiry Date</span>
                <span className="info-value"><Calendar size={14} /> {new Date(product.expiry_time).toLocaleString()}</span>
              </div>
              <div className="info-item">
                <span className="info-label">Assigned Sensor</span>
                <span className="info-value"><Cpu size={14} /> {product.device_id || 'Unassigned'}</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Current Safety */}
        <div className="space-y-6">
          <div className="glass-card section-card">
            <h3 className="section-title">
              <ShieldCheck size={18} className="text-success" /> Current Safety
            </h3>
            
            <div className="details-info-grid mt-4">
              <div className="info-item">
                <span className="info-label">Safety Status</span>
                <span className="info-value">
                  {latestPrediction ? (
                    <SafetyBadge status={latestPrediction.safety_status} />
                  ) : (
                    <span className="text-muted">Awaiting Data</span>
                  )}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Remaining Shelf Life</span>
                <span className="info-value font-bold text-primary">
                  {latestPrediction ? `${latestPrediction.remaining_shelf_life_hours.toFixed(1)} hours` : 'Awaiting Data'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Current Temperature</span>
                <span className="info-value font-bold">
                  {latestTemperature ? `${latestTemperature.temperature_c}°C` : 'No Reading'}
                </span>
              </div>
              <div className="info-item">
                <span className="info-label">Last Updated</span>
                <span className="info-value">
                  {latestTemperature ? new Date(latestTemperature.recorded_at).toLocaleString() : 'N/A'}
                </span>
              </div>
            </div>
          </div>
        </div>

      </div>

      {/* Temperature History Chart */}
      <div className="glass-card section-card mt-6">
        <h3 className="section-title mb-4">
          <Thermometer size={18} className="text-primary" /> Temperature Exposure History
        </h3>
        {temperatureHistory.length > 0 ? (
          <TemperatureChart data={temperatureHistory} height={300} />
        ) : (
          <div className="empty-state p-6 text-center text-muted">
            <p>No temperature readings. Temperature data will appear once the sensor starts sending readings.</p>
          </div>
        )}
      </div>

      {/* Prediction History Table */}
      <div className="glass-card section-card mt-6">
        <h3 className="section-title mb-4">
          <BrainCircuit size={18} className="text-purple" /> Prediction History
        </h3>
        {predictionHistory.length === 0 ? (
          <div className="empty-state p-6 text-center text-muted">
            <p>No predictions available for this product.</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Timestamp</th>
                  <th>Safety Status</th>
                  <th>Shelf Life (Hours)</th>
                  <th>SAFE %</th>
                  <th>CAUTION %</th>
                  <th>UNSAFE %</th>
                </tr>
              </thead>
              <tbody>
                {predictionHistory.map(p => {
                  let probs = p.probabilities;
                  if (typeof probs === 'string') {
                    try { probs = JSON.parse(probs); } catch(e) {}
                  }
                  return (
                    <tr key={p.id}>
                      <td>{new Date(p.predicted_at).toLocaleString()}</td>
                      <td><SafetyBadge status={p.safety_status} /></td>
                      <td>{p.remaining_shelf_life_hours.toFixed(1)}</td>
                      <td>{probs?.SAFE ? (probs.SAFE * 100).toFixed(1) : 0}%</td>
                      <td>{probs?.CAUTION ? (probs.CAUTION * 100).toFixed(1) : 0}%</td>
                      <td>{probs?.UNSAFE ? (probs.UNSAFE * 100).toFixed(1) : 0}%</td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
