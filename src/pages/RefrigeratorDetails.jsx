import React from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import TemperatureChart from '../components/TemperatureChart';
import DemoBanner from '../components/DemoBanner';
import { ArrowLeft, Box, Cpu, Package, AlertTriangle, Thermometer } from 'lucide-react';

export default function RefrigeratorDetails() {
  const { id } = useParams();
  const { refrigerators, devices, products, alerts, temperatureReadings } = useData();

  const refUnit = refrigerators.find(r => r.id === id || r.ref_code === id) || refrigerators[0];

  if (!refUnit) {
    return (
      <div className="page-container">
        <div className="glass-card section-card text-center py-12">
          <h3>Refrigerator Not Found</h3>
          <Link to="/refrigerators" className="btn-primary mt-4">Back to Refrigerators</Link>
        </div>
      </div>
    );
  }

  const assignedDevs = devices.filter(d => d.refrigerator_id === refUnit.ref_code || d.refrigerator_id === refUnit.id);
  const assignedProds = products.filter(p => p.refrigerator_id === refUnit.ref_code || p.refrigerator_id === refUnit.id);
  const activeAlerts = alerts.filter(a => a.refrigerator_id === refUnit.ref_code || a.refrigerator_id === refUnit.id);
  const history = temperatureReadings.filter(r => r.refrigerator_id === refUnit.ref_code || r.refrigerator_id === refUnit.id);

  const currentTemp = history.length ? history[history.length - 1].temperature_c : 4.2;

  return (
    <div className="page-container">
      <DemoBanner />

      <div className="page-header">
        <Link to="/refrigerators" className="back-link">
          <ArrowLeft size={16} /> Back to Refrigerators
        </Link>
        <div className="header-title-row mt-2">
          <h2 className="page-title">{refUnit.name}</h2>
          <span className="badge-status">{refUnit.status}</span>
        </div>
        <p className="page-subtitle">Unit Code: {refUnit.ref_code} • Location: {refUnit.location}</p>
      </div>

      <div className="grid-2-col gap-6">
        <div className="glass-card section-card">
          <h3 className="section-title"><Box size={18} className="text-primary" /> Specifications & Capacity</h3>
          <div className="details-info-grid mt-4">
            <div className="info-item">
              <span className="info-label">Type</span>
              <span className="info-value">{refUnit.type}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Storage Capacity</span>
              <span className="info-value">{refUnit.capacity_l} Liters</span>
            </div>
            <div className="info-item">
              <span className="info-label">Location Bay</span>
              <span className="info-value">{refUnit.location}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Current Temperature</span>
              <span className="info-value text-primary font-bold">{currentTemp}°C</span>
            </div>
          </div>
        </div>

        <div className="glass-card section-card">
          <h3 className="section-title"><Cpu size={18} className="text-emerald" /> Connected Hardware & Products</h3>
          <div className="details-info-grid mt-4">
            <div className="info-item">
              <span className="info-label">Connected Nodes</span>
              <span className="info-value">{assignedDevs.length ? assignedDevs.map(d => d.device_name).join(', ') : 'ESP32-001'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Monitored Products</span>
              <span className="info-value">{assignedProds.length ? assignedProds.map(p => p.name).join(', ') : 'Pasteurized Whole Milk'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Active Alerts</span>
              <span className="info-value text-warning">{activeAlerts.length} Active</span>
            </div>
            <div className="info-item">
              <span className="info-label">Last Communication</span>
              <span className="info-value">Active (Live Stream)</span>
            </div>
          </div>
        </div>
      </div>

      <div className="glass-card section-card mt-6">
        <h3 className="section-title mb-4"><Thermometer size={18} className="text-primary" /> Refrigerator Temperature History</h3>
        <TemperatureChart data={history.length ? history : temperatureReadings} height={280} />
      </div>

    </div>
  );
}
