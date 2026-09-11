import React, { useState, useEffect } from 'react';
import { 
  ResponsiveContainer, 
  AreaChart, 
  Area, 
  XAxis, 
  YAxis, 
  CartesianGrid, 
  Tooltip, 
  ReferenceLine 
} from 'recharts';
import { getSettings } from '../api/settingsApi';

export default function TemperatureChart({ data = [], height = 300, showThresholds = true }) {
  const [settings, setSettings] = useState(null);

  useEffect(() => {
    async function loadSettings() {
      try {
        const serverSettings = await getSettings();
        if (serverSettings) {
          setSettings(serverSettings);
        }
      } catch (err) {
        console.warn("Could not load settings for chart", err);
      }
    }
    loadSettings();
  }, []);

  // Thresholds from backend settings (fallback to reasonable defaults while loading)
  const recommendedMax = settings?.maximum_temperature ?? 5.0;
  const warningLevel = settings?.warning_temperature ?? 7.0;
  const criticalLevel = settings?.critical_temperature ?? 10.0;

  // Format timestamp for chart XAxis
  const chartData = data.map(item => ({
    time: new Date(item.recorded_at || item.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
    temperature: Number(item.temperature_c),
    rawTimestamp: item.recorded_at || item.timestamp
  }));

  if (chartData.length === 0) {
    return (
      <div className="chart-empty-state flex-center bg-gray-50 rounded border text-muted" style={{ height }}>
        <p>No temperature history data available</p>
      </div>
    );
  }

  const activeColor = '#0284C7'; // Fixed enterprise blue theme

  const CustomTooltip = ({ active, payload, label }) => {
    if (active && payload && payload.length) {
      const temp = payload[0].value;
      let statusClass = 'text-success';
      if (temp >= criticalLevel) statusClass = 'text-danger';
      else if (temp >= warningLevel) statusClass = 'text-warning';

      return (
        <div className="custom-chart-tooltip p-3 bg-white border rounded shadow-md">
          <div className="tooltip-time font-bold mb-1">{label}</div>
          <div className="tooltip-temp-row flex justify-between gap-4">
            <span className="tooltip-label text-muted text-sm">Temperature:</span>
            <span className={`tooltip-val font-semibold ${statusClass}`}>{temp} °C</span>
          </div>
          <div className="tooltip-date-sub text-xs text-gray-400 mt-2">
            {new Date(payload[0].payload.rawTimestamp).toLocaleDateString()}
          </div>
        </div>
      );
    }
    return null;
  };

  return (
    <div className="temperature-chart-wrapper" style={{ width: '100%', height }}>
      <ResponsiveContainer width="100%" height="100%">
        <AreaChart data={chartData} margin={{ top: 15, right: 20, left: -10, bottom: 5 }}>
          <defs>
            <linearGradient id="tempGradient" x1="0" y1="0" x2="0" y2="1">
              <stop offset="5%" stopColor={activeColor} stopOpacity={0.45}/>
              <stop offset="95%" stopColor={activeColor} stopOpacity={0.0}/>
            </linearGradient>
          </defs>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="time" stroke="#6b7280" fontSize={12} tickLine={false} />
          <YAxis stroke="#6b7280" fontSize={12} domain={['auto', 'auto']} tickFormatter={(v) => `${v}°C`} />
          <Tooltip content={<CustomTooltip />} />

          {showThresholds && settings && (
            <>
              {/* Recommended Max Threshold Line */}
              <ReferenceLine 
                y={recommendedMax} 
                stroke="#10B981" 
                strokeDasharray="4 4" 
                label={{ value: `Rec Max (${recommendedMax}°C)`, fill: '#10B981', fontSize: 11, position: 'insideTopRight' }} 
              />
              {/* Warning Threshold Line */}
              <ReferenceLine 
                y={warningLevel} 
                stroke="#F59E0B" 
                strokeDasharray="4 4" 
                label={{ value: `Warning (${warningLevel}°C)`, fill: '#F59E0B', fontSize: 11, position: 'insideTopRight' }} 
              />
              {/* Critical Threshold Line */}
              <ReferenceLine 
                y={criticalLevel} 
                stroke="#EF4444" 
                strokeDasharray="4 4" 
                label={{ value: `Critical (${criticalLevel}°C)`, fill: '#EF4444', fontSize: 11, position: 'insideTopRight' }} 
              />
            </>
          )}

          <Area 
            type="monotone" 
            dataKey="temperature" 
            stroke={activeColor} 
            strokeWidth={3}
            fillOpacity={1} 
            fill="url(#tempGradient)"
            activeDot={{ r: 6, stroke: '#fff', strokeWidth: 2, fill: activeColor }}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
