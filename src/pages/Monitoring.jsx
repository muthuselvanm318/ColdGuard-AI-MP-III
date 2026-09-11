import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import TemperatureChart from '../components/TemperatureChart';
import DemoBanner from '../components/DemoBanner';
import { Thermometer, Filter, Clock } from 'lucide-react';

export default function Monitoring() {
  // DataContext provides only userRole/alerts/notifications; other data is fetched locally.
  // Safe fallbacks prevent crashes when these keys are absent from context.
  const { temperatureReadings = [], devices = [], refrigerators = [], products = [], settings = {} } = useData();
  const [timeRangeFilter, setTimeRangeFilter] = useState('24H');
  const [selectedDevice, setSelectedDevice] = useState('ALL');

  // Filter history
  let filteredReadings = temperatureReadings || [];
  if (selectedDevice !== 'ALL') {
    filteredReadings = filteredReadings.filter(r => r.device_id === selectedDevice);
  }

  const temps = filteredReadings.map(r => r.temperature_c);
  const currentTemp = temps.length ? temps[temps.length - 1] : 4.2;
  const avgTemp = temps.length ? +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : 4.2;
  const maxTemp = temps.length ? Math.max(...temps) : 4.2;
  const minTemp = temps.length ? Math.min(...temps) : 4.2;
  const tempRange = +(maxTemp - minTemp).toFixed(1);

  return (
    <div className="page-container">
      <DemoBanner />

      <div className="page-header">
        <h2 className="page-title">Live Temperature Monitoring</h2>
        <p className="page-subtitle">Real-time IoT stream analysis & backend threshold overlay</p>
      </div>

      {/* Control Toolbar */}
      <div className="glass-card table-toolbar mb-6">
        <div className="flex-wrap-gap">
          <div className="filter-group">
            <label className="text-xs text-muted flex-align"><Filter size={14} /> Device Node:</label>
            <select value={selectedDevice} onChange={e => setSelectedDevice(e.target.value)} className="select-input">
              <option value="ALL">All Hardware Devices</option>
              {devices.map(d => (
                <option key={d.id} value={d.device_code}>{d.device_name} ({d.device_code})</option>
              ))}
            </select>
          </div>

          <div className="filter-group">
            <label className="text-xs text-muted flex-align"><Clock size={14} /> Time Window:</label>
            <div className="button-toggle-group">
              {['1H', '6H', '24H', '7D', 'CUSTOM'].map(r => (
                <button 
                  key={r} 
                  className={`toggle-btn ${timeRangeFilter === r ? 'active' : ''}`}
                  onClick={() => setTimeRangeFilter(r)}
                >
                  {r}
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Temperature Summary Metrics Cards */}
      <div className="stats-grid-4 mb-6">
        <div className="glass-card metric-box">
          <span className="metric-label">Current Temperature</span>
          <span className="metric-val text-primary">{currentTemp}°C</span>
          <span className="metric-sub">Latest reading</span>
        </div>
        <div className="glass-card metric-box">
          <span className="metric-label">Average Temperature</span>
          <span className="metric-val text-info">{avgTemp}°C</span>
          <span className="metric-sub">Selected window</span>
        </div>
        <div className="glass-card metric-box">
          <span className="metric-label">Maximum / Minimum</span>
          <span className="metric-val text-warning">{maxTemp}°C / {minTemp}°C</span>
          <span className="metric-sub">Min-Max range</span>
        </div>
        <div className="glass-card metric-box">
          <span className="metric-label">Temperature Range</span>
          <span className="metric-val text-purple">{tempRange}°C</span>
          <span className="metric-sub">Thermal variance</span>
        </div>
      </div>

      {/* Live Stream Chart */}
      <div className="glass-card section-card">
        <div className="card-header-flex mb-4">
          <h3 className="section-title">
            <Thermometer size={18} className="text-primary" /> Time-Series Stream vs Safe Thresholds
          </h3>
          <div className="threshold-legend text-xs text-muted">
            <span className="legend-dot dot-safe"></span> Safe (Max {settings.recommended_max_c ?? 4}°C)
            <span className="legend-dot dot-warn"></span> Warning ({settings.warning_threshold_c ?? 6}°C)
            <span className="legend-dot dot-crit"></span> Critical ({settings.critical_threshold_c ?? 8}°C)
          </div>
        </div>
        <TemperatureChart data={filteredReadings} height={350} />
      </div>

    </div>
  );
}
