import React from 'react';

const SafetyBadge = ({ status, className = '' }) => {
  const normalizedStatus = status ? status.toLowerCase() : 'unknown';
  
  let label = status;
  let modifier = 'info';

  if (normalizedStatus === 'safe' || normalizedStatus === 'online') {
    modifier = 'safe';
  } else if (normalizedStatus === 'caution') {
    modifier = 'caution';
  } else if (normalizedStatus === 'unsafe' || normalizedStatus === 'critical') {
    modifier = 'unsafe';
  } else if (normalizedStatus === 'offline') {
    modifier = 'offline';
  }

  return (
    <span className={`badge badge--${modifier} ${className}`}>
      {label}
    </span>
  );
};

export default SafetyBadge;
