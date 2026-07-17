/**
 * alertService.js
 * 
 * Manages temperature alerts and notifications.
 */

import { MOCK_ALERTS } from './mockData';

let alerts = [...MOCK_ALERTS];

export const getAlerts = async () => {
  // Return sorted by newest first
  return [...alerts].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
};

export const getActiveAlerts = async () => {
  return alerts.filter(a => !a.acknowledged);
};

export const acknowledgeAlert = async (alertId) => {
  const alert = alerts.find(a => a.id === alertId);
  if (alert) {
    alert.acknowledged = true;
  }
  return alert;
};

export const acknowledgeAll = async () => {
  alerts.forEach(a => { a.acknowledged = true; });
  return true;
};

export const clearAlert = async (alertId) => {
  alerts = alerts.filter(a => a.id !== alertId);
  return true;
};

export const createAlert = async (deviceId, deviceName, message, severity = 'Warning') => {
  const newAlert = {
    id: `ALT-${Math.floor(Math.random() * 10000)}`,
    deviceId,
    deviceName,
    severity, // 'Info', 'Warning', 'Critical'
    message,
    timestamp: new Date().toISOString(),
    acknowledged: false
  };
  
  alerts.unshift(newAlert); // Add to beginning
  return newAlert;
};
