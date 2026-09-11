import React, { useState } from 'react';
import { X, Cpu } from 'lucide-react';
import { createDevice } from '../api/devicesApi';

export default function AddDeviceModal({ onClose, onSuccess }) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    device_name: 'Sensor Node 1',
    device_id: `ESP32-${Date.now().toString().slice(-4)}`,
    sensor_type: 'DS18B20',
    location: 'Facility Bay 1'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      await createDevice(formData);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || "Failed to create device. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Cpu size={20} />
            <h3>Register IoT Device Sensor</h3>
          </div>
          <button className="icon-button" onClick={onClose}><X size={20} /></button>
        </div>

        {error && <div className="p-3 mb-4 bg-red-100 text-danger rounded border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Device Name</label>
            <input 
              type="text" 
              required 
              value={formData.device_name} 
              onChange={e => setFormData({ ...formData, device_name: e.target.value })} 
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Device ID</label>
              <input 
                type="text" 
                required 
                value={formData.device_id} 
                onChange={e => setFormData({ ...formData, device_id: e.target.value })} 
              />
            </div>
            <div className="form-group">
              <label>Sensor Type</label>
              <input 
                type="text" 
                required 
                value={formData.sensor_type} 
                onChange={e => setFormData({ ...formData, sensor_type: e.target.value })} 
              />
            </div>
          </div>

          <div className="form-group">
            <label>Location</label>
            <input 
              type="text" 
              required 
              value={formData.location} 
              onChange={e => setFormData({ ...formData, location: e.target.value })} 
            />
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Registering...' : 'Register Sensor'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
