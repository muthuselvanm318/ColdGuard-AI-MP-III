import React, { useState } from 'react';
import { useData } from '../context/DataContext';
import { 
  Bell, Shield, Menu, X, Search, Sparkles 
} from 'lucide-react';
import NotificationDrawer from './NotificationDrawer';

export default function Header({ toggleMobileSidebar, isMobileSidebarOpen, openCommandPalette }) {
  const { alerts } = useData();

  const [isNotifOpen, setIsNotifOpen] = useState(false);

  const activeAlertsCount = alerts.filter(a => a.status === 'ACTIVE').length;

  return (
    <header className="app-header">
      <div className="header-left">
        <button 
          className="mobile-menu-btn" 
          onClick={() => { toggleMobileSidebar(); }} 
          aria-label="Toggle Navigation"
        >
          {isMobileSidebarOpen ? <X size={22} /> : <Menu size={22} />}
        </button>

        <div className="header-brand">
          <div className="brand-icon-wrapper">
            <Shield className="brand-icon" size={24} />
          </div>
          <div>
            <h1 className="brand-title flex-align-gap">
              ColdGuard AI
              <span className="brand-tag"><Sparkles size={11} /> PRO</span>
            </h1>
            <p className="brand-subtitle">Refrigerated Food Safety & Cold-Chain Monitoring</p>
          </div>
        </div>

        {/* System Health Status Indicator Pill */}
        <div className={`system-status-pill ${activeAlertsCount > 0 ? 'status-warning' : 'status-normal'}`}>
          <span className="status-dot-pulse" />
          <span>{activeAlertsCount > 0 ? `${activeAlertsCount} Active Alerts` : 'System Online'}</span>
        </div>
      </div>

      <div className="header-right">
        {/* Global Command Palette Search Button */}
        <button 
          className="command-search-btn"
          onClick={() => { openCommandPalette(); }}
          title="Search pages, products, devices (Cmd+K)"
        >
          <Search size={15} />
          <span className="search-btn-text">Quick Search...</span>
          <kbd className="search-btn-kbd">⌘K</kbd>
        </button>

        {/* Notification Drawer Trigger */}
        <button 
          className="icon-button notification-button" 
          onClick={() => { setIsNotifOpen(prev => !prev); }}
          title="Notifications"
        >
          <Bell size={20} />
          {activeAlertsCount > 0 && <span className="notification-badge">{activeAlertsCount}</span>}
        </button>

        <div className="profile-placeholder">
          <div className="profile-circle">AD</div>
        </div>
      </div>

      {/* Slide-over Notification Center Drawer */}
      {isNotifOpen && <NotificationDrawer onClose={() => setIsNotifOpen(false)} />}
    </header>
  );
}
