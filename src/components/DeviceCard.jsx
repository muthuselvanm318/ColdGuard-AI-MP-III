import React from 'react';
import { Battery, Wifi, WifiOff } from 'lucide-react';
import SafetyBadge from './SafetyBadge';
import { useTemperatureStream } from '../hooks/useTemperatureStream';
import TemperatureChart from './TemperatureChart';

const DeviceCard = ({ device }) => {
  // Use hook to get real-time simulated data for this specific device
  const { currentTemp, status, history, targetTemp } = useTemperatureStream(device.id);

  const isOnline = status === 'online';

  return (
    <div className="glass-card">
      <div className="flex justify-between items-start mb-md">
        <div>
          <h3 style={{ fontSize: 'var(--font-lg)', fontWeight: '600', marginBottom: '4px' }}>{device.name}</h3>
          <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>ID: {device.id} • {device.location}</p>
        </div>
        <SafetyBadge status={status} />
      </div>

      <div className="flex items-center justify-between mb-lg">
        <div>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Current Temp</div>
          <div style={{ 
            fontSize: '2rem', 
            fontWeight: '800', 
            lineHeight: '1',
            color: currentTemp > targetTemp + 2 ? 'var(--danger)' : 'var(--text-primary)'
          }}>
            {currentTemp !== undefined ? `${currentTemp.toFixed(1)}°C` : '--'}
          </div>
        </div>
        
        <div style={{ textAlign: 'right' }}>
          <div style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)', marginBottom: '4px' }}>Target</div>
          <div style={{ fontSize: '1.25rem', fontWeight: '600' }}>
            {targetTemp.toFixed(1)}°C
          </div>
        </div>
      </div>

      <div style={{ height: '80px', marginBottom: 'var(--space-md)' }}>
        <TemperatureChart data={history.slice(-24)} targetTemp={targetTemp} height="100%" /> 
        {/* Show only last 2 hours (24 readings * 5min) in mini chart */}
      </div>

      <div className="flex justify-between items-center" style={{ paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-default)' }}>
        <div className="flex items-center gap-sm text-muted" style={{ fontSize: 'var(--font-xs)' }}>
          {isOnline ? <Wifi size={14} className="text-safe" /> : <WifiOff size={14} />}
          <span>{isOnline ? 'Connected' : 'Offline'}</span>
        </div>
        
        <div className="flex items-center gap-sm text-muted" style={{ fontSize: 'var(--font-xs)' }}>
          <Battery size={14} color={device.batteryLevel < 20 ? 'var(--danger)' : 'var(--text-muted)'} />
          <span>{device.batteryLevel}%</span>
        </div>
      </div>
    </div>
  );
};

export default DeviceCard;
