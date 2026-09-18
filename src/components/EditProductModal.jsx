import React, { useState, useEffect } from 'react';
import { X, PackagePlus } from 'lucide-react';
import { formatDateTime, formatTimeOnly, formatDateOnly } from '../utils/dateTime';
import { updateProduct } from '../api/productsApi';
import { getDevices } from '../api/devicesApi';

export default function EditProductModal({ product, onClose, onSuccess }) {
  const [devices, setDevices] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const [formData, setFormData] = useState({
    product_name: product.product_name,
    milk_type: product.milk_type,
    storage_start_time: product.storage_start_time ? new Date(product.storage_start_time).toISOString().slice(0, 16) : '',
    expiry_time: product.expiry_time ? new Date(product.expiry_time).toISOString().slice(0, 16) : '',
    device_id: product.device_id || ''
  });

  useEffect(() => {
    async function fetchSensors() {
      try {
        const devs = await getDevices();
        setDevices(devs || []);
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
        milk_id: product.milk_id, // Milk ID is required in payload but cannot be edited
        product_name: formData.product_name,
        milk_type: formData.milk_type,
        storage_start_time: new Date(formData.storage_start_time).toISOString(),
        expiry_time: new Date(formData.expiry_time).toISOString(),
        device_id: formData.device_id || null
      };
      
      await updateProduct(product.milk_id, payload);
      if (onSuccess) onSuccess();
    } catch (err) {
      setError(err.message || "Failed to update product. Please try again.");
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
            <h3>Edit Milk Product</h3>
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
                disabled 
                value={product.milk_id} 
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
              {loading ? 'Updating...' : 'Update Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
