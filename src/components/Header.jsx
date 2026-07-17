import React from 'react';
import { Search, User } from 'lucide-react';
import { useLocation } from 'react-router-dom';

const Header = () => {
  const location = useLocation();
  const pathMap = {
    '/': 'Dashboard Overview',
    '/devices': 'IoT Device Management',
    '/products': 'Food Product Inventory',
    '/analytics': 'Temperature Analytics & ML Insights',
    '/alerts': 'System Alerts'
  };

  const title = pathMap[location.pathname] || 'ColdGuard AI';

  return (
    <header style={{
      height: 'var(--header-height)',
      position: 'fixed',
      top: 0,
      right: 0,
      left: 'var(--sidebar-width)',
      background: 'rgba(6, 10, 20, 0.8)',
      backdropFilter: 'blur(12px)',
      borderBottom: '1px solid var(--border-default)',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 var(--space-xl)',
      zIndex: 40
    }}>
      <h2 style={{ fontSize: '1.25rem', fontWeight: '600', margin: 0 }}>
        {title}
      </h2>

      <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-md)' }}>
        <div style={{ position: 'relative' }}>
          <Search size={18} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input 
            type="text" 
            placeholder="Search devices, products..." 
            style={{
              background: 'var(--bg-input)',
              border: '1px solid var(--border-default)',
              borderRadius: 'var(--radius-full)',
              padding: '8px 16px 8px 38px',
              color: 'var(--text-primary)',
              fontSize: 'var(--font-sm)',
              width: '240px'
            }}
          />
        </div>
        
        <button className="btn-icon" style={{ borderRadius: '50%' }}>
          <User size={18} />
        </button>
      </div>
    </header>
  );
};

export default Header;
