import React, { useState } from 'react';
import { Box, Thermometer, Clock, Activity } from 'lucide-react';
import SafetyGauge from './SafetyGauge';
import SafetyBadge from './SafetyBadge';
import { useData } from '../context/DataContext';
import { useTemperatureStream } from '../hooks/useTemperatureStream';
import { usePrediction } from '../hooks/usePrediction';

const ProductCard = ({ product }) => {
  const { devices, updateProduct } = useData();
  const device = devices.find(d => d.id === product.deviceId);
  
  // Get live temperature history for the device this product is in
  const { history } = useTemperatureStream(product.deviceId);
  
  // Run ML prediction based on product info + live device data
  const { prediction, isPredicting } = usePrediction(product, device, history);

  // If prediction returns a new score, we could optionally update the product in context
  // But for display purposes, we can just show the live prediction
  const displayScore = prediction ? prediction.safetyScore : product.safetyScore;
  const displayRisk = prediction ? prediction.riskLevel : product.riskLevel;

  const getStorageTime = (dateStr) => {
    const hours = (new Date() - new Date(dateStr)) / 3600000;
    if (hours < 24) return `${Math.floor(hours)}h`;
    return `${Math.floor(hours / 24)}d`;
  };

  return (
    <div className="glass-card">
      <div className="flex justify-between items-start mb-md">
        <div className="flex gap-sm items-center">
          <div className="btn-icon" style={{ cursor: 'default' }}>
            <Box size={20} className="text-accent" />
          </div>
          <div>
            <h3 style={{ fontSize: 'var(--font-base)', fontWeight: '600', marginBottom: '2px' }} className="truncate" title={product.name}>
              {product.name}
            </h3>
            <p style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
              {product.id} • {product.category}
            </p>
          </div>
        </div>
      </div>

      <div className="flex justify-between items-center mt-lg mb-lg" style={{ background: 'var(--bg-card)', padding: 'var(--space-md)', borderRadius: 'var(--radius-md)' }}>
        <div className="flex flex-col gap-sm">
          <div className="flex items-center gap-sm">
            <Thermometer size={14} className="text-muted" />
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
              In: <span style={{ color: 'var(--text-primary)' }}>{device?.name || 'Unknown'}</span>
            </span>
          </div>
          <div className="flex items-center gap-sm">
            <Clock size={14} className="text-muted" />
            <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-secondary)' }}>
              Stored: <span style={{ color: 'var(--text-primary)' }}>{getStorageTime(product.storageDate)}</span>
            </span>
          </div>
        </div>
        
        <div style={{ position: 'relative' }}>
           <SafetyGauge score={displayScore} />
           {isPredicting && (
             <div style={{ position: 'absolute', top: -5, right: -5 }}>
               <Activity size={12} className="text-accent" style={{ animation: 'pulse-glow 1.5s infinite' }} />
             </div>
           )}
        </div>
      </div>

      <div className="flex justify-between items-center" style={{ paddingTop: 'var(--space-md)', borderTop: '1px solid var(--border-default)' }}>
        <span style={{ fontSize: 'var(--font-xs)', color: 'var(--text-muted)' }}>
          ML Assessment
        </span>
        <SafetyBadge status={displayRisk} />
      </div>
    </div>
  );
};

export default ProductCard;
