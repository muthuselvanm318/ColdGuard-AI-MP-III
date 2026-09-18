import React, { useState, useEffect, useCallback } from 'react';
import StatCard from '../components/StatCard';
import SafetyBadge from '../components/SafetyBadge';
import TemperatureChart from '../components/TemperatureChart';
import { getProducts } from '../api/productsApi';
import { getDevices } from '../api/devicesApi';
import { getTemperatureHistory } from '../api/temperatureApi';
import { getLatestPrediction, forceLivePrediction } from '../api/predictionsApi';
import {
  Package,
  Wifi,
  AlertTriangle,
  Thermometer,
  ShieldCheck,
  CheckCircle2,
  Activity,
  BrainCircuit,
  Clock,
  TrendingUp,
  TrendingDown,
  Minus,
  RefreshCw,
  Zap,
  BarChart3,
  Server,
  ArrowRight,
} from 'lucide-react';
import { formatDateTime, formatTimeOnly, formatDateOnly } from '../utils/dateTime';
import { Link } from 'react-router-dom';

// ─── helpers ──────────────────────────────────────────────────────────────────
function formatRelativeTime(iso) {
  if (!iso) return '—';
  const diff = (Date.now() - (new Date(iso.endsWith('Z') ? iso : iso + 'Z').getTime())) / 1000;
  if (diff < 60)  return `${Math.floor(diff)}s ago`;
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  return `${Math.floor(diff / 3600)}h ago`;
}

function getTrendIcon(temps) {
  if (!temps || temps.length < 3) return <Minus size={16} className="text-muted" />;
  const recent = temps.slice(-5);
  const slope = recent[recent.length - 1] - recent[0];
  if (slope > 0.3)  return <TrendingUp  size={16} className="text-danger" />;
  if (slope < -0.3) return <TrendingDown size={16} className="text-success" />;
  return <Minus size={16} className="text-muted" />;
}

function getTrendLabel(temps) {
  if (!temps || temps.length < 3) return 'Stable';
  const recent = temps.slice(-5);
  const slope = recent[recent.length - 1] - recent[0];
  if (slope > 0.3)  return 'Rising';
  if (slope < -0.3) return 'Falling';
  return 'Stable';
}

function shelfLifeTag(hours) {
  if (hours === null || hours === undefined) return { tag: '—', cls: 'text-muted' };
  if (hours > 120) return { tag: 'FRESH',    cls: 'text-success' };
  if (hours > 72)  return { tag: 'GOOD',     cls: 'text-info' };
  if (hours > 24)  return { tag: 'CAUTION',  cls: 'text-warning' };
  if (hours > 0)   return { tag: 'CRITICAL', cls: 'text-danger' };
  return { tag: 'EXPIRED', cls: 'text-danger' };
}

function alertLevelColor(level) {
  const map = { critical: '#7f1d1d', danger: '#ef4444', warning: '#f59e0b', info: '#3b82f6', none: '#22c55e' };
  return map[level] || '#22c55e';
}

// ─── confidence bar ───────────────────────────────────────────────────────────
function ConfBar({ label, value = 0, color }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', marginBottom: 8 }}>
      <span className="text-xs font-bold" style={{ width: 60, color }}>{label}</span>
      <div style={{
        flex: 1, height: 7, borderRadius: 4,
        background: 'var(--bg-subtle)', margin: '0 12px', overflow: 'hidden',
      }}>
        <div style={{
          height: '100%', width: `${(value * 100).toFixed(1)}%`,
          background: color, borderRadius: 4,
          transition: 'width 0.6s ease',
        }} />
      </div>
      <span className="text-xs" style={{ width: 36, textAlign: 'right', color: 'var(--text-muted)' }}>
        {(value * 100).toFixed(0)}%
      </span>
    </div>
  );
}

// ─── main component ───────────────────────────────────────────────────────────
export default function Dashboard() {
  const [products, setProducts]           = useState([]);
  const [devices, setDevices]             = useState([]);
  const [tempHistory, setTempHistory]     = useState([]);
  const [prediction, setPrediction]       = useState(null);
  const [predUpdatedAt, setPredUpdatedAt] = useState(null);
  const [loadingPred, setLoadingPred]     = useState(false);
  const [loading, setLoading]             = useState(true);
  const [error, setError]                 = useState(null);
  const [featuredId, setFeaturedId]       = useState(null);

  // ── data loader ──────────────────────────────────────────────────────────────
  const loadDashboard = useCallback(async (firstRun = false) => {
    try {
      if (firstRun) setLoading(true);

      const [prods, devs] = await Promise.all([getProducts(), getDevices()]);
      setProducts(prods || []);
      setDevices(devs  || []);

      const fid = (prods && prods.length > 0) ? prods[0].milk_id : null;
      if (firstRun) setFeaturedId(fid);

      if (fid) {
        const [hist, pred] = await Promise.all([
          getTemperatureHistory(fid),
          getLatestPrediction(fid),
        ]);
        setTempHistory(hist || []);

        // Normalise whatever shape the API returns
        const normPred = normalise(pred);
        setPrediction(normPred);
        if (normPred) setPredUpdatedAt(new Date().toISOString());
      }
    } catch (err) {
      if (firstRun) setError('Backend unavailable. Could not load dashboard data.');
    } finally {
      if (firstRun) setLoading(false);
    }
  }, []);

  // Normalise prediction across both old and new API shapes
  function normalise(raw) {
    if (!raw) return null;
    // new v2.0 shape has shelf_life / safety / dashboard blocks
    if (raw.shelf_life && raw.safety) {
      return {
        remaining_shelf_life_hours: raw.shelf_life.remaining_hours,
        remaining_shelf_life_days:  raw.shelf_life.remaining_days,
        status_tag:                 raw.shelf_life.status_tag,
        safety_status:              raw.safety.label,
        is_safe:                    raw.safety.is_safe,
        confidence:                 raw.safety.confidence,
        probabilities:              raw.safety.class_probabilities || {},
        alert_level:                raw.dashboard?.alert_level || 'none',
        status_color:               raw.dashboard?.status_color || '#22c55e',
        badge_text:                 raw.dashboard?.badge_text || '',
        summary:                    raw.dashboard?.summary || '',
      };
    }
    // old / prediction wrapper shape
    const p = raw.prediction || raw;
    return {
      remaining_shelf_life_hours: p.remaining_shelf_life_hours ?? null,
      remaining_shelf_life_days:  p.remaining_shelf_life_hours ? +(p.remaining_shelf_life_hours / 24).toFixed(2) : null,
      status_tag:                 null,
      safety_status:              p.safety_status ?? null,
      is_safe:                    p.safety_status === 'SAFE' ? 1 : 0,
      confidence:                 p.probabilities ? Math.max(...Object.values(p.probabilities)) : null,
      probabilities:              p.probabilities || {},
      alert_level:                'none',
      status_color:               '#22c55e',
      badge_text:                 '',
      summary:                    '',
    };
  }

  // ── force prediction ─────────────────────────────────────────────────────────
  const runPrediction = async () => {
    if (!featuredId || loadingPred) return;
    setLoadingPred(true);
    try {
      const res = await forceLivePrediction(featuredId);
      const norm = normalise(res);
      if (norm) {
        setPrediction(norm);
        setPredUpdatedAt(new Date().toISOString());
      }
    } catch (e) {
      console.warn('[Dashboard] forceLivePrediction failed', e);
    } finally {
      setLoadingPred(false);
    }
  };

  useEffect(() => {
    let mounted = true;
    loadDashboard(true);
    const iv = setInterval(() => { if (mounted) loadDashboard(false); }, 20000);
    return () => { mounted = false; clearInterval(iv); };
  }, [loadDashboard]);

  // ── loading / error states ───────────────────────────────────────────────────
  if (loading && products.length === 0) {
    return (
      <div className="page-container flex-center">
        <div className="text-center">
          <div className="spinner mb-4" />
          <p>Loading ColdGuard AI dashboard…</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="page-container flex-center">
        <div className="text-center text-danger">
          <AlertTriangle size={48} className="mb-4 mx-auto" />
          <h3 className="text-xl font-bold">Backend Unavailable</h3>
          <p className="mt-2 text-muted">{error}</p>
          <button className="btn-primary mt-4" onClick={() => window.location.reload()}>
            Retry Connection
          </button>
        </div>
      </div>
    );
  }

  // ── derived metrics ──────────────────────────────────────────────────────────
  const totalProducts    = products.length;
  const activeSensors    = devices.filter(d => d.status === 'ONLINE').length;
  const safeProducts     = products.filter(p => p.status === 'SAFE').length;
  const atRiskProducts   = products.filter(p => p.status === 'UNSAFE' || p.status === 'CAUTION').length;

  const temps      = tempHistory.map(r => Number(r.temperature_c)).filter(t => !isNaN(t));
  const currentTemp = temps.length ? temps[temps.length - 1] : null;
  const avgTemp    = temps.length ? +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : null;
  const maxTemp    = temps.length ? +Math.max(...temps).toFixed(1) : null;
  const minTemp    = temps.length ? +Math.min(...temps).toFixed(1) : null;

  const featuredProduct = products[0] || null;
  const { tag: sltag, cls: slcls } = shelfLifeTag(prediction?.remaining_shelf_life_hours);

  // ── render ───────────────────────────────────────────────────────────────────
  return (
    <div className="page-container">

      {/* ── Page Header ───────────────────────────────────────────────────── */}
      <div className="page-header flex-between">
        <div>
          <h2 className="page-title">ColdGuard AI Dashboard</h2>
          <p className="page-subtitle">Real-Time Cold-Chain Monitoring · ML Safety Intelligence</p>
        </div>
        <div className="food-safety-pill-badge">
          <ShieldCheck size={18} className="text-success" />
          <span>System Online</span>
        </div>
      </div>

      {/* ── Stat Cards Row ────────────────────────────────────────────────── */}
      <div className="stats-grid-6">
        <StatCard title="Total Products"    value={totalProducts}  icon={Package}      colorClass="blue"    subtext="Registered inventory" />
        <StatCard title="Active Sensors"    value={activeSensors}  icon={Wifi}         colorClass="green"   subtext="ESP32 nodes online" />
        <StatCard title="Safe Products"     value={safeProducts}   icon={CheckCircle2} colorClass="emerald" subtext="Optimal condition" />
        <StatCard title="Requires Attention" value={atRiskProducts} icon={AlertTriangle} colorClass="amber" subtext="Unsafe or caution" />
      </div>

      {/* ── Main 3-Column Grid ────────────────────────────────────────────── */}
      <div className="db-grid-main">

        {/* ── LEFT COL: Monitoring Overview + Products Table ─────────────── */}
        <div className="db-col-left">

          {/* Monitoring Overview card */}
          <div className="glass-card db-card">
            <div className="db-card-header">
              <span className="db-card-title">
                <Thermometer size={17} className="text-primary" /> Current Monitoring Overview
              </span>
              {featuredProduct && (
                <span className="db-pill">
                  {featuredProduct.product_name} · {featuredProduct.milk_id}
                </span>
              )}
            </div>

            {/* Temp stats row */}
            <div className="db-temp-row">
              {[
                { label: 'Current',  val: currentTemp, cls: 'text-primary' },
                { label: 'Average',  val: avgTemp,     cls: 'text-info' },
                { label: 'Maximum',  val: maxTemp,     cls: 'text-warning' },
                { label: 'Minimum',  val: minTemp,     cls: 'text-success' },
              ].map(({ label, val, cls }) => (
                <div key={label} className="db-temp-box">
                  <span className="db-temp-label">{label}</span>
                  <span className={`db-temp-val ${cls}`}>
                    {val !== null ? `${val}°C` : '—'}
                  </span>
                </div>
              ))}
            </div>

            {/* Trend indicator */}
            {temps.length > 0 && (
              <div className="db-trend-row">
                {getTrendIcon(temps)}
                <span className="text-xs text-muted ml-1">
                  Temperature trend: <strong>{getTrendLabel(temps)}</strong>
                </span>
                <span className="text-xs text-muted ml-auto">
                  {tempHistory.length} readings
                </span>
              </div>
            )}

            {/* Chart */}
            <div className="db-chart-wrap">
              {tempHistory.length > 0 ? (
                <TemperatureChart data={tempHistory} height={220} />
              ) : (
                <div className="db-empty">No temperature readings yet.</div>
              )}
            </div>
          </div>

          {/* Active Products table card */}
          <div className="glass-card db-card">
            <div className="db-card-header">
              <span className="db-card-title">
                <Package size={17} className="text-primary" /> Active Monitored Products
              </span>
              <Link to="/products" className="db-see-all">View All <ArrowRight size={13} /></Link>
            </div>

            {products.length === 0 ? (
              <div className="db-empty">No products registered yet.</div>
            ) : (
              <div className="db-table-wrap">
                <table className="db-table">
                  <thead>
                    <tr>
                      <th>Product ID</th>
                      <th>Name</th>
                      <th>Type</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {products.slice(0, 6).map(p => (
                      <tr key={p.milk_id}>
                        <td><code className="db-mono">{p.milk_id}</code></td>
                        <td>{p.product_name}</td>
                        <td className="text-muted text-xs">{p.milk_type}</td>
                        <td><SafetyBadge status={p.status} /></td>
                        <td>
                          <Link to={`/products/${p.milk_id}`} className="db-link">View →</Link>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── RIGHT COL: AI Prediction + Quick Actions ─────────────────────── */}
        <div className="db-col-right">

          {/* AI Shelf-Life Prediction card */}
          <div className="glass-card db-card db-ai-card">
            <div className="db-card-header">
              <span className="db-card-title">
                <BrainCircuit size={17} className="text-purple" /> AI Shelf-Life Prediction
              </span>
              <button
                className="db-refresh-btn"
                onClick={runPrediction}
                disabled={loadingPred || !featuredId}
                title="Force new prediction from latest data"
              >
                <RefreshCw size={14} className={loadingPred ? 'spin' : ''} />
                {loadingPred ? 'Running…' : 'Refresh'}
              </button>
            </div>

            <p className="text-xs text-muted" style={{ marginBottom: 14 }}>
              XGBoost Regressor (RMSE 1.10h) + Random Forest Classifier (99.81% acc) · 21-feature thermal stream
            </p>

            {!prediction ? (
              <div className="db-pred-empty">
                <BrainCircuit size={36} className="text-muted mb-2" />
                <p className="text-sm font-semibold">No prediction available yet</p>
                <p className="text-xs text-muted mt-1">Waiting for temperature data from ESP32 sensor…</p>
                {featuredId && (
                  <button className="btn-primary mt-4" style={{ fontSize: '0.8rem' }} onClick={runPrediction} disabled={loadingPred}>
                    {loadingPred ? 'Running prediction…' : 'Run Prediction Now'}
                  </button>
                )}
              </div>
            ) : (
              <>
                {/* Featured product label */}
                {featuredProduct && (
                  <div className="db-pred-product-label">
                    <Server size={13} /> {featuredProduct.product_name}
                  </div>
                )}

                {/* Shelf life big number */}
                <div className="db-pred-shelf-block" style={{ borderLeft: `4px solid ${alertLevelColor(prediction.alert_level)}` }}>
                  <div className="text-xs text-muted uppercase tracking-wider mb-1">
                    <Clock size={12} className="inline mr-1" /> Remaining Shelf Life
                  </div>
                  <div className="db-pred-hours">
                    {prediction.remaining_shelf_life_hours !== null
                      ? prediction.remaining_shelf_life_hours.toFixed(1)
                      : '—'}
                    <span className="db-pred-unit">hours</span>
                  </div>
                  {prediction.remaining_shelf_life_days !== null && (
                    <div className="text-xs text-muted mt-1">
                      ≈ {prediction.remaining_shelf_life_days} days
                    </div>
                  )}
                  <div className={`db-pred-tag ${slcls}`} style={{ marginTop: 8 }}>
                    {sltag}
                  </div>
                </div>

                {/* Safety status */}
                <div className="db-pred-safety-row">
                  <div>
                    <div className="text-xs text-muted mb-1">
                      <ShieldCheck size={12} className="inline mr-1" /> Safety Status
                    </div>
                    <SafetyBadge status={prediction.safety_status} />
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1">
                      Temperature Trend
                    </div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontWeight: 600, fontSize: '0.85rem' }}>
                      {getTrendIcon(temps)} {getTrendLabel(temps)}
                    </div>
                  </div>
                  <div>
                    <div className="text-xs text-muted mb-1">Confidence</div>
                    <div className="font-bold text-primary" style={{ fontSize: '1.1rem' }}>
                      {prediction.confidence !== null ? `${(prediction.confidence * 100).toFixed(0)}%` : '—'}
                    </div>
                  </div>
                </div>

                {/* Confidence bars */}
                <div className="db-pred-conf-section">
                  <div className="text-xs text-muted font-semibold uppercase tracking-wider mb-2">
                    Classification Probabilities
                  </div>
                  <ConfBar
                    label="SAFE"
                    value={prediction.probabilities?.SAFE   ?? prediction.probabilities?.['1'] ?? 0}
                    color="var(--success)"
                  />
                  <ConfBar
                    label="UNSAFE"
                    value={prediction.probabilities?.UNSAFE ?? prediction.probabilities?.['0'] ?? 0}
                    color="var(--danger)"
                  />
                </div>

                {/* Summary message */}
                {prediction.summary && (
                  <div className="db-pred-summary" style={{ borderLeft: `3px solid ${alertLevelColor(prediction.alert_level)}` }}>
                    {prediction.summary}
                  </div>
                )}

                {/* Last updated */}
                <div className="db-pred-timestamp">
                  <Clock size={12} />
                  Last updated {formatRelativeTime(predUpdatedAt)} · Model v2.0
                </div>
              </>
            )}
          </div>

          {/* Quick Actions card */}
          <div className="glass-card db-card">
            <div className="db-card-header">
              <span className="db-card-title">
                <Zap size={17} className="text-info" /> Quick Actions
              </span>
            </div>
            <div className="db-actions-grid">
              {[
                { to: '/products',  label: 'Manage Inventory',   icon: Package,    cls: 'blue' },
                { to: '/analytics', label: 'AI Analytics',        icon: BarChart3,  cls: 'purple' },
                { to: '/devices',   label: 'Check Sensors',       icon: Wifi,       cls: 'green' },
                { to: '/alerts',    label: 'View Alerts',         icon: AlertTriangle, cls: 'amber' },
              ].map(({ to, label, icon: Icon, cls }) => (
                <Link key={to} to={to} className={`db-action-btn db-action-${cls}`}>
                  <Icon size={18} />
                  <span>{label}</span>
                  <ArrowRight size={14} className="db-action-arrow" />
                </Link>
              ))}
            </div>

            {/* At-risk products mini-list */}
            {atRiskProducts > 0 && (
              <div className="db-risk-alert">
                <AlertTriangle size={14} className="text-warning" />
                <span className="text-xs font-semibold">
                  {atRiskProducts} product{atRiskProducts > 1 ? 's' : ''} need{atRiskProducts === 1 ? 's' : ''} attention
                </span>
                <Link to="/products" className="text-xs text-primary ml-auto font-bold">Review →</Link>
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
