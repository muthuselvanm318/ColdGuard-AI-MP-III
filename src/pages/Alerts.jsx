import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import DemoBanner from '../components/DemoBanner';
import { AlertTriangle, CheckCircle, ShieldAlert, Filter } from 'lucide-react';

export default function Alerts() {
  const { alerts, acknowledgeAlert, resolveAlert, userRole } = useData();
  const [filterSeverity, setFilterSeverity] = useState('ALL');
  const [filterStatus, setFilterStatus] = useState('ALL');

  const canEdit = ['ADMIN', 'OPERATOR', 'QUALITY_MANAGER'].includes(userRole);

  const filtered = alerts.filter(a => {
    if (filterSeverity !== 'ALL' && a.severity !== filterSeverity) return false;
    if (filterStatus !== 'ALL' && a.status !== filterStatus) return false;
    return true;
  });

  return (
    <div className="page-container">
      <DemoBanner />

      <div className="page-header">
        <h2 className="page-title">System Alert Management</h2>
        <p className="page-subtitle">Temperature excursions, hardware disconnections, & safety breaches</p>
      </div>

      {/* Filters */}
      <div className="glass-card table-toolbar mb-6">
        <div className="flex-wrap-gap">
          <div className="filter-group">
            <label className="text-xs text-muted flex-align"><Filter size={14} /> Severity:</label>
            <select value={filterSeverity} onChange={e => setFilterSeverity(e.target.value)} className="select-input">
              <option value="ALL">All Severities</option>
              <option value="INFO">INFO</option>
              <option value="WARNING">WARNING</option>
              <option value="CRITICAL">CRITICAL</option>
            </select>
          </div>

          <div className="filter-group">
            <label className="text-xs text-muted flex-align"><Filter size={14} /> Resolution Status:</label>
            <select value={filterStatus} onChange={e => setFilterStatus(e.target.value)} className="select-input">
              <option value="ALL">All Statuses</option>
              <option value="ACTIVE">ACTIVE</option>
              <option value="ACKNOWLEDGED">ACKNOWLEDGED</option>
              <option value="RESOLVED">RESOLVED</option>
            </select>
          </div>
        </div>
      </div>

      {/* Alert Table */}
      <div className="glass-card section-card">
        <div className="table-responsive">
          <table className="data-table">
            <thead>
              <tr>
                <th>Alert ID</th>
                <th>Type</th>
                <th>Severity</th>
                <th>Target Product</th>
                <th>Device Node</th>
                <th>Recorded Temp</th>
                <th>Message</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 ? (
                <tr>
                  <td colSpan="9" className="text-center py-6 text-muted">
                    No system alerts match the selected filter criteria.
                  </td>
                </tr>
              ) : (
                filtered.map(a => (
                  <tr key={a.id}>
                    <td><code>{a.alert_code || `ALT-${a.id}`}</code></td>
                    <td><strong>{a.type}</strong></td>
                    <td>
                      <span className={`severity-tag severity-${a.severity.toLowerCase()}`}>
                        {a.severity}
                      </span>
                    </td>
                    <td>{a.milk_id || 'UNASSIGNED'}</td>
                    <td><code>{a.device_id}</code></td>
                    <td><strong>{a.temperature_c ? `${a.temperature_c}°C` : 'N/A'}</strong></td>
                    <td className="max-w-xs text-sm">{a.message}</td>
                    <td>
                      <span className={`badge-status status-${a.status.toLowerCase()}`}>
                        {a.status}
                      </span>
                    </td>
                    <td>
                      <div className="action-buttons-group">
                        {canEdit && a.status === 'ACTIVE' && (
                          <button className="btn-table-action" onClick={() => acknowledgeAlert(a.id)}>
                            Acknowledge
                          </button>
                        )}
                        {canEdit && a.status !== 'RESOLVED' && (
                          <button className="btn-table-action btn-success" onClick={() => resolveAlert(a.id)}>
                            Resolve
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

    </div>
  );
}
