import React, { useState, useEffect } from 'react';
import { X, PackagePlus } from 'lucide-react';
import { formatDateTime, formatTimeOnly, formatDateOnly } from '../utils/dateTime';
import { createProduct } from '../api/productsApi';
import { getDevices } from '../api/devicesApi';

export default function AddProductModal({ onClose, onSuccess }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    product_name: 'Pasteurized Whole Milk (1L)',
    milk_type: 'Pasteurized Whole Milk',
    milk_id: `MILK-${Date.now().toString().slice(-4)}`,
    storage_start_time: new Date().toISOString().slice(0, 16),
    expiry_time: new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 16),
    device_id: ''
  });

  useEffect(() => {
    async function fetchSensors() {
      try {
        const devs = await getDevices();
        setDevices(devs || []);
        if (devs && devs.length > 0) {
          setFormData(prev => ({ ...prev, device_id: devs[0].device_id }));
        }
      } catch (err) {
        console.warn("Failed to load devices", err);
      }
    }
    fetchSensors();
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    try {
      const payload = {
        milk_id: formData.milk_id,
        product_name: formData.product_name,
        milk_type: formData.milk_type,
        storage_start_time: new Date(formData.storage_start_time).toISOString(),
        expiry_time: new Date(formData.expiry_time).toISOString(),
        device_id: formData.device_id || null,
        status: 'SAFE'
      };
      
      await createProduct(payload);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || "Failed to create product. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <PackagePlus size={20} />
            <h3>Register Milk Product</h3>
          </div>
          <button className="icon-button" onClick={onClose}><X size={20} /></button>
        </div>

        {error && <div className="p-3 mb-4 bg-red-100 text-danger rounded border border-red-200">{error}</div>}

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Product Name</label>
            <input 
              type="text" 
              required 
              value={formData.product_name} 
              onChange={e => setFormData({ ...formData, product_name: e.target.value })} 
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Milk Type</label>
              <select 
                value={formData.milk_type} 
                onChange={e => setFormData({ ...formData, milk_type: e.target.value })}
              >
                <option value="Pasteurized Whole Milk">Pasteurized Whole Milk</option>
                <option value="Raw Milk">Raw Milk</option>
                <option value="Low-Fat Milk">Low-Fat Milk</option>
              </select>
            </div>
            <div className="form-group">
              <label>Batch / Milk ID</label>
              <input 
                type="text" 
                required 
                value={formData.milk_id} 
                onChange={e => setFormData({ ...formData, milk_id: e.target.value })} 
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Storage Start Time</label>
              <input 
                type="datetime-local" 
                required 
                value={formData.storage_start_time} 
                onChange={e => setFormData({ ...formData, storage_start_time: e.target.value })} 
              />
            </div>
            <div className="form-group">
              <label>Expiry Time</label>
              <input 
                type="datetime-local" 
                required 
                value={formData.expiry_time} 
                onChange={e => setFormData({ ...formData, expiry_time: e.target.value })} 
              />
            </div>
          </div>

          <div className="form-group">
            <label>Assigned Sensor (Optional)</label>
            <select 
              value={formData.device_id} 
              onChange={e => setFormData({ ...formData, device_id: e.target.value })}
            >
              <option value="">-- None --</option>
              {devices.map(d => (
                <option key={d.id} value={d.device_id}>{d.device_name} ({d.device_id})</option>
              ))}
            </select>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose} disabled={loading}>Cancel</button>
            <button type="submit" className="btn-primary" disabled={loading}>
              {loading ? 'Registering...' : 'Register Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
