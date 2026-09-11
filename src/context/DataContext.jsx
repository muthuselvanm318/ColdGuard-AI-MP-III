import React, { createContext, useContext, useState, useEffect } from 'react';
import { getProducts } from '../api/productsApi';
import { getDevices } from '../api/devicesApi';

const DataContext = createContext();

export function DataProvider({ children }) {
  const [userRole, setUserRole] = useState('ADMIN');
  
  // We fetch global minimal state here if needed, but components will fetch their own specific data.
  const [alerts, setAlerts] = useState([]);
  const [notifications, setNotifications] = useState([]);

  // Mock global alerts for now since the backend doesn't have an alert API yet.
  // The user requested to hide sections if there is no API, so we will leave these empty.

  return (
    <DataContext.Provider value={{
      userRole,
      setUserRole,
      alerts,
      notifications
    }}>
      {children}
    </DataContext.Provider>
  );
}

export function useData() {
  return useContext(DataContext);
}
