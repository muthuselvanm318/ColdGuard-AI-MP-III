import React from 'react';
import { ArrowUpRight, ArrowDownRight } from 'lucide-react';

const StatCard = ({ title, value, icon: Icon, trend, trendValue, type = 'accent' }) => {
  
  const typeClass = `stat-card__icon--${type}`;
  const trendClass = trend === 'up' ? 'stat-card__trend--up' : trend === 'down' ? 'stat-card__trend--down' : '';
  const TrendIcon = trend === 'up' ? ArrowUpRight : ArrowDownRight;

  return (
    <div className="stat-card">
      <div className={`stat-card__icon ${typeClass}`}>
        <Icon size={24} />
      </div>
      <div>
        <div className="stat-card__value">{value}</div>
        <div className="stat-card__label">{title}</div>
      </div>
      {trend && (
        <div className={`stat-card__trend ${trendClass}`}>
          <TrendIcon size={12} />
          <span>{trendValue}</span>
        </div>
      )}
    </div>
  );
};

export default StatCard;
