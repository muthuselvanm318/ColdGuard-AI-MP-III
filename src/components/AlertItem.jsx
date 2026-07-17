import React from 'react';
import { AlertCircle, AlertTriangle, Info, CheckCircle2 } from 'lucide-react';
import { acknowledgeAlert } from '../services/alertService';
import { useData } from '../context/DataContext';

const AlertItem = ({ alert }) => {
  const { setAlerts } = useData();

  const handleAcknowledge = async () => {
    if (alert.acknowledged) return;
    await acknowledgeAlert(alert.id);
    setAlerts(prev => prev.map(a => a.id === alert.id ? { ...a, acknowledged: true } : a));
  };

  const getIcon = () => {
    if (alert.acknowledged) return <CheckCircle2 size={20} color="var(--safe)" />;
    switch (alert.severity.toLowerCase()) {
      case 'critical': return <AlertCircle size={20} color="var(--danger)" />;
      case 'warning': return <AlertTriangle size={20} color="var(--caution)" />;
      default: return <Info size={20} color="var(--info)" />;
    }
  };

  const getBgClass = () => {
    if (alert.acknowledged) return 'opacity-60';
    switch (alert.severity.toLowerCase()) {
      case 'critical': return 'border-l-4 border-l-red-500 bg-red-500/5';
      case 'warning': return 'border-l-4 border-l-amber-500 bg-amber-500/5';
      default: return 'border-l-4 border-l-blue-500 bg-blue-500/5';
    }
  };

  const timeAgo = (dateStr) => {
    const diff = Math.floor((new Date() - new Date(dateStr)) / 60000);
    if (diff < 1) return 'Just now';
    if (diff < 60) return `${diff}m ago`;
    const h = Math.floor(diff / 60);
    if (h < 24) return `${h}h ago`;
    return `${Math.floor(h / 24)}d ago`;
  };

  return (
    <div style={{
      display: 'flex',
      alignItems: 'flex-start',
      gap: 'var(--space-md)',
      padding: 'var(--space-md)',
      background: alert.acknowledged ? 'var(--bg-card)' : 'var(--bg-glass-hover)',
      border: '1px solid var(--border-default)',
      borderLeft: alert.acknowledged ? undefined : `4px solid var(--${alert.severity.toLowerCase() === 'critical' ? 'danger' : alert.severity.toLowerCase() === 'warning' ? 'caution' : 'info'})`,
      borderRadius: 'var(--radius-md)',
      marginBottom: 'var(--space-sm)',
      opacity: alert.acknowledged ? 0.7 : 1,
      transition: 'all var(--transition-fast)'
    }}>
      <div style={{ marginTop: '2px' }}>
        {getIcon()}
      </div>
      
      <div style={{ flex: 1 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '4px' }}>
          <span style={{ fontWeight: '600', color: alert.acknowledged ? 'var(--text-muted)' : 'var(--text-primary)' }}>
            {alert.deviceName}
          </span>
          <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
            {timeAgo(alert.timestamp)}
          </span>
        </div>
        <p style={{ fontSize: 'var(--font-sm)', color: 'var(--text-secondary)', margin: 0 }}>
          {alert.message}
        </p>
      </div>

      {!alert.acknowledged && (
        <button 
          onClick={handleAcknowledge}
          style={{
            fontSize: 'var(--font-xs)',
            padding: '4px 8px',
            background: 'var(--bg-input)',
            border: '1px solid var(--border-default)',
            borderRadius: 'var(--radius-sm)',
            color: 'var(--text-secondary)'
          }}
        >
          Ack
        </button>
      )}
    </div>
  );
};

export default AlertItem;
