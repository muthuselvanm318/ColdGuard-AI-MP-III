import React, { useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useData } from '../context/DataContext';
import TemperatureChart from '../components/TemperatureChart';
import DemoBanner from '../components/DemoBanner';
import { ArrowLeft, Cpu, Wifi, Thermometer, Send } from 'lucide-react';

export default function DeviceDetails() {
  const { id } = useParams();
  const { devices, refrigerators, products, temperatureReadings, postIotReading } = useData();

  const device = devices.find(d => d.id === id || d.device_code === id) || devices[0];
  const [testTemp, setTestTemp] = useState(4.2);
  const [testMsg, setTestMsg] = useState('');

  if (!device) {
    return (
      <div className="page-container">
        <div className="glass-card section-card text-center py-12">
          <h3>Device Not Found</h3>
          <Link to="/devices" className="btn-primary mt-4">Back to Devices</Link>
        </div>
      </div>
    );
  }

  const assignedRef = refrigerators.find(r => r.ref_code === device.refrigerator_id || r.id === device.refrigerator_id);
  const assignedProd = products.find(p => p.device_id === device.device_code || p.id === device.device_id);
  const history = temperatureReadings.filter(r => r.device_id === device.device_code || r.device_id === device.id);

  const lastReading = history.length ? history[history.length - 1].temperature_c : 4.2;

  const handleSimulatePayload = async (e) => {
    e.preventDefault();
    await postIotReading(device.device_code, Number(testTemp));
    setTestMsg(`Injected hardware payload: ${testTemp}°C recorded to DB`);
    setTimeout(() => setTestMsg(''), 4000);
  };

  return (
    <div className="page-container">
      <DemoBanner />

      <div className="page-header">
        <Link to="/devices" className="back-link">
          <ArrowLeft size={16} /> Back to Devices
        </Link>
        <div className="header-title-row mt-2">
          <h2 className="page-title">{device.device_name}</h2>
          <span className={`safety-badge ${device.status === 'ONLINE' ? 'badge-safe' : 'badge-unsafe'}`}>
            <Wifi size={14} /> {device.status}
          </span>
        </div>
        <p className="page-subtitle">Device Code: {device.device_code} • IP: {device.ip_address}</p>
      </div>

      <div className="grid-2-col gap-6">
        <div className="glass-card section-card">
          <h3 className="section-title"><Cpu size={18} className="text-primary" /> Hardware Technical Details</h3>
          <div className="details-info-grid mt-4">
            <div className="info-item">
              <span className="info-label">Sensor Module</span>
              <span className="info-value">{device.sensor_type}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Firmware Build</span>
              <span className="info-value"><code>{device.firmware_version}</code></span>
            </div>
            <div className="info-item">
              <span className="info-label">Assigned Refrigerator</span>
              <span className="info-value">{assignedRef ? assignedRef.name : device.refrigerator_id}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Assigned Product</span>
              <span className="info-value">{assignedProd ? assignedProd.name : 'Pasteurized Whole Milk'}</span>
            </div>
            <div className="info-item">
              <span className="info-label">Last Reading</span>
              <span className="info-value text-primary font-bold">{lastReading}°C</span>
            </div>
            <div className="info-item">
              <span className="info-label">Last Seen</span>
              <span className="info-value">{new Date(device.last_seen).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* ESP32 Hardware Payload Tester */}
        <div className="glass-card section-card">
          <h3 className="section-title"><Send size={18} className="text-emerald" /> ESP32 Hardware API Simulator</h3>
          <p className="text-xs text-muted mt-1">
            Simulate a POST request to <code>/api/iot/temperature</code> for this node:
          </p>

          <form onSubmit={handleSimulatePayload} className="mt-4 space-y-4">
            <div className="form-group">
              <label>Temperature Payload (°C)</label>
              <input 
                type="number" 
                step="0.1" 
                value={testTemp} 
                onChange={(e) => setTestTemp(e.target.value)} 
              />
            </div>
            <button type="submit" className="btn-primary w-full">
              Send Payload (POST /api/iot/temperature)
            </button>
            {testMsg && <div className="text-xs text-success text-center mt-2">{testMsg}</div>}
          </form>
        </div>
      </div>

      <div className="glass-card section-card mt-6">
        <h3 className="section-title mb-4"><Thermometer size={18} className="text-primary" /> Sensor Stream Graph</h3>
        <TemperatureChart data={history.length ? history : temperatureReadings} height={280} />
      </div>

    </div>
  );
}
