import React from 'react';
import { Thermometer, Box, Activity, Bell } from 'lucide-react';
import { useData } from '../context/DataContext';
import StatCard from '../components/StatCard';
import DeviceCard from '../components/DeviceCard';
import ProductCard from '../components/ProductCard';
import AlertItem from '../components/AlertItem';

const Dashboard = () => {
  const { devices, products, alerts } = useData();

  const activeDevices = devices.filter(d => d.status === 'online').length;
  const unreadAlerts = alerts.filter(a => !a.acknowledged);
  
  const avgSafetyScore = products.length > 0 
    ? Math.round(products.reduce((acc, p) => acc + p.safetyScore, 0) / products.length) 
    : 0;

  return (
    <div className="page">
      <div className="page-header">
        <div>
          <h1 className="page-title">Dashboard Overview</h1>
          <p className="page-subtitle">Real-time monitoring and safety assessment</p>
        </div>
      </div>

      <div className="grid-4 mb-lg stagger-children">
        <StatCard 
          title="Active Devices" 
          value={`${activeDevices}/${devices.length}`} 
          icon={Thermometer} 
          trend={activeDevices === devices.length ? "up" : "down"}
          trendValue={activeDevices === devices.length ? "All Online" : `${devices.length - activeDevices} Offline`}
          type="info"
        />
        <StatCard 
          title="Products Monitored" 
          value={products.length} 
          icon={Box} 
          type="accent"
        />
        <StatCard 
          title="Avg Safety Score" 
          value={avgSafetyScore} 
          icon={Activity} 
          trend={avgSafetyScore >= 80 ? "up" : "down"}
          trendValue={avgSafetyScore >= 80 ? "Optimal" : "Check items"}
          type={avgSafetyScore >= 80 ? "safe" : avgSafetyScore >= 50 ? "caution" : "danger"}
        />
        <StatCard 
          title="Active Alerts" 
          value={unreadAlerts.length} 
          icon={Bell} 
          type={unreadAlerts.length > 0 ? "danger" : "safe"}
        />
      </div>

      <div className="grid-3">
        <div style={{ gridColumn: 'span 2' }} className="flex flex-col gap-lg">
          <section className="stagger-children">
            <div className="section-header">
              <h2 className="section-title">IoT Devices</h2>
            </div>
            <div className="grid-2">
              {devices.map(device => (
                <DeviceCard key={device.id} device={device} />
              ))}
            </div>
          </section>

          <section className="stagger-children">
            <div className="section-header">
              <h2 className="section-title">Critical Products</h2>
            </div>
            <div className="grid-2">
              {products.slice(0, 4).map(product => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        </div>

        <div className="flex flex-col gap-lg">
          <section className="glass-card" style={{ padding: '0', height: '100%', display: 'flex', flexDirection: 'column' }}>
            <div className="section-header" style={{ padding: 'var(--space-lg) var(--space-lg) 0' }}>
              <h2 className="section-title">Recent Alerts</h2>
            </div>
            <div style={{ flex: 1, padding: 'var(--space-lg)', overflowY: 'auto' }}>
              {alerts.length > 0 ? (
                alerts.slice(0, 5).map(alert => (
                  <AlertItem key={alert.id} alert={alert} />
                ))
              ) : (
                <div className="empty-state" style={{ height: '200px' }}>
                  <Bell className="empty-state__icon" />
                  <div className="empty-state__title">No alerts</div>
                  <div className="empty-state__desc">All systems normal</div>
                </div>
              )}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
};

export default Dashboard;
