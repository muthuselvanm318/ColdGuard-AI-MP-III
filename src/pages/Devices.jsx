import React, { useState, useEffect } from 'react';
import AddDeviceModal from '../components/AddDeviceModal';
import EditDeviceModal from '../components/EditDeviceModal';
import DeleteConfirmModal from '../components/DeleteConfirmModal';
import { getDevices, deleteDevice } from '../api/devicesApi';
import { useToast } from '../context/ToastContext';
import { Cpu, Plus, Search, Eye, Wifi, WifiOff, AlertTriangle, Edit2, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Devices() {
  const { addToast } = useToast();
  const [devices, setDevices] = useState([]);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingDevice, setEditingDevice] = useState(null);
  const [deletingDevice, setDeletingDevice] = useState(null);
  
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchDevices = async (showLoading = true) => {
    try {
      if (showLoading) setLoading(true);
      const data = await getDevices();
      setDevices(data || []);
      setError(null);
    } catch (err) {
      setError("Unable to load devices. Please try again.");
    } finally {
      if (showLoading) setLoading(false);
    }
  };

  useEffect(() => {
    fetchDevices();
    const interval = setInterval(() => {
      fetchDevices(false);
    }, 30000);
    return () => clearInterval(interval);
  }, []);

  const handleDelete = async () => {
    if (!deletingDevice) return;
    await deleteDevice(deletingDevice.device_id);
    addToast("Device deleted successfully.", "success");
    setDeletingDevice(null);
    await fetchDevices(false);
  };

  const filtered = devices.filter(d =>
    d.device_name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.device_id.toLowerCase().includes(searchTerm.toLowerCase()) ||
    d.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="page-container">

      <div className="page-header flex-between">
        <div>
          <h2 className="page-title">IoT Hardware Sensors</h2>
          <p className="page-subtitle">ESP32 microcontroller nodes & DS18B20 digital temperature sensors</p>
        </div>
        <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
          <Plus size={18} /> Add Sensor
        </button>
      </div>

      <div className="glass-card table-toolbar mb-6">
        <div className="search-box flex-1">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by device name, hardware ID, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-card section-card">
        {error ? (
          <div className="empty-state p-6 text-center text-danger">
            <AlertTriangle size={32} className="mx-auto mb-2" />
            <p>{error}</p>
            <button className="btn-secondary mt-4" onClick={fetchDevices}>Retry</button>
          </div>
        ) : loading && devices.length === 0 ? (
          <div className="empty-state p-6 text-center">
            <div className="spinner mb-4"></div>
            <p>Loading devices...</p>
          </div>
        ) : (
          <div className="table-responsive">
            <table className="data-table">
              <thead>
                <tr>
                  <th>Device ID</th>
                  <th>Device Name</th>
                  <th>Sensor Type</th>
                  <th>Location</th>
                  <th>Status</th>
                  <th>Latest Reading</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filtered.length === 0 ? (
                  <tr>
                    <td colSpan="7" className="text-center py-6 text-muted">
                      {devices.length === 0 ? "No devices found." : "No devices found matching search criteria."}
                    </td>
                  </tr>
                ) : (
                  filtered.map(d => (
                    <tr key={d.id}>
                      <td><strong>{d.device_id}</strong></td>
                      <td><strong>{d.device_name}</strong></td>
                      <td>{d.sensor_type}</td>
                      <td>{d.location}</td>
                      <td>
                        <span className={`safety-badge ${d.status === 'ONLINE' ? 'badge-safe' : (d.status === 'ERROR' ? 'badge-unsafe' : 'badge-caution')}`}>
                          {d.status === 'ONLINE' ? <Wifi size={14} /> : <WifiOff size={14} />} {d.status}
                        </span>
                      </td>
                      <td>{d.last_temperature ? `${d.last_temperature}°C` : '--'}</td>
                      <td>
                        <div className="action-buttons-group">
                          <Link to={`/devices/${d.id}`} className="btn-icon-action" title="View Node Details">
                            <Eye size={16} />
                          </Link>
                          <button className="btn-icon-action text-primary" title="Edit Device" onClick={() => setEditingDevice(d)}>
                            <Edit2 size={16} />
                          </button>
                          <button className="btn-icon-action text-danger" title="Delete Device" onClick={() => setDeletingDevice(d)}>
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {isAddModalOpen && (
        <AddDeviceModal 
          onClose={() => setIsAddModalOpen(false)} 
          onSuccess={() => {
            setIsAddModalOpen(false);
            addToast("Device added successfully.", "success");
            fetchDevices(false);
          }}
        />
      )}

      {editingDevice && (
        <EditDeviceModal 
          device={editingDevice}
          onClose={() => setEditingDevice(null)}
          onSuccess={() => {
            setEditingDevice(null);
            addToast("Device updated successfully.", "success");
            fetchDevices(false);
          }}
        />
      )}

      {deletingDevice && (
        <DeleteConfirmModal
          title="Delete Device?"
          message={`Are you sure you want to delete ${deletingDevice.device_name}? This will unassign it from any milk products and permanently remove it.`}
          onClose={() => setDeletingDevice(null)}
          onConfirm={handleDelete}
        />
      )}
    </div>
  );
}
