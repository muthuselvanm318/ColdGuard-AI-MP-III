import React, { useState } from 'react';
import { X } from 'lucide-react';
import { useData } from '../context/DataContext';

const AddProductModal = ({ isOpen, onClose }) => {
  const { devices, updateProduct } = useData();
  const [formData, setFormData] = useState({
    name: '',
    category: 'meat',
    deviceId: devices[0]?.id || ''
  });
  const [isSubmitting, setIsSubmitting] = useState(false);

  if (!isOpen) return null;

  const handleChange = (e) => {
    const { name, value } = e.target;
    setFormData(prev => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setIsSubmitting(true);
    
    // Simulate API Call
    setTimeout(() => {
      // In a real app we'd call a service here to add product to backend
      console.log("Product Added", formData);
      onClose();
      setIsSubmitting(false);
    }, 500);
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Register Product</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <div className="form-group">
              <label className="form-label">Product Name</label>
              <input 
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-input" 
                placeholder="e.g. Premium Wagyu Beef" 
                required 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Food Category</label>
              <select 
                name="category"
                value={formData.category}
                onChange={handleChange}
                className="form-select"
              >
                <option value="meat">Meat & Poultry</option>
                <option value="seafood">Seafood</option>
                <option value="dairy">Dairy</option>
                <option value="vegetables">Vegetables</option>
                <option value="fruits">Fruits</option>
                <option value="beverages">Beverages</option>
              </select>
            </div>
            
            <div className="form-group">
              <label className="form-label">Assign to Device</label>
              <select 
                name="deviceId"
                value={formData.deviceId}
                onChange={handleChange}
                className="form-select"
                required
              >
                <option value="" disabled>Select a device</option>
                {devices.map(d => (
                  <option key={d.id} value={d.id}>{d.name} ({d.id})</option>
                ))}
              </select>
            </div>
          </div>
          
          <div className="modal__footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Registering...' : 'Register Product'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddProductModal;
