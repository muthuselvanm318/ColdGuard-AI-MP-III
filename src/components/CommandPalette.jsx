import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { useData } from '../context/DataContext';
import { 
  Search, X, LayoutDashboard, Package, Box, Cpu, 
  Thermometer, AlertTriangle, BarChart3, FileText, Bell, Users, Settings, ArrowRight 
} from 'lucide-react';

export default function CommandPalette({ isOpen, onClose }) {
  const [query, setQuery] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);
  const navigate = useNavigate();
  const inputRef = useRef(null);
  const { products, refrigerators, devices, alerts } = useData();

  useEffect(() => {
    if (isOpen && inputRef.current) {
      inputRef.current.focus();
    }
  }, [isOpen]);

  useEffect(() => {
    const handleKeyDown = (e) => {
      if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (isOpen) onClose();
        else window.dispatchEvent(new CustomEvent('open-command-palette'));
      }
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const pages = [
    { name: 'Dashboard Overview', path: '/', category: 'Pages', icon: LayoutDashboard },
    { name: 'Monitored Products Batch Registry', path: '/products', category: 'Pages', icon: Package },
    { name: 'Cold Storage Refrigerators', path: '/refrigerators', category: 'Pages', icon: Box },
    { name: 'IoT Sensor Devices (ESP32)', path: '/devices', category: 'Pages', icon: Cpu },
    { name: 'Live Temperature Feed', path: '/monitoring', category: 'Pages', icon: Thermometer },
    { name: 'System Alert Breach Logs', path: '/alerts', category: 'Pages', icon: AlertTriangle },
    { name: 'Thermal Analytics & Trends', path: '/analytics', category: 'Pages', icon: BarChart3 },
    { name: 'Safety Compliance Reports', path: '/reports', category: 'Pages', icon: FileText },
    { name: 'Notification Center', path: '/notifications', category: 'Pages', icon: Bell },
    { name: 'User Management & Roles', path: '/users', category: 'Pages', icon: Users },
    { name: 'Threshold & System Settings', path: '/settings', category: 'Pages', icon: Settings },
  ];

  const productItems = (products || []).map(p => ({
    name: `${p.name} (${p.product_code})`,
    path: `/products/${p.id}`,
    category: 'Product',
    icon: Package
  }));

  const refrigeratorItems = (refrigerators || []).map(r => ({
    name: `${r.name} [${r.ref_code}]`,
    path: `/refrigerators/${r.id}`,
    category: 'Refrigerator',
    icon: Box
  }));

  const deviceItems = (devices || []).map(d => ({
    name: `${d.device_name} (${d.device_code})`,
    path: `/devices/${d.id}`,
    category: 'IoT Device',
    icon: Cpu
  }));

  const allItems = [...pages, ...productItems, ...refrigeratorItems, ...deviceItems];

  const filteredItems = query.trim() === ''
    ? pages
    : allItems.filter(item => 
        item.name.toLowerCase().includes(query.toLowerCase()) || 
        item.category.toLowerCase().includes(query.toLowerCase())
      );

  const handleSelect = (item) => {
    navigate(item.path);
    onClose();
  };

  return (
    <div className="command-palette-overlay" onClick={onClose}>
      <div className="command-palette-modal" onClick={e => e.stopPropagation()}>
        <div className="command-palette-header">
          <Search size={20} className="command-palette-search-icon" />
          <input
            ref={inputRef}
            type="text"
            className="command-palette-input"
            placeholder="Search pages, products, refrigerators, devices... (Esc to cancel)"
            value={query}
            onChange={(e) => { setQuery(e.target.value); setSelectedIndex(0); }}
          />
          <button className="command-palette-close-btn" onClick={onClose}>
            <X size={18} />
          </button>
        </div>

        <div className="command-palette-results">
          {filteredItems.length === 0 ? (
            <div className="command-palette-empty">
              No results found matching "{query}"
            </div>
          ) : (
            filteredItems.map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={`${item.category}-${item.name}-${idx}`}
                  className={`command-palette-item ${idx === selectedIndex ? 'selected' : ''}`}
                  onClick={() => handleSelect(item)}
                  onMouseEnter={() => setSelectedIndex(idx)}
                >
                  <div className="command-item-left">
                    <Icon size={18} className="command-item-icon" />
                    <span className="command-item-name">{item.name}</span>
                  </div>
                  <div className="command-item-right">
                    <span className="command-item-cat">{item.category}</span>
                    <ArrowRight size={14} className="command-item-arrow" />
                  </div>
                </div>
              );
            })
          )}
        </div>

        <div className="command-palette-footer">
          <span><kbd>↑</kbd> <kbd>↓</kbd> Navigate</span>
          <span><kbd>Enter</kbd> Select</span>
          <span><kbd>Esc</kbd> Close</span>
        </div>
      </div>
    </div>
  );
}
