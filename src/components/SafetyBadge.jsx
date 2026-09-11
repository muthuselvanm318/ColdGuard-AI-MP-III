import React from 'react';
import { CheckCircle2, AlertTriangle, XCircle, Info } from 'lucide-react';

export default function SafetyBadge({ status = 'SAFE', showLabel = true, size = 'normal' }) {
  const normalized = String(status).toUpperCase();

  const config = {
    SAFE: { label: 'SAFE', color: 'badge-safe', icon: CheckCircle2, dotClass: 'pulse-dot-green' },
    CAUTION: { label: 'CAUTION', color: 'badge-caution', icon: AlertTriangle, dotClass: 'pulse-dot-amber' },
    UNSAFE: { label: 'UNSAFE', color: 'badge-unsafe', icon: XCircle, dotClass: 'pulse-dot-red' }
  }[normalized] || { label: normalized, color: 'badge-info', icon: Info, dotClass: 'pulse-dot-blue' };

  const IconComponent = config.icon;

  return (
    <span className={`safety-badge ${config.color} size-${size}`} title="Threshold-based UI status category">
      <span className={`badge-live-dot ${config.dotClass}`} />
      <IconComponent size={size === 'small' ? 12 : 15} className="badge-icon" />
      {showLabel && <span className="badge-text">{config.label}</span>}
    </span>
  );
}
