import React from 'react';

const SafetyGauge = ({ score }) => {
  // Clamp score between 0 and 100
  const normalizedScore = Math.min(100, Math.max(0, score || 0));
  
  // Calculate SVG stroke-dasharray parameters for a half-circle gauge
  const radius = 40;
  const circumference = radius * Math.PI; // Half circle
  const strokeDashoffset = circumference - (normalizedScore / 100) * circumference;
  
  let color = 'var(--safe)';
  if (normalizedScore < 50) color = 'var(--danger)';
  else if (normalizedScore < 80) color = 'var(--caution)';

  return (
    <div style={{ position: 'relative', width: '100px', height: '60px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
      <svg width="100" height="50" viewBox="0 0 100 50">
        {/* Background Arc */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke="var(--border-strong)"
          strokeWidth="8"
          strokeLinecap="round"
        />
        {/* Value Arc */}
        <path
          d="M 10 50 A 40 40 0 0 1 90 50"
          fill="none"
          stroke={color}
          strokeWidth="8"
          strokeLinecap="round"
          style={{
            strokeDasharray: circumference,
            strokeDashoffset: strokeDashoffset,
            transition: 'stroke-dashoffset 1s ease-in-out, stroke 0.5s ease'
          }}
        />
      </svg>
      
      <div style={{
        position: 'absolute',
        bottom: '-5px',
        left: '0',
        width: '100%',
        textAlign: 'center'
      }}>
        <span style={{ fontSize: '24px', fontWeight: '800', color: color, lineHeight: '1' }}>
          {normalizedScore}
        </span>
      </div>
    </div>
  );
};

export default SafetyGauge;
