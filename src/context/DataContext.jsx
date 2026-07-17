import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { getDevices, _updateDeviceTemp } from '../services/deviceService';
import { MOCK_PRODUCTS } from '../services/mockData';
import { getAlerts, createAlert } from '../services/alertService';

const DataContext = createContext();

export const DataProvider = ({ children }) => {
  const [devices, setDevices] = useState([]);
  const [products, setProducts] = useState([...MOCK_PRODUCTS]);
  const [alerts, setAlerts] = useState([]);
  const [isLoading, setIsLoading] = useState(true);

  // Initial load
  useEffect(() => {
    const loadData = async () => {
      const devs = await getDevices();
      const alts = await getAlerts();
      setDevices(devs);
      setAlerts(alts);
      setIsLoading(false);
    };
    loadData();
  }, []);

  // Simulator: Update temperatures periodically
  useEffect(() => {
    if (isLoading) return;

    const interval = setInterval(() => {
      setDevices(prevDevices => 
        prevDevices.map(device => {
          if (device.status === 'offline') return device;

          // Random walk for temperature (-0.2 to +0.2 change)
          const change = (Math.random() - 0.5) * 0.4;
          const newTemp = parseFloat((device.currentTemp + change).toFixed(1));
          
          // Update internal mock history
          _updateDeviceTemp(device.id, newTemp);

          // Check for breaches and create alerts
          if (newTemp > device.targetTemp + 3) {
            // Check if we recently alerted for this device to avoid spam
            setAlerts(prev => {
               const recentAlert = prev.find(a => a.deviceId === device.id && (new Date() - new Date(a.timestamp) < 60000));
               if (!recentAlert) {
                  const newAlert = {
                      id: `ALT-${Date.now()}`,
                      deviceId: device.id,
                      deviceName: device.name,
                      severity: 'Critical',
                      message: `Temperature breached upper threshold (${newTemp}°C > ${device.targetTemp + 2}°C)`,
                      timestamp: new Date().toISOString(),
                      acknowledged: false
                  };
                  return [newAlert, ...prev];
               }
               return prev;
            });
          }

          return {
            ...device,
            currentTemp: newTemp,
            lastSeen: new Date().toISOString()
          };
        })
      );
    }, 5000); // Update every 5 seconds

    return () => clearInterval(interval);
  }, [isLoading]);

  // Actions
  const updateProduct = useCallback((id, updates) => {
    setProducts(prev => prev.map(p => p.id === id ? { ...p, ...updates } : p));
  }, []);

  const value = {
    devices,
    products,
    alerts,
    setAlerts,
    updateProduct,
    isLoading
  };

  return (
    <DataContext.Provider value={value}>
      {children}
    </DataContext.Provider>
  );
};

export const useData = () => {
  const context = useContext(DataContext);
  if (!context) {
    throw new Error('useData must be used within a DataProvider');
  }
  return context;
};
