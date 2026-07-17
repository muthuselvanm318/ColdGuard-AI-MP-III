/**
 * deviceService.js
 * 
 * Manages device-related operations.
 * Will connect to real IoT backend eventually.
 */

import { MOCK_DEVICES, generateTimeSeriesData } from './mockData';

// In-memory mock store
let devices = [...MOCK_DEVICES];
let deviceHistories = {};

// Initialize mock histories for existing devices
devices.forEach(d => {
  deviceHistories[d.id] = generateTimeSeriesData(d.currentTemp, 6, 1.2); // 6 hours of data
});

export const getDevices = async () => {
  // Simulate network
  return [...devices];
};

export const getDeviceById = async (id) => {
  return devices.find(d => d.id === id) || null;
};

export const addDevice = async (deviceData) => {
  const newDevice = {
    ...deviceData,
    id: `DEV-${Math.floor(Math.random() * 1000).toString().padStart(3, '0')}`,
    status: 'online',
    batteryLevel: 100,
    lastSeen: new Date().toISOString(),
    currentTemp: deviceData.targetTemp || 4.0,
  };
  
  devices.push(newDevice);
  deviceHistories[newDevice.id] = generateTimeSeriesData(newDevice.currentTemp, 1, 0.5);
  
  return newDevice;
};

export const removeDevice = async (id) => {
  devices = devices.filter(d => d.id !== id);
  delete deviceHistories[id];
  return true;
};

export const getDeviceHistory = async (id) => {
  return deviceHistories[id] || [];
};

// Internal function for the simulation hook to update temps
export const _updateDeviceTemp = (id, newTemp) => {
  const device = devices.find(d => d.id === id);
  if (device) {
    device.currentTemp = parseFloat(newTemp.toFixed(1));
    device.lastSeen = new Date().toISOString();
    
    // Update history array (keep last 6 hours = 72 * 5min intervals)
    if (!deviceHistories[id]) {
        deviceHistories[id] = [];
    }
    
    const now = new Date();
    deviceHistories[id].push({
      time: now.toISOString(),
      timestamp: now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temp: device.currentTemp
    });
    
    if (deviceHistories[id].length > 72) {
      deviceHistories[id].shift();
    }
  }
};
