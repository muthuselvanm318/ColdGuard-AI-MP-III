import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import DemoBanner from '../components/DemoBanner';
import { Bell, CheckCheck, AlertTriangle, Cpu, Info, Mail, MessageSquare, Send } from 'lucide-react';

export default function Notifications() {
  const { notifications, markAllNotificationsRead } = useData();
  const [filterCategory, setFilterCategory] = useState('ALL');

  const filtered = notifications.filter(n => {
    if (filterCategory === 'UNREAD') return !n.read_status;
    if (filterCategory === 'ALERT') return n.category === 'ALERT';
    if (filterCategory === 'DEVICE') return n.category === 'DEVICE';
    if (filterCategory === 'SYSTEM') return n.category === 'SYSTEM';
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
        <button className="btn-secondary" onClick={markAllNotificationsRead}>
          <CheckCheck size={16} /> Mark All as Read
        </button>
      </div>

      <div className="glass-card table-toolbar mb-6">
        <div className="button-toggle-group">
          <button 
            className={`toggle-btn ${filterCategory === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterCategory('ALL')}
          >
            All ({notifications.length})
          </button>
          <button 
            className={`toggle-btn ${filterCategory === 'UNREAD' ? 'active' : ''}`}
            onClick={() => setFilterCategory('UNREAD')}
          >
            Unread ({notifications.filter(n => !n.read_status).length})
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
              <div key={n.id} className={`notif-card-item ${!n.read_status ? 'unread-bg' : ''}`}>
                <div className="notif-icon-col">
                  {n.category === 'ALERT' && <AlertTriangle size={20} className="text-warning" />}
                  {n.category === 'DEVICE' && <Cpu size={20} className="text-info" />}
                  {n.category === 'SYSTEM' && <Info size={20} className="text-success" />}
                </div>
                <div className="notif-body-col">
                  <div className="flex-between">
                    <h4 className="notif-title">{n.title}</h4>
                    <span className="notif-time">{new Date(n.created_at).toLocaleString()}</span>
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
