// mockData.js - Generates realistic initial data

export const MOCK_DEVICES = [
  {
    id: 'DEV-001',
    name: 'Walk-in Chiller A',
    location: 'Main Warehouse',
    type: 'chiller',
    status: 'online',
    batteryLevel: 92,
    lastSeen: new Date().toISOString(),
    currentTemp: 3.2, // Celsius
    targetTemp: 4.0,
  },
  {
    id: 'DEV-002',
    name: 'Display Fridge Front',
    location: 'Retail Floor',
    type: 'fridge',
    status: 'online',
    batteryLevel: 85,
    lastSeen: new Date().toISOString(),
    currentTemp: 5.5,
    targetTemp: 4.0,
  },
  {
    id: 'DEV-003',
    name: 'Deep Freezer 1',
    location: 'Backroom',
    type: 'freezer',
    status: 'offline',
    batteryLevel: 0,
    lastSeen: new Date(Date.now() - 3600000 * 5).toISOString(),
    currentTemp: -12.0,
    targetTemp: -18.0,
  },
];

export const MOCK_PRODUCTS = [
  {
    id: 'PROD-101',
    name: 'Premium Wagyu Beef',
    category: 'meat',
    deviceId: 'DEV-001',
    storageDate: new Date(Date.now() - 3600000 * 48).toISOString(), // 2 days ago
    safetyScore: 95,
    riskLevel: 'Safe',
  },
  {
    id: 'PROD-102',
    name: 'Organic Milk',
    category: 'dairy',
    deviceId: 'DEV-002',
    storageDate: new Date(Date.now() - 3600000 * 12).toISOString(), // 12 hours ago
    safetyScore: 72,
    riskLevel: 'Caution',
  },
  {
    id: 'PROD-103',
    name: 'Frozen Strawberries',
    category: 'fruits',
    deviceId: 'DEV-003',
    storageDate: new Date(Date.now() - 3600000 * 120).toISOString(), // 5 days ago
    safetyScore: 45,
    riskLevel: 'Unsafe',
  },
];

export const MOCK_ALERTS = [
  {
    id: 'ALT-901',
    deviceId: 'DEV-003',
    deviceName: 'Deep Freezer 1',
    severity: 'Critical',
    message: 'Temperature breached upper threshold (-12°C > -15°C)',
    timestamp: new Date(Date.now() - 3600000 * 2).toISOString(),
    acknowledged: false,
  },
  {
    id: 'ALT-902',
    deviceId: 'DEV-002',
    deviceName: 'Display Fridge Front',
    severity: 'Warning',
    message: 'Temperature fluctuating above 5°C for 30 minutes',
    timestamp: new Date(Date.now() - 3600000 * 10).toISOString(),
    acknowledged: true,
  },
];

// Helper to generate a realistic temperature time series
export const generateTimeSeriesData = (baseTemp, hours, variance = 1.5) => {
  const data = [];
  const now = new Date();
  
  for (let i = hours * 12; i >= 0; i--) { // 5-minute intervals
    const time = new Date(now.getTime() - i * 5 * 60000);
    // Add some random noise and a slight sine wave pattern
    const noise = (Math.random() - 0.5) * variance;
    const diurnal = Math.sin((time.getHours() / 24) * Math.PI * 2) * (variance / 2);
    
    data.push({
      time: time.toISOString(),
      timestamp: time.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }),
      temp: parseFloat((baseTemp + noise + diurnal).toFixed(1))
    });
  }
  return data;
};
