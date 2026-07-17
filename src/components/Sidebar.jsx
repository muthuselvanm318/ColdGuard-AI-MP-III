import React from 'react';
import { NavLink } from 'react-router-dom';
import { LayoutDashboard, Thermometer, Box, Activity, Bell, Settings } from 'lucide-react';
import { useData } from '../context/DataContext';

const Sidebar = () => {
  const { alerts } = useData();
  const unreadAlertsCount = alerts.filter(a => !a.acknowledged).length;

  const navItems = [
    { path: '/', label: 'Dashboard', icon: LayoutDashboard },
    { path: '/devices', label: 'Devices', icon: Thermometer },
    { path: '/products', label: 'Products', icon: Box },
    { path: '/analytics', label: 'Analytics', icon: Activity },
    { path: '/alerts', label: 'Alerts', icon: Bell, badge: unreadAlertsCount },
  ];

  return (
    <aside style={{
      width: 'var(--sidebar-width)',
      height: '100vh',
      position: 'fixed',
      left: 0,
      top: 0,
      background: 'var(--bg-secondary)',
      borderRight: '1px solid var(--border-default)',
      display: 'flex',
      flexDirection: 'column',
      zIndex: 50,
      padding: 'var(--space-lg)'
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: 'var(--space-2xl)' }}>
        <div style={{
          width: '36px', height: '36px', borderRadius: '8px',
          background: 'var(--accent-gradient)',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          color: 'white', fontWeight: 'bold'
        }}>
          CA
        </div>
        <h1 style={{ fontSize: 'var(--font-lg)', fontWeight: '800', letterSpacing: '-0.02em', color: 'var(--text-primary)', margin: 0 }}>
          ColdGuard AI
        </h1>
      </div>

      <nav style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: '8px' }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            style={({ isActive }) => ({
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '12px 16px',
              borderRadius: 'var(--radius-md)',
              color: isActive ? 'var(--accent-light)' : 'var(--text-secondary)',
              background: isActive ? 'rgba(6, 182, 212, 0.1)' : 'transparent',
              textDecoration: 'none',
              fontWeight: isActive ? '600' : '500',
              transition: 'all var(--transition-fast)'
            })}
          >
            <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
              <item.icon size={20} />
              <span>{item.label}</span>
            </div>
            {item.badge > 0 && (
              <div style={{
                background: 'var(--danger)',
                color: 'white',
                fontSize: '11px',
                fontWeight: 'bold',
                padding: '2px 6px',
                borderRadius: '10px',
                minWidth: '20px',
                textAlign: 'center'
              }}>
                {item.badge}
              </div>
            )}
          </NavLink>
        ))}
      </nav>

      <div style={{ marginTop: 'auto', paddingTop: 'var(--space-lg)', borderTop: '1px solid var(--border-default)' }}>
        <button style={{
          display: 'flex', alignItems: 'center', gap: '12px', padding: '12px 16px',
          width: '100%', borderRadius: 'var(--radius-md)',
          color: 'var(--text-secondary)', textAlign: 'left',
          transition: 'all var(--transition-fast)'
        }}
        onMouseOver={e => { e.currentTarget.style.color = 'var(--text-primary)'; e.currentTarget.style.background = 'var(--bg-glass-hover)'; }}
        onMouseOut={e => { e.currentTarget.style.color = 'var(--text-secondary)'; e.currentTarget.style.background = 'transparent'; }}
        >
          <Settings size={20} />
          <span style={{ fontWeight: '500' }}>Settings</span>
        </button>
      </div>
    </aside>
  );
};

export default Sidebar;
