import React from 'react';
import { BellRing, CheckCircle2 } from 'lucide-react';
import { useData } from '../context/DataContext';
import AlertItem from '../components/AlertItem';
import { acknowledgeAll } from '../services/alertService';

const Alerts = () => {
  const { alerts, setAlerts } = useData();

  const handleAcknowledgeAll = async () => {
    await acknowledgeAll();
    setAlerts(prev => prev.map(a => ({ ...a, acknowledged: true })));
  };

  const unreadCount = alerts.filter(a => !a.acknowledged).length;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">System Alerts</h1>
          <p className="page-subtitle">Temperature breaches and system notifications</p>
        </div>
        
        {unreadCount > 0 && (
          <button className="btn btn-secondary" onClick={handleAcknowledgeAll}>
            <CheckCircle2 size={18} className="text-safe" />
            <span>Acknowledge All ({unreadCount})</span>
          </button>
        )}
      </div>

      <div className="filter-bar mb-lg">
        <span className="filter-chip filter-chip--active">All</span>
        <span className="filter-chip">Unread</span>
        <span className="filter-chip text-danger" style={{ borderColor: 'var(--danger-border)' }}>Critical</span>
        <span className="filter-chip text-caution" style={{ borderColor: 'var(--caution-border)' }}>Warning</span>
      </div>

      <div className="glass-card stagger-children" style={{ padding: '0' }}>
        <div style={{ padding: 'var(--space-md)' }}>
          {alerts.length > 0 ? (
            alerts.map(alert => (
              <AlertItem key={alert.id} alert={alert} />
            ))
          ) : (
            <div className="empty-state">
              <BellRing className="empty-state__icon" />
              <div className="empty-state__title">No alerts found</div>
              <div className="empty-state__desc">Your system is running smoothly.</div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default Alerts;
