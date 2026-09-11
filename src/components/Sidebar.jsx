import React from 'react';
import { NavLink } from 'react-router-dom';
import { 
  LayoutDashboard, 
  Package, 
  Cpu, 
  Thermometer, 
  AlertTriangle, 
  BarChart3, 
  BrainCircuit, 
  Settings 
} from 'lucide-react';
import { useData } from '../context/DataContext';

export default function Sidebar({ isOpen, onCloseMobile }) {
  const { alerts } = useData();

  const activeAlertsCount = alerts?.filter(a => a.status === 'ACTIVE').length || 0;

  return (
    <aside className={`app-sidebar ${isOpen ? 'mobile-open' : ''}`}>
      <div className="sidebar-nav-container">
        <div className="sidebar-section-header">MAIN NAVIGATION</div>
        <nav className="sidebar-nav">
          
          <NavLink to="/" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onCloseMobile}>
            <div className="sidebar-link-inner">
              <LayoutDashboard size={18} className="sidebar-link-icon" />
              <span className="sidebar-link-text">Dashboard</span>
            </div>
          </NavLink>

          <div className="sidebar-section-header mt-4">MONITORING</div>
          <NavLink to="/monitoring" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onCloseMobile}>
            <div className="sidebar-link-inner">
              <Thermometer size={18} className="sidebar-link-icon" />
              <span className="sidebar-link-text">Temperature</span>
            </div>
          </NavLink>
          <NavLink to="/devices" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onCloseMobile}>
            <div className="sidebar-link-inner">
              <Cpu size={18} className="sidebar-link-icon" />
              <span className="sidebar-link-text">Sensors</span>
            </div>
          </NavLink>

          <div className="sidebar-section-header mt-4">PRODUCTS</div>
          <NavLink to="/products" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onCloseMobile}>
            <div className="sidebar-link-inner">
              <Package size={18} className="sidebar-link-icon" />
              <span className="sidebar-link-text">Milk Products</span>
            </div>
          </NavLink>

          <div className="sidebar-section-header mt-4">INTELLIGENCE</div>
          <NavLink to="/analytics" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onCloseMobile}>
            <div className="sidebar-link-inner">
              <BrainCircuit size={18} className="sidebar-link-icon" />
              <span className="sidebar-link-text">Analytics & Predictions</span>
            </div>
          </NavLink>

          <div className="sidebar-section-header mt-4">SYSTEM</div>
          <NavLink to="/alerts" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onCloseMobile}>
            <div className="sidebar-link-inner">
              <AlertTriangle size={18} className="sidebar-link-icon" />
              <span className="sidebar-link-text">Alerts</span>
            </div>
            {activeAlertsCount > 0 && (
              <span className="sidebar-nav-badge nav-badge-alert">
                {activeAlertsCount}
              </span>
            )}
          </NavLink>
          <NavLink to="/settings" className={({ isActive }) => `sidebar-link ${isActive ? 'active' : ''}`} onClick={onCloseMobile}>
            <div className="sidebar-link-inner">
              <Settings size={18} className="sidebar-link-icon" />
              <span className="sidebar-link-text">Settings</span>
            </div>
          </NavLink>

        </nav>
      </div>

      <div className="sidebar-footer">
        <div className="system-version-tag">ColdGuard AI v2.0</div>
      </div>
    </aside>
  );
}
