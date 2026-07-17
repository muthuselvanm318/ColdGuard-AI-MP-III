import React, { useState } from 'react';
import { X } from 'lucide-react';
import { addDevice } from '../services/deviceService';
import { useData } from '../context/DataContext';

const AddDeviceModal = ({ isOpen, onClose }) => {
  const { setAlerts } = useData();
  const [formData, setFormData] = useState({
    name: '',
    location: '',
    type: 'fridge',
    targetTemp: '4.0'
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
    
    try {
      await addDevice({
        name: formData.name,
        location: formData.location,
        type: formData.type,
        targetTemp: parseFloat(formData.targetTemp)
      });
      
      // We don't automatically update context devices here because we rely on the next 5s polling cycle
      // In a real app we'd trigger a re-fetch immediately
      
      onClose();
    } catch (error) {
      console.error("Failed to add device", error);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal__header">
          <h2 className="modal__title">Add IoT Device</h2>
          <button className="btn-icon" onClick={onClose}>
            <X size={20} />
          </button>
        </div>
        
        <form onSubmit={handleSubmit}>
          <div className="modal__body">
            <div className="form-group">
              <label className="form-label">Device Name</label>
              <input 
                type="text" 
                name="name"
                value={formData.name}
                onChange={handleChange}
                className="form-input" 
                placeholder="e.g. Walk-in Chiller B" 
                required 
              />
            </div>
            
            <div className="form-group">
              <label className="form-label">Location</label>
              <input 
                type="text" 
                name="location"
                value={formData.location}
                onChange={handleChange}
                className="form-input" 
                placeholder="e.g. Warehouse 2" 
                required 
              />
            </div>
            
            <div className="grid-2">
              <div className="form-group">
                <label className="form-label">Device Type</label>
                <select 
                  name="type"
                  value={formData.type}
                  onChange={handleChange}
                  className="form-select"
                >
                  <option value="fridge">Fridge (2°C - 8°C)</option>
                  <option value="chiller">Chiller (-2°C - 4°C)</option>
                  <option value="freezer">Freezer (-18°C)</option>
                  <option value="ambient">Ambient (15°C - 25°C)</option>
                </select>
              </div>
              
              <div className="form-group">
                <label className="form-label">Target Temp (°C)</label>
                <input 
                  type="number" 
                  step="0.1"
                  name="targetTemp"
                  value={formData.targetTemp}
                  onChange={handleChange}
                  className="form-input" 
                  required 
                />
              </div>
            </div>
          </div>
          
          <div className="modal__footer">
            <button type="button" className="btn btn-secondary" onClick={onClose} disabled={isSubmitting}>
              Cancel
            </button>
            <button type="submit" className="btn btn-primary" disabled={isSubmitting}>
              {isSubmitting ? 'Adding...' : 'Add Device'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default AddDeviceModal;
