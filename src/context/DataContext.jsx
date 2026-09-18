import React, { createContext, useContext, useState, useEffect } from 'react';
import { getProducts } from '../api/productsApi';
import { getDevices } from '../api/devicesApi';
import { api } from '../api/client';

const DataContext = createContext();

export function DataProvider({ children }) {
  const [userRole, setUserRole] = useState('ADMIN');
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // FIX Issue 2: expose products, devices, temperatureReadings
  // so Analytics.jsx (and other pages) can get them from context
  const [products, setProducts] = useState([]);
  const [devices, setDevices] = useState([]);
  const [temperatureReadings, setTemperatureReadings] = useState([]);

  useEffect(() => {
    let mounted = true;

    async function loadGlobalData() {
      try {
        const [prods, devs] = await Promise.all([
          getProducts().catch(() => []),
          getDevices().catch(() => []),
        ]);
        if (!mounted) return;
        setProducts(prods || []);
        setDevices(devs  || []);

        // Fetch recent temperature readings (all, latest 200)
        try {
          const tempRes = await api.get('/api/temperature?limit=200');
          if (mounted) setTemperatureReadings(tempRes?.data || []);
        } catch {
          // temperature endpoint may not be available — leave as []
        }
      } catch {
        // Non-critical — individual pages fetch their own data too
      }
    }

    loadGlobalData();
    const iv = setInterval(loadGlobalData, 30000);
    return () => { mounted = false; clearInterval(iv); };
  }, []);

  return (
    <DataContext.Provider value={{
      userRole, setUserRole,
      alerts, notifications,
      // FIX: these were missing and caused Analytics to crash
      products, devices, temperatureReadings,
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
