import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { X, CheckCheck, Bell, AlertTriangle, Cpu, Info, ShieldCheck, Mail, MessageSquare, Send, Trash2 } from 'lucide-react';
import { formatDateTime, formatTimeOnly, formatDateOnly } from '../utils/dateTime';

export default function NotificationDrawer({ onClose }) {
  const { notifications, markAllNotificationsRead } = useData();
  const [filterCategory, setFilterCategory] = useState('ALL');

  const filtered = notifications.filter(n => {
    if (filterCategory === 'UNREAD') return !n.read_status;
    if (filterCategory === 'ALERT') return n.category === 'ALERT';
    if (filterCategory === 'DEVICE') return n.category === 'DEVICE';
    if (filterCategory === 'SYSTEM') return n.category === 'SYSTEM';
    return true;
  });

  const unreadCount = notifications.filter(n => !n.read_status).length;

  return (
    <div className="notification-drawer-overlay" onClick={onClose}>
      <div className="notification-drawer-panel" onClick={e => e.stopPropagation()}>
        
        {/* Drawer Header */}
        <div className="drawer-header">
          <div className="drawer-title-group">
            <div className="drawer-icon-badge">
              <Bell size={20} className="text-primary" />
              {unreadCount > 0 && <span className="drawer-unread-dot">{unreadCount}</span>}
            </div>
            <div>
              <h3 className="drawer-main-title">Food Safety Alerts & Notifications</h3>
              <p className="drawer-sub-title">Real-time cold-chain breach log & sensor heartbeats</p>
            </div>
          </div>
          <button className="drawer-close-btn" onClick={onClose} aria-label="Close Drawer">
            <X size={20} />
          </button>
        </div>

        {/* Category Filters */}
        <div className="drawer-tabs">
          <button 
            className={`drawer-tab-btn ${filterCategory === 'ALL' ? 'active' : ''}`}
            onClick={() => setFilterCategory('ALL')}
          >
            All ({notifications.length})
          </button>
          <button 
            className={`drawer-tab-btn ${filterCategory === 'UNREAD' ? 'active' : ''}`}
            onClick={() => setFilterCategory('UNREAD')}
          >
            Unread ({unreadCount})
          </button>
          <button 
            className={`drawer-tab-btn ${filterCategory === 'ALERT' ? 'active' : ''}`}
            onClick={() => setFilterCategory('ALERT')}
          >
            Breaches
          </button>
          <button 
            className={`drawer-tab-btn ${filterCategory === 'DEVICE' ? 'active' : ''}`}
            onClick={() => setFilterCategory('DEVICE')}
          >
            Hardware
          </button>
        </div>

        {/* Action Toolbar */}
        <div className="drawer-toolbar">
          <button className="drawer-action-btn" onClick={markAllNotificationsRead}>
            <CheckCheck size={15} /> Mark all as read
          </button>
          <span className="text-xs text-muted">{filtered.length} notification(s)</span>
        </div>

        {/* Notification List */}
        <div className="drawer-scroll-body">
          {filtered.length === 0 ? (
            <div className="drawer-empty-state">
              <ShieldCheck size={44} className="text-success mb-2 opacity-80" />
              <h4 className="font-bold text-sm">All Clear!</h4>
              <p className="text-xs text-muted mt-1">No notifications found in this category.</p>
            </div>
          ) : (
            filtered.map((item) => (
              <div 
                key={item.id} 
                className={`drawer-notif-card ${!item.read_status ? 'unread-highlight' : ''}`}
              >
                <div className="notif-type-icon">
                  {item.category === 'ALERT' && <AlertTriangle size={18} className="text-warning" />}
                  {item.category === 'DEVICE' && <Cpu size={18} className="text-info" />}
                  {item.category === 'SYSTEM' && <Info size={18} className="text-success" />}
                </div>
                <div className="notif-content">
                  <div className="notif-card-header">
                    <span className="notif-card-title">{item.title}</span>
                    <span className="notif-card-time">
                      {formatTimeOnly(item.created_at)}
                    </span>
                  </div>
                  <p className="notif-card-msg">{item.message}</p>
                </div>
              </div>
            ))
          )}
        </div>

        {/* Footer Channel Dispatch Stubs */}
        <div className="drawer-footer-channels">
          <span className="channel-label">Automated Dispatch Architecture:</span>
          <div className="channel-chips">
            <span className="channel-chip"><Mail size={13} /> Email</span>
            <span className="channel-chip"><MessageSquare size={13} /> SMS</span>
            <span className="channel-chip"><Send size={13} /> WebPush</span>
          </div>
        </div>

      </div>
    </div>
  );
}
