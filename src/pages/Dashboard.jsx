import React, { useState, useEffect } from 'react';
import StatCard from '../components/StatCard';
import SafetyBadge from '../components/SafetyBadge';
import TemperatureChart from '../components/TemperatureChart';
import { getProducts } from '../api/productsApi';
import { getDevices } from '../api/devicesApi';
import { getTemperatureHistory } from '../api/temperatureApi';
import { getLatestPrediction } from '../api/predictionsApi';
import { 
  Package, 
  Wifi, 
  WifiOff, 
  AlertTriangle, 
  Thermometer, 
  ArrowRight,
  ShieldCheck,
  CheckCircle2,
  Activity,
  Flame,
  BrainCircuit,
  Clock
} from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Dashboard() {
  const [products, setProducts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [temperatureHistory, setTemperatureHistory] = useState([]);
  const [latestPrediction, setLatestPrediction] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    let mounted = true;

    async function loadDashboardData() {
      try {
        setLoading(true);
        const [prods, devs] = await Promise.all([
          getProducts(),
          getDevices()
        ]);
        
        if (!mounted) return;
        setProducts(prods || []);
        setDevices(devs || []);

        // Load data for the first product to feature on the dashboard
        if (prods && prods.length > 0) {
          const featuredProductId = prods[0].milk_id;
          
          try {
            const [history, prediction] = await Promise.all([
              getTemperatureHistory(featuredProductId),
              getLatestPrediction(featuredProductId)
            ]);
            
            if (mounted) {
              setTemperatureHistory(history || []);
              setLatestPrediction(prediction || null);
            }
          } catch (e) {
            console.warn("Failed to load featured product data", e);
          }
        }
      } catch (err) {
        if (mounted) setError("Backend connection unavailable. Unable to connect to the ColdGuard AI server.");
      } finally {
        if (mounted) setLoading(false);
      }
    }

    loadDashboardData();
    const interval = setInterval(loadDashboardData, 15000); // Polling

    return () => {
      mounted = false;
      clearInterval(interval);
    };
  }, []);

  if (loading && products.length === 0) {
    return (
      <div className="page-container flex-center">
        <div className="text-center">
          <div className="spinner mb-4"></div>
          <p>Loading dashboard data...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container flex-center">
        <div className="text-center text-danger">
          <AlertTriangle size={48} className="mb-4 mx-auto" />
          <h3 className="text-xl font-bold">Backend connection unavailable</h3>
          <p className="mt-2 text-muted">{error}</p>
          <button className="btn-primary mt-4" onClick={() => window.location.reload()}>Retry Connection</button>
        </div>
      </div>
    );
  }

  // Dashboard Cards metrics
  const totalProducts = products.length;
  const activeSensors = devices.filter(d => d.status === 'ONLINE').length;
  const offlineSensors = devices.filter(d => d.status === 'OFFLINE').length;
  const safeProducts = products.filter(p => p.status === 'SAFE').length;
  const attentionProducts = products.filter(p => p.status === 'CAUTION' || p.status === 'UNSAFE').length;

  // Temperature summary metrics
  const temps = temperatureHistory.map(r => Number(r.temperature_c)).filter(t => !isNaN(t));
  const currentTemp = temps.length ? temps[temps.length - 1] : null;
  const avgTemp = temps.length ? +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : null;
  const maxTemp = temps.length ? Math.max(...temps) : null;
  const minTemp = temps.length ? Math.min(...temps) : null;

  return (
    <div className="page-container">

      <div className="page-header flex-between">
        <div>
          <h2 className="page-title">ColdGuard AI Dashboard</h2>
          <p className="page-subtitle">Refrigerated Food Safety & Cold-Chain Monitoring Platform</p>
        </div>
        <div className="food-safety-pill-badge">
          <ShieldCheck size={18} className="text-success" />
          <span>System Online</span>
        </div>
      </div>

      {/* 4 Dashboard Cards */}
      <div className="stats-grid-6">
        <StatCard title="Total Milk Products" value={totalProducts} icon={Package} colorClass="blue" subtext="Registered inventory" />
        <StatCard title="Active Sensors" value={activeSensors} icon={Wifi} colorClass="green" subtext="ESP32 nodes online" />
        <StatCard title="Safe Products" value={safeProducts} icon={CheckCircle2} colorClass="emerald" subtext="Optimal condition" />
        <StatCard title="Requires Attention" value={attentionProducts} icon={AlertTriangle} colorClass="amber" subtext="Caution or Unsafe" />
      </div>

      {/* Main Dashboard Content - Horizontal Layout */}
      {/* 
        This layout uses a flexible horizontal container (.dashboard-horizontal-layout).
        On desktop, it displays all 4 sections side-by-side.
        On tablet, it gracefully wraps to 2 columns, and on mobile to 1 column.
      */}
      <div className="dashboard-horizontal-layout">
        
        {/* Section 1: Current Monitoring Overview */}
        <div className="glass-card section-card dashboard-horizontal-panel">
          <div className="card-header-flex">
            <h3 className="section-title">
              <Thermometer size={18} className="text-primary" /> Current Monitoring Overview
            </h3>
          </div>
          
          {products.length === 0 ? (
            <div className="empty-state p-6 text-center text-muted">
              <p>No milk products found. Add your first milk product to begin monitoring.</p>
            </div>
          ) : (
            <>
              <div className="mb-4">
                <strong>Featured Batch: </strong> {products[0]?.product_name} ({products[0]?.milk_id})
              </div>
              <div className="temp-summary-grid">
                <div className="temp-stat-box" style={{backgroundColor: 'var(--bg-subtle)'}}>
                  <span className="temp-stat-label">Current Temp</span>
                  <span className="temp-stat-val text-primary">{currentTemp !== null ? `${currentTemp}°C` : '--'}</span>
                </div>
                <div className="temp-stat-box" style={{backgroundColor: 'var(--bg-subtle)'}}>
                  <span className="temp-stat-label">Average Temp</span>
                  <span className="temp-stat-val text-info">{avgTemp !== null ? `${avgTemp}°C` : '--'}</span>
                </div>
                <div className="temp-stat-box" style={{backgroundColor: 'var(--bg-subtle)'}}>
                  <span className="temp-stat-label">Max Temp</span>
                  <span className="temp-stat-val text-warning">{maxTemp !== null ? `${maxTemp}°C` : '--'}</span>
                </div>
                <div className="temp-stat-box" style={{backgroundColor: 'var(--bg-subtle)'}}>
                  <span className="temp-stat-label">Min Temp</span>
                  <span className="temp-stat-val text-success">{minTemp !== null ? `${minTemp}°C` : '--'}</span>
                </div>
              </div>

              <div className="chart-container mt-6">
                {temperatureHistory.length > 0 ? (
                  <TemperatureChart data={temperatureHistory} height={260} />
                ) : (
                  <div className="empty-state p-6 text-center text-muted">
                    <p>No temperature readings available.</p>
                  </div>
                )}
              </div>
            </>
          )}
        </div>
        
        {/* Section 2: Active Monitored Products */}
        <div className="glass-card section-card dashboard-horizontal-panel">
          <div className="card-header-flex">
            <h3 className="section-title"><Package size={18} className="text-primary" /> Active Monitored Products</h3>
          </div>

          {products.length === 0 ? (
            <div className="empty-state p-6 text-center text-muted">
              <p>No milk products found.</p>
            </div>
          ) : (
            <div className="table-responsive">
              <table className="data-table">
                <thead>
                  <tr>
                    <th>Product ID</th>
                    <th>Product Name</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {products.slice(0, 5).map(p => (
                    <tr key={p.id}>
                      <td><strong>{p.milk_id}</strong></td>
                      <td>{p.product_name}</td>
                      <td><SafetyBadge status={p.status} /></td>
                      <td>
                        <Link to={`/products/${p.id}`} className="btn-table-action">View</Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div style={{marginTop: '16px', textAlign: 'center'}}>
            <Link to="/products" className="text-primary text-sm font-bold">View All Products &rarr;</Link>
          </div>
        </div>

        {/* Section 3: AI Shelf-Life Prediction */}
        <div className="glass-card section-card dashboard-horizontal-panel">
          <div className="card-header-flex">
            <h3 className="section-title"><BrainCircuit size={18} className="text-purple" /> AI Shelf-Life Prediction</h3>
          </div>
          
          <p className="text-xs text-muted mb-4">Powered by XGBoost & Random Forest evaluating thermal streams.</p>

          {!latestPrediction ? (
             <div className="empty-state p-6 text-center text-muted border border-dashed border-glass rounded">
               <p className="text-sm">No predictions available. Waiting for data...</p>
             </div>
          ) : (
            <div className="prediction-box">
              <div className="mb-6">
                <div className="text-sm text-muted mb-1 flex-align"><Clock size={14} className="mr-1"/> Remaining Shelf Life</div>
                <div className="text-3xl font-bold text-primary">{latestPrediction.remaining_shelf_life_hours.toFixed(1)} <span className="text-sm text-muted">hours</span></div>
              </div>
              
              <div className="mb-6">
                <div className="text-sm text-muted mb-2 flex-align"><ShieldCheck size={14} className="mr-1"/> Predicted Safety Status</div>
                <SafetyBadge status={latestPrediction.safety_status} />
              </div>
              
              <div style={{paddingTop: '16px', borderTop: '1px solid var(--border-glass)'}}>
                <div className="text-xs text-muted mb-3 font-semibold uppercase tracking-wider">Confidence Matrix</div>
                
                <div className="confidence-row" style={{display: 'flex', alignItems: 'center', marginBottom: '8px'}}>
                  <span className="text-xs font-bold w-16">SAFE</span>
                  <div style={{flex: 1, backgroundColor: 'var(--bg-subtle)', height: '6px', borderRadius: '4px', margin: '0 12px', overflow: 'hidden'}}>
                    <div style={{backgroundColor: 'var(--success)', height: '100%', width: `${(latestPrediction.probabilities?.SAFE || 0) * 100}%`}}></div>
                  </div>
                  <span className="text-xs w-10 text-right">{((latestPrediction.probabilities?.SAFE || 0) * 100).toFixed(0)}%</span>
                </div>
                
                <div className="confidence-row" style={{display: 'flex', alignItems: 'center', marginBottom: '8px'}}>
                  <span className="text-xs font-bold w-16 text-warning">CAUTION</span>
                  <div style={{flex: 1, backgroundColor: 'var(--bg-subtle)', height: '6px', borderRadius: '4px', margin: '0 12px', overflow: 'hidden'}}>
                    <div style={{backgroundColor: 'var(--warning)', height: '100%', width: `${(latestPrediction.probabilities?.CAUTION || 0) * 100}%`}}></div>
                  </div>
                  <span className="text-xs w-10 text-right">{((latestPrediction.probabilities?.CAUTION || 0) * 100).toFixed(0)}%</span>
                </div>
                
                <div className="confidence-row" style={{display: 'flex', alignItems: 'center'}}>
                  <span className="text-xs font-bold w-16 text-danger">UNSAFE</span>
                  <div style={{flex: 1, backgroundColor: 'var(--bg-subtle)', height: '6px', borderRadius: '4px', margin: '0 12px', overflow: 'hidden'}}>
                    <div style={{backgroundColor: 'var(--danger)', height: '100%', width: `${(latestPrediction.probabilities?.UNSAFE || 0) * 100}%`}}></div>
                  </div>
                  <span className="text-xs w-10 text-right">{((latestPrediction.probabilities?.UNSAFE || 0) * 100).toFixed(0)}%</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Section 4: Quick Actions */}
        <div className="glass-card section-card dashboard-horizontal-panel">
          <div className="card-header-flex">
            <h3 className="section-title"><Activity size={18} className="text-info" /> Quick Actions</h3>
          </div>
          <div style={{display: 'flex', flexDirection: 'column', gap: '10px'}}>
            <Link to="/products" className="btn-secondary" style={{textAlign: 'center'}}>Manage Inventory</Link>
            <Link to="/analytics" className="btn-secondary" style={{textAlign: 'center'}}>Run AI Analytics</Link>
            <Link to="/devices" className="btn-secondary" style={{textAlign: 'center'}}>Check Sensors</Link>
          </div>
        </div>

      </div>

    </div>
  );
}
