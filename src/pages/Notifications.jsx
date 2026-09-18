import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import DemoBanner from '../components/DemoBanner';
import { Bell, CheckCheck, AlertTriangle, Cpu, Info, Mail, MessageSquare, Send } from 'lucide-react';
import { formatDateTime, formatTimeOnly, formatDateOnly } from '../utils/dateTime';

export default function Notifications() {
  const { alerts, acknowledgeAllAlerts, acknowledgeAlert } = useData();
  const [filterCategory, setFilterCategory] = useState('ALL');

  const filtered = alerts.filter(n => {
    if (filterCategory === 'UNREAD') return n.status === 'ACTIVE';
    if (filterCategory === 'ALERT') return n.type === 'SPOILAGE';
    if (filterCategory === 'DEVICE') return n.type === 'HARDWARE';
    if (filterCategory === 'SYSTEM') return n.type === 'SYSTEM';
    return true;
  });

  return (
    <div className="page-container">
      <DemoBanner />

      <div className="page-header flex-between">
        <div>
          <h2 className="page-title">Notification Center</h2>
          <p className="page-subtitle">Real-time alerts, device updates, & system notifications</p>
        </div>
        <button className="btn-secondary" onClick={acknowledgeAllAlerts}>
          <CheckCheck size={16} /> Acknowledge Active Alerts
        </button>
      </div>

      <div className="glass-card table-toolbar mb-6">
        <div className="button-toggle-group">
          <button 
            className={`toggle-btn ${filterCategory === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterCategory('ALL')}
          >
            All ({alerts.length})
          </button>
          <button 
            className={`toggle-btn ${filterCategory === 'UNREAD' ? 'active' : ''}`}
            onClick={() => setFilterCategory('UNREAD')}
          >
            Unread ({alerts.filter(n => n.status === 'ACTIVE').length})
          </button>
          <button 
            className={`toggle-btn ${filterCategory === 'ALERT' ? 'active' : ''}`}
            onClick={() => setFilterCategory('ALERT')}
          >
            Alerts
          </button>
          <button 
            className={`toggle-btn ${filterCategory === 'DEVICE' ? 'active' : ''}`}
            onClick={() => setFilterCategory('DEVICE')}
          >
            Devices
          </button>
        </div>
      </div>

      <div className="glass-card section-card">
        <div className="notifications-list-page">
          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted">
              <Bell size={36} className="mx-auto mb-2 opacity-50" />
              <p>No notifications match the selected category</p>
            </div>
          ) : (
            filtered.map(n => (
              <div key={n.id} className={`notif-card-item ${n.status === 'ACTIVE' ? 'unread-bg' : ''}`}>
                <div className="notif-icon-col">
                  {n.type === 'SPOILAGE' && <AlertTriangle size={20} className="text-warning" />}
                  {n.type === 'HARDWARE' && <Cpu size={20} className="text-info" />}
                  {n.type !== 'SPOILAGE' && n.type !== 'HARDWARE' && <Info size={20} className="text-success" />}
                </div>
                <div className="notif-body-col">
                  <div className="flex-between">
                    <h4 className="notif-title">{n.alert_code || 'Alert'}</h4>
                    <div className="flex items-center gap-4">
                      <span className="notif-time">{n.created_at ? formatDateTime(n.created_at) : ''}</span>
                      {n.status === 'ACTIVE' && (
                        <button 
                          className="text-xs text-primary cursor-pointer hover:underline"
                          onClick={() => acknowledgeAlert(n.id)}
                        >
                          Acknowledge
                        </button>
                      )}
                    </div>
                  </div>
                  <p className="notif-desc">{n.message}</p>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Provider Architecture Preview */}
      <div className="glass-card section-card mt-6">
        <h3 className="section-title mb-2">Notification Channel Architecture</h3>
        <p className="text-xs text-muted mb-4">
          ColdGuard AI notification abstraction is prepared for multi-channel dispatch providers:
        </p>
        <div className="provider-stubs-grid">
          <div className="provider-box">
            <Mail size={20} className="text-primary" />
            <div>
              <strong>Email Provider</strong>
              <p className="text-xs text-muted">SMTP / SendGrid Gateway (Architecture Ready)</p>
            </div>
          </div>
          <div className="provider-box">
            <MessageSquare size={20} className="text-success" />
            <div>
              <strong>SMS Gateway</strong>
              <p className="text-xs text-muted">Twilio / Telephony API (Architecture Ready)</p>
            </div>
          </div>
          <div className="provider-box">
            <Send size={20} className="text-purple" />
            <div>
              <strong>Web / Push</strong>
              <p className="text-xs text-muted">WebPush / FCM Worker (Architecture Ready)</p>
            </div>
          </div>
        </div>
      </div>

    </div>
  );
}
