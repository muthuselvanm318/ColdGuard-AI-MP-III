import React from 'react';

export default function StatCard({ title, value, icon: Icon, colorClass = 'primary', subtext, onClick }) {
  return (
    <div className={`stat-card stat-card-${colorClass}`} onClick={onClick}>
      <div className="stat-card-header">
        <span className="stat-card-title">{title}</span>
        {Icon && (
          <div className={`stat-card-icon-box icon-${colorClass}`}>
            <Icon size={20} />
          </div>
        )}
      </div>
      <div className="stat-card-body">
        <div className="stat-card-value">{value}</div>
        {subtext && <div className="stat-card-subtext">{subtext}</div>}
      </div>
    </div>
  );
}
