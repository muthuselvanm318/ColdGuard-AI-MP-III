import React, { useState } from 'react';
import { Plus } from 'lucide-react';
import { useData } from '../context/DataContext';
import DeviceCard from '../components/DeviceCard';
import AddDeviceModal from '../components/AddDeviceModal';

const Devices = () => {
  const { devices } = useData();
  const [isModalOpen, setIsModalOpen] = useState(false);

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">IoT Devices</h1>
          <p className="page-subtitle">Manage connected sensors and equipment</p>
        </div>
        <button className="btn btn-primary" onClick={() => setIsModalOpen(true)}>
          <Plus size={18} />
          <span>Add Device</span>
        </button>
      </div>

      <div className="filter-bar mb-lg">
        <span className="filter-chip filter-chip--active">All ({devices.length})</span>
        <span className="filter-chip">Online ({devices.filter(d => d.status === 'online').length})</span>
        <span className="filter-chip">Offline ({devices.filter(d => d.status === 'offline').length})</span>
      </div>

      <div className="grid-3 stagger-children">
        {devices.map(device => (
          <DeviceCard key={device.id} device={device} />
        ))}
      </div>

      <AddDeviceModal isOpen={isModalOpen} onClose={() => setIsModalOpen(false)} />
    </div>
  );
};

export default Devices;
