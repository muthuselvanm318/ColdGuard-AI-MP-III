import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { X, Box } from 'lucide-react';

export default function AddRefrigeratorModal({ onClose }) {
  const { addRefrigerator, devices, products } = useData();
  const [formData, setFormData] = useState({
    name: 'Walk-in Dairy Cooler B',
    ref_code: `REF-00${Math.floor(Math.random() * 90) + 10}`,
    location: 'Facility Bay 2',
    type: 'Walk-in Commercial Refrigerator',
    capacity_l: 1000,
    status: 'HEALTHY',
    assigned_device: devices[0]?.device_code || 'ESP32-001',
    assigned_product: products[0]?.product_code || 'MILK-001'
  });

  const handleSubmit = async (e) => {
    e.preventDefault();
    await addRefrigerator(formData);
    onClose();
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal-content glass-card" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <div className="modal-title">
            <Box size={20} />
            <h3>Add Refrigerator Unit</h3>
          </div>
          <button className="icon-button" onClick={onClose}><X size={20} /></button>
        </div>

        <form onSubmit={handleSubmit} className="modal-form">
          <div className="form-group">
            <label>Refrigerator Name</label>
            <input 
              type="text" 
              required 
              value={formData.name} 
              onChange={e => setFormData({ ...formData, name: e.target.value })} 
            />
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Location</label>
              <input 
                type="text" 
                required 
                value={formData.location} 
                onChange={e => setFormData({ ...formData, location: e.target.value })} 
              />
            </div>
            <div className="form-group">
              <label>Unit Type</label>
              <input 
                type="text" 
                required 
                value={formData.type} 
                onChange={e => setFormData({ ...formData, type: e.target.value })} 
              />
            </div>
          </div>

          <div className="form-grid-2">
            <div className="form-group">
              <label>Capacity (Liters)</label>
              <input 
                type="number" 
                required 
                value={formData.capacity_l} 
                onChange={e => setFormData({ ...formData, capacity_l: Number(e.target.value) })} 
              />
            </div>
            <div className="form-group">
              <label>Status</label>
              <select 
                value={formData.status} 
                onChange={e => setFormData({ ...formData, status: e.target.value })}
              >
                <option value="HEALTHY">HEALTHY</option>
                <option value="WARNING">WARNING</option>
                <option value="CRITICAL">CRITICAL</option>
                <option value="OFFLINE">OFFLINE</option>
              </select>
            </div>
          </div>

          <div className="modal-actions">
            <button type="button" className="btn-secondary" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn-primary">Add Refrigerator</button>
          </div>
        </form>
      </div>
    </div>
  );
}
