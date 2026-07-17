import React from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from 'recharts';

const TemperatureChart = ({ data, targetTemp = 4.0, height = "100%" }) => {
  if (!data || data.length === 0) return (
    <div className="empty-state" style={{ height }}>
      <div className="empty-state__title">No temperature data available</div>
    </div>
  );

  return (
    <div style={{ width: '100%', height }}>
      <ResponsiveContainer>
        <AreaChart
          data={data}
          margin={{ top: 10, right: 10, left: -20, bottom: 0 }}
        >
          <defs>
            <linearGradient id="colorTemp" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor="var(--accent-primary)" stopOpacity={0.3}/>
              <stop offset="95%" stopColor="var(--accent-primary)" stopOpacity={0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" vertical={false} />
          <XAxis 
            dataKey="timestamp" 
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            tickMargin={10}
            minTickGap={30}
          />
          <YAxis 
            tick={{ fontSize: 12, fill: 'var(--text-muted)' }}
            domain={['dataMin - 2', 'dataMax + 2']}
            tickFormatter={(value) => `${value.toFixed(1)}°`}
          />
          <Tooltip 
            contentStyle={{ 
              backgroundColor: 'var(--bg-glass-hover)', 
              borderColor: 'var(--border-strong)',
              borderRadius: '8px',
              color: '#fff',
              boxShadow: 'var(--shadow-md)',
              backdropFilter: 'blur(10px)'
            }}
            itemStyle={{ color: 'var(--accent-light)', fontWeight: 'bold' }}
            formatter={(value) => [`${Number(value).toFixed(1)}°C`, 'Temp']}
            labelStyle={{ color: 'var(--text-muted)', marginBottom: '4px' }}
          />
          
          <ReferenceLine y={targetTemp + 2} stroke="var(--danger)" strokeDasharray="3 3" label={{ position: 'insideTopLeft', value: 'Upper Limit', fill: 'var(--danger)', fontSize: 10 }} />
          <ReferenceLine y={targetTemp} stroke="var(--safe)" strokeDasharray="3 3" />
          
          <Area 
            type="monotone" 
            dataKey="temp" 
            stroke="var(--accent-primary)" 
            strokeWidth={2}
            fillOpacity={1} 
            fill="url(#colorTemp)" 
            isAnimationActive={false} // Disable animation for live updates
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
};

export default TemperatureChart;
