import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import AddRefrigeratorModal from '../components/AddRefrigeratorModal';
import DemoBanner from '../components/DemoBanner';
import { Box, Plus, Search, Eye, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

export default function Refrigerators() {
  const { refrigerators, deleteRefrigerator, userRole } = useData();
  const [searchTerm, setSearchTerm] = useState('');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);

  const canEdit = ['ADMIN', 'OPERATOR'].includes(userRole);

  const filtered = refrigerators.filter(r =>
    r.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.ref_code.toLowerCase().includes(searchTerm.toLowerCase()) ||
    r.location.toLowerCase().includes(searchTerm.toLowerCase())
  );

  const getStatusBadgeClass = (status) => {
    switch (status) {
      case 'HEALTHY': return 'badge-safe';
      case 'WARNING': return 'badge-caution';
      case 'CRITICAL': return 'badge-unsafe';
      default: return 'badge-info';
    }
  };

  return (
    <div className="page-container">
      <DemoBanner />

      <div className="page-header flex-between">
        <div>
          <h2 className="page-title">Refrigerator Unit Management</h2>
          <p className="page-subtitle">Commercial cold storage units, walk-in coolers, and freezers</p>
        </div>
        {canEdit && (
          <button className="btn-primary" onClick={() => setIsAddModalOpen(true)}>
            <Plus size={18} /> Add Refrigerator
          </button>
        )}
      </div>

      <div className="glass-card table-toolbar mb-6">
        <div className="search-box">
          <Search size={18} className="search-icon" />
          <input 
            type="text" 
            placeholder="Search by refrigerator name, code, or location..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
      </div>

      <div className="glass-card section-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Unit Code</th>
                <th>Name</th>
                <th>Location</th>
                <th>Type</th>
                <th>Capacity (L)</th>
                <th>Status</th>
                <th>Assigned Node</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map(r => (
                <tr key={r.id}>
                  <td><strong>{r.ref_code}</strong></td>
                  <td><strong>{r.name}</strong></td>
                  <td>{r.location}</td>
                  <td>{r.type}</td>
                  <td>{r.capacity_l} L</td>
                  <td>
                    <span className={`safety-badge ${getStatusBadgeClass(r.status)}`}>
                      {r.status}
                    </span>
                  </td>
                  <td><code>{r.assigned_device || 'ESP32-001'}</code></td>
                  <td>
                    <div className="action-buttons-group">
                      <Link to={`/refrigerators/${r.id}`} className="btn-icon-action" title="View Details">
                        <Eye size={16} />
                      </Link>
                      {canEdit && (
                        <button className="btn-icon-action text-danger" onClick={() => deleteRefrigerator(r.id)} title="Delete Unit">
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {isAddModalOpen && <AddRefrigeratorModal onClose={() => setIsAddModalOpen(false)} />}
    </div>
  );
}
