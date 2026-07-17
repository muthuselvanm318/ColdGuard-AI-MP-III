import { useState, useEffect } from 'react';
import { getDeviceHistory } from '../services/deviceService';
import { useData } from '../context/DataContext';

/**
 * Custom hook to subscribe to a device's temperature stream and history
 */
export const useTemperatureStream = (deviceId) => {
  const { devices } = useData();
  const [history, setHistory] = useState([]);
  
  const device = devices.find(d => d.id === deviceId);

  // Poll history (since it's updated internally by the simulator in deviceService)
  useEffect(() => {
    if (!deviceId) return;

    const fetchHistory = async () => {
      const data = await getDeviceHistory(deviceId);
      setHistory([...data]); // clone to trigger re-render if needed
    };

    fetchHistory();

    // Poll every 5s to stay in sync with the simulator
    const interval = setInterval(fetchHistory, 5000);
    return () => clearInterval(interval);
  }, [deviceId, device?.currentTemp]); // Re-fetch when currentTemp changes

  return {
    currentTemp: device?.currentTemp,
    status: device?.status,
    history,
    targetTemp: device?.targetTemp
  };
};
