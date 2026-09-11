import express from 'express';
import cors from 'cors';

const app = express();
const PORT = process.env.PORT || 5001;

app.use(cors());
app.use(express.json());

// In-Memory Production Foundation Database Store (mirrors DB schema)
let db = {
  users: [
    { id: '1', user_code: 'USR-001', name: 'System Administrator', email: 'admin@coldguard.ai', role: 'ADMIN', status: 'ACTIVE', created_at: new Date().toISOString() },
    { id: '2', user_code: 'USR-002', name: 'Cold Chain Operator', email: 'operator@coldguard.ai', role: 'OPERATOR', status: 'ACTIVE', created_at: new Date().toISOString() },
    { id: '3', user_code: 'USR-003', name: 'Quality Assurance Manager', email: 'quality@coldguard.ai', role: 'QUALITY_MANAGER', status: 'ACTIVE', created_at: new Date().toISOString() },
    { id: '4', user_code: 'USR-004', name: 'Auditor Visitor', email: 'viewer@coldguard.ai', role: 'VIEWER', status: 'ACTIVE', created_at: new Date().toISOString() }
  ],
  refrigerators: [
    { id: '1', ref_code: 'REF-001', name: 'Main Dairy Walk-in Cooler A', location: 'Facility Bay 1', type: 'Walk-in Commercial Refrigerator', capacity_l: 1200, status: 'HEALTHY', assigned_device: 'ESP32-001', assigned_product: 'MILK-001', created_at: new Date().toISOString() },
    { id: '2', ref_code: 'REF-002', name: 'Secondary Storage Unit B', location: 'Facility Bay 2', type: 'Reach-in Refrigerator', capacity_l: 600, status: 'WARNING', assigned_device: 'ESP32-002', assigned_product: 'MILK-002', created_at: new Date().toISOString() },
    { id: '3', ref_code: 'REF-003', name: 'Deep Freeze Reserve C', location: 'Cold Storage Room 3', type: 'Industrial Freezer', capacity_l: 2500, status: 'CRITICAL', assigned_device: 'ESP32-003', assigned_product: 'MILK-003', created_at: new Date().toISOString() }
  ],
  devices: [
    { id: '1', device_code: 'ESP32-001', device_name: 'Dairy Bay Node 1 (DS18B20)', sensor_type: 'DS18B20', refrigerator_id: 'REF-001', location: 'Facility Bay 1', status: 'ONLINE', last_seen: new Date().toISOString(), ip_address: '192.168.1.101', firmware_version: 'v1.4.2' },
    { id: '2', device_code: 'ESP32-002', device_name: 'Storage Unit Node 2 (DS18B20)', sensor_type: 'DS18B20', refrigerator_id: 'REF-002', location: 'Facility Bay 2', status: 'ONLINE', last_seen: new Date().toISOString(), ip_address: '192.168.1.102', firmware_version: 'v1.4.2' },
    { id: '3', device_code: 'ESP32-003', device_name: 'Freezer Node 3 (DS18B20)', sensor_type: 'DS18B20', refrigerator_id: 'REF-003', location: 'Cold Storage Room 3', status: 'OFFLINE', last_seen: new Date(Date.now() - 4 * 3600 * 1000).toISOString(), ip_address: '192.168.1.103', firmware_version: 'v1.4.0' }
  ],
  products: [
    {
      id: '1',
      product_code: 'MILK-001',
      name: 'Pasteurized Whole Milk (1L Container)',
      product_type: 'Pasteurized Whole Milk',
      batch_id: 'BATCH-2026-08A',
      manufacturing_date: '2026-08-24',
      expiry_date: '2026-08-31',
      storage_start_date: '2026-08-24T10:00:00.000Z',
      initial_shelf_life_days: 7,
      refrigerator_id: 'REF-001',
      device_id: 'ESP32-001',
      current_temperature_c: 4.2,
      status: 'SAFE',
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      product_code: 'MILK-002',
      name: 'Pasteurized Organic Whole Milk',
      product_type: 'Pasteurized Whole Milk',
      batch_id: 'BATCH-2026-08B',
      manufacturing_date: '2026-08-25',
      expiry_date: '2026-09-01',
      storage_start_date: '2026-08-25T08:30:00.000Z',
      initial_shelf_life_days: 7,
      refrigerator_id: 'REF-002',
      device_id: 'ESP32-002',
      current_temperature_c: 5.8,
      status: 'CAUTION',
      created_at: new Date().toISOString()
    },
    {
      id: '3',
      product_code: 'MILK-003',
      name: 'Low-Fat Fresh Milk (Bulk Batch)',
      product_type: 'Pasteurized Whole Milk',
      batch_id: 'BATCH-2026-07Z',
      manufacturing_date: '2026-08-20',
      expiry_date: '2026-08-27',
      storage_start_date: '2026-08-20T14:00:00.000Z',
      initial_shelf_life_days: 7,
      refrigerator_id: 'REF-003',
      device_id: 'ESP32-003',
      current_temperature_c: 9.1,
      status: 'UNSAFE',
      created_at: new Date().toISOString()
    }
  ],
  temperature_readings: [
    { id: '1', device_id: 'ESP32-001', refrigerator_id: 'REF-001', product_id: 'MILK-001', temperature_c: 3.8, timestamp: new Date(Date.now() - 24 * 3600 * 1000).toISOString() },
    { id: '2', device_id: 'ESP32-001', refrigerator_id: 'REF-001', product_id: 'MILK-001', temperature_c: 3.7, timestamp: new Date(Date.now() - 20 * 3600 * 1000).toISOString() },
    { id: '3', device_id: 'ESP32-001', refrigerator_id: 'REF-001', product_id: 'MILK-001', temperature_c: 3.9, timestamp: new Date(Date.now() - 16 * 3600 * 1000).toISOString() },
    { id: '4', device_id: 'ESP32-001', refrigerator_id: 'REF-001', product_id: 'MILK-001', temperature_c: 4.1, timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString() },
    { id: '5', device_id: 'ESP32-001', refrigerator_id: 'REF-001', product_id: 'MILK-001', temperature_c: 4.5, timestamp: new Date(Date.now() - 8 * 3600 * 1000).toISOString() },
    { id: '6', device_id: 'ESP32-001', refrigerator_id: 'REF-001', product_id: 'MILK-001', temperature_c: 4.3, timestamp: new Date(Date.now() - 4 * 3600 * 1000).toISOString() },
    { id: '7', device_id: 'ESP32-001', refrigerator_id: 'REF-001', product_id: 'MILK-001', temperature_c: 4.2, timestamp: new Date().toISOString() },
    { id: '8', device_id: 'ESP32-002', refrigerator_id: 'REF-002', product_id: 'MILK-002', temperature_c: 4.0, timestamp: new Date(Date.now() - 12 * 3600 * 1000).toISOString() },
    { id: '9', device_id: 'ESP32-002', refrigerator_id: 'REF-002', product_id: 'MILK-002', temperature_c: 5.2, timestamp: new Date(Date.now() - 6 * 3600 * 1000).toISOString() },
    { id: '10', device_id: 'ESP32-002', refrigerator_id: 'REF-002', product_id: 'MILK-002', temperature_c: 5.8, timestamp: new Date().toISOString() }
  ],
  alerts: [
    {
      id: '1',
      alert_code: 'ALT-1001',
      type: 'HIGH_TEMPERATURE',
      severity: 'WARNING',
      product_id: 'MILK-002',
      device_id: 'ESP32-002',
      refrigerator_id: 'REF-002',
      temperature_c: 5.8,
      message: 'Temperature breach detected: 5.8°C exceeds recommended maximum threshold (4.0°C).',
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    },
    {
      id: '2',
      alert_code: 'ALT-1002',
      type: 'TEMPERATURE_EXCURSION',
      severity: 'CRITICAL',
      product_id: 'MILK-003',
      device_id: 'ESP32-003',
      refrigerator_id: 'REF-003',
      temperature_c: 9.1,
      message: 'Critical temperature excursion: 9.1°C recorded in Deep Freeze Reserve C.',
      status: 'ACTIVE',
      created_at: new Date(Date.now() - 2 * 3600 * 1000).toISOString()
    },
    {
      id: '3',
      alert_code: 'ALT-1003',
      type: 'DEVICE_OFFLINE',
      severity: 'WARNING',
      product_id: null,
      device_id: 'ESP32-003',
      refrigerator_id: 'REF-003',
      temperature_c: null,
      message: 'IoT Sensor Node ESP32-003 failed to send heartbeat for > 4 hours.',
      status: 'ACKNOWLEDGED',
      created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString()
    }
  ],
  notifications: [
    { id: '1', title: 'Temperature Excursion Alert', message: 'MILK-002 recorded temperature of 5.8°C in Main Dairy Walk-in Cooler.', category: 'ALERT', severity: 'WARNING', read_status: false, created_at: new Date().toISOString() },
    { id: '2', title: 'Device Status Change', message: 'Sensor node ESP32-003 lost wireless heartbeat connection.', category: 'DEVICE', severity: 'WARNING', read_status: false, created_at: new Date(Date.now() - 3 * 3600 * 1000).toISOString() },
    { id: '3', title: 'System Database Initialized', message: 'ColdGuard AI REST API and hardware ingestion pipeline operational.', category: 'SYSTEM', severity: 'INFO', read_status: true, created_at: new Date(Date.now() - 24 * 3600 * 1000).toISOString() }
  ],
  settings: {
    recommended_min_c: 0.0,
    recommended_max_c: 4.0,
    warning_threshold_c: 5.0,
    critical_threshold_c: 8.0,
    system_name: 'ColdGuard AI Platform',
    product_category: 'Pasteurized Whole Milk',
    polling_interval_seconds: 5
  }
};

// Helper: Threshold Check & Alert Generation
function checkTemperatureThresholds(deviceId, refId, productId, tempC) {
  const settings = db.settings;
  let severity = null;
  let alertType = null;
  let statusCategory = 'SAFE';

  if (tempC >= settings.critical_threshold_c) {
    severity = 'CRITICAL';
    alertType = 'SAFETY_CRITICAL';
    statusCategory = 'UNSAFE';
  } else if (tempC >= settings.warning_threshold_c) {
    severity = 'WARNING';
    alertType = 'HIGH_TEMPERATURE';
    statusCategory = 'CAUTION';
  } else if (tempC < settings.recommended_min_c) {
    severity = 'WARNING';
    alertType = 'LOW_TEMPERATURE';
    statusCategory = 'CAUTION';
  }

  // Update product current temperature and status
  if (productId) {
    const prodIndex = db.products.findIndex(p => p.product_code === productId || p.id === productId);
    if (prodIndex !== -1) {
      db.products[prodIndex].current_temperature_c = tempC;
      db.products[prodIndex].status = statusCategory;
    }
  }

  // Create alert if breach detected
  if (severity) {
    const newAlert = {
      id: String(db.alerts.length + 1),
      alert_code: `ALT-${1000 + db.alerts.length + 1}`,
      type: alertType,
      severity,
      product_id: productId || 'UNASSIGNED',
      device_id: deviceId,
      refrigerator_id: refId || 'UNASSIGNED',
      temperature_c: tempC,
      message: `Automatic alert: Temperature reading ${tempC}°C triggered threshold rule (${severity}).`,
      status: 'ACTIVE',
      created_at: new Date().toISOString()
    };
    db.alerts.unshift(newAlert);
    db.notifications.unshift({
      id: String(db.notifications.length + 1),
      title: `${alertType.replace('_', ' ')} Alert`,
      message: newAlert.message,
      category: 'ALERT',
      severity,
      read_status: false,
      created_at: new Date().toISOString()
    });
  }
}

// -------------------------------------------------------------
// REST API ENDPOINTS
// -------------------------------------------------------------

// Health Check
app.get('/api/health', (req, res) => {
  res.json({ success: true, service: 'ColdGuard AI REST API', status: 'ONLINE', timestamp: new Date().toISOString() });
});

// Auth endpoints
app.post('/api/auth/login', (req, res) => {
  const { email, role } = req.body;
  const user = db.users.find(u => u.email === email) || {
    id: 'usr_guest',
    user_code: 'USR-999',
    name: 'Authenticated User',
    email: email || 'user@coldguard.ai',
    role: role || 'ADMIN',
    status: 'ACTIVE'
  };
  res.json({ success: true, token: 'mock-jwt-token-coldguard', user });
});

app.get('/api/auth/me', (req, res) => {
  res.json({ success: true, user: db.users[0] });
});

// Dashboard Aggregation
app.get('/api/dashboard', (req, res) => {
  const totalProducts = db.products.length;
  const activeRefrigerators = db.refrigerators.filter(r => r.status !== 'OFFLINE').length;
  const onlineDevices = db.devices.filter(d => d.status === 'ONLINE').length;
  const offlineDevices = db.devices.filter(d => d.status === 'OFFLINE').length;
  const currentAlerts = db.alerts.filter(a => a.status === 'ACTIVE').length;
  const productsMonitored = db.products.filter(p => p.status === 'SAFE' || p.status === 'CAUTION').length;

  const temps = db.temperature_readings.map(r => r.temperature_c);
  const currentTemp = temps.length ? temps[temps.length - 1] : 4.2;
  const avgTemp = temps.length ? +(temps.reduce((a, b) => a + b, 0) / temps.length).toFixed(1) : 4.2;
  const maxTemp = temps.length ? Math.max(...temps) : 4.2;
  const minTemp = temps.length ? Math.min(...temps) : 4.2;

  res.json({
    success: true,
    summary: {
      totalProducts,
      activeRefrigerators,
      onlineDevices,
      offlineDevices,
      currentAlerts,
      productsMonitored
    },
    temperatureSummary: {
      current: currentTemp,
      average: avgTemp,
      maximum: maxTemp,
      minimum: minTemp
    },
    foodStatusSummary: {
      SAFE: db.products.filter(p => p.status === 'SAFE').length,
      CAUTION: db.products.filter(p => p.status === 'CAUTION').length,
      UNSAFE: db.products.filter(p => p.status === 'UNSAFE').length
    },
    mlStatus: {
      available: false,
      message: 'AI prediction model not available'
    }
  });
});

// Products CRUD
app.get('/api/products', (req, res) => {
  res.json({ success: true, count: db.products.length, data: db.products });
});

app.get('/api/products/:id', (req, res) => {
  const item = db.products.find(p => p.id === req.params.id || p.product_code === req.params.id);
  if (!item) return res.status(404).json({ success: false, error: 'Product not found' });
  
  const history = db.temperature_readings.filter(r => r.product_id === item.product_code || r.product_id === item.id);
  const productAlerts = db.alerts.filter(a => a.product_id === item.product_code || a.product_id === item.id);
  
  res.json({
    success: true,
    data: item,
    temperature_history: history,
    alerts: productAlerts,
    ml_safety_status: { available: false, text: 'ML prediction not available' },
    ml_shelf_life: { available: false, text: 'Shelf-life prediction unavailable' }
  });
});

app.post('/api/products', (req, res) => {
  const newId = String(db.products.length + 1);
  const newProduct = {
    id: newId,
    product_code: req.body.product_code || `PROD-${100 + Number(newId)}`,
    name: req.body.name || 'Pasteurized Whole Milk',
    product_type: req.body.product_type || 'Pasteurized Whole Milk',
    batch_id: req.body.batch_id || `BATCH-${Date.now()}`,
    manufacturing_date: req.body.manufacturing_date || new Date().toISOString().split('T')[0],
    expiry_date: req.body.expiry_date || new Date(Date.now() + 7 * 86400000).toISOString().split('T')[0],
    storage_start_date: req.body.storage_start_date || new Date().toISOString(),
    initial_shelf_life_days: Number(req.body.initial_shelf_life_days) || 7,
    refrigerator_id: req.body.refrigerator_id || 'REF-001',
    device_id: req.body.device_id || 'ESP32-001',
    current_temperature_c: Number(req.body.current_temperature_c) || 4.0,
    status: 'SAFE',
    created_at: new Date().toISOString()
  };
  db.products.push(newProduct);
  res.status(201).json({ success: true, message: 'Product registered successfully', data: newProduct });
});

app.put('/api/products/:id', (req, res) => {
  const idx = db.products.findIndex(p => p.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Product not found' });
  db.products[idx] = { ...db.products[idx], ...req.body, updated_at: new Date().toISOString() };
  res.json({ success: true, message: 'Product updated successfully', data: db.products[idx] });
});

app.delete('/api/products/:id', (req, res) => {
  db.products = db.products.filter(p => p.id !== req.params.id);
  res.json({ success: true, message: 'Product removed' });
});

// Refrigerators CRUD
app.get('/api/refrigerators', (req, res) => {
  res.json({ success: true, count: db.refrigerators.length, data: db.refrigerators });
});

app.get('/api/refrigerators/:id', (req, res) => {
  const item = db.refrigerators.find(r => r.id === req.params.id || r.ref_code === req.params.id);
  if (!item) return res.status(404).json({ success: false, error: 'Refrigerator not found' });
  res.json({ success: true, data: item });
});

app.post('/api/refrigerators', (req, res) => {
  const newId = String(db.refrigerators.length + 1);
  const newRef = {
    id: newId,
    ref_code: req.body.ref_code || `REF-00${newId}`,
    name: req.body.name,
    location: req.body.location || 'Storage Bay',
    type: req.body.type || 'Commercial Walk-in Cooler',
    capacity_l: Number(req.body.capacity_l) || 500,
    status: req.body.status || 'HEALTHY',
    assigned_device: req.body.assigned_device || 'None',
    assigned_product: req.body.assigned_product || 'None',
    created_at: new Date().toISOString()
  };
  db.refrigerators.push(newRef);
  res.status(201).json({ success: true, data: newRef });
});

app.put('/api/refrigerators/:id', (req, res) => {
  const idx = db.refrigerators.findIndex(r => r.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Refrigerator not found' });
  db.refrigerators[idx] = { ...db.refrigerators[idx], ...req.body };
  res.json({ success: true, data: db.refrigerators[idx] });
});

app.delete('/api/refrigerators/:id', (req, res) => {
  db.refrigerators = db.refrigerators.filter(r => r.id !== req.params.id);
  res.json({ success: true, message: 'Refrigerator deleted' });
});

// Devices CRUD
app.get('/api/devices', (req, res) => {
  res.json({ success: true, count: db.devices.length, data: db.devices });
});

app.get('/api/devices/:id', (req, res) => {
  const dev = db.devices.find(d => d.id === req.params.id || d.device_code === req.params.id);
  if (!dev) return res.status(404).json({ success: false, error: 'Device not found' });
  res.json({ success: true, data: dev });
});

app.post('/api/devices', (req, res) => {
  const newId = String(db.devices.length + 1);
  const newDev = {
    id: newId,
    device_code: req.body.device_code || `ESP32-00${newId}`,
    device_name: req.body.device_name || 'ESP32 Node',
    sensor_type: req.body.sensor_type || 'DS18B20',
    refrigerator_id: req.body.refrigerator_id || 'REF-001',
    location: req.body.location || 'Facility Bay',
    status: 'ONLINE',
    last_seen: new Date().toISOString(),
    ip_address: req.body.ip_address || '192.168.1.105',
    firmware_version: 'v1.4.2'
  };
  db.devices.push(newDev);
  res.status(201).json({ success: true, data: newDev });
});

app.put('/api/devices/:id', (req, res) => {
  const idx = db.devices.findIndex(d => d.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'Device not found' });
  db.devices[idx] = { ...db.devices[idx], ...req.body, last_seen: new Date().toISOString() };
  res.json({ success: true, data: db.devices[idx] });
});

app.delete('/api/devices/:id', (req, res) => {
  db.devices = db.devices.filter(d => d.id !== req.params.id);
  res.json({ success: true, message: 'Device deleted' });
});

// Temperature Readings API
app.get('/api/temperature', (req, res) => {
  const limit = Number(req.query.limit) || 50;
  res.json({
    success: true,
    data: db.temperature_readings.slice(-limit),
    thresholds: db.settings
  });
});

app.get('/api/temperature/:deviceId', (req, res) => {
  const devReadings = db.temperature_readings.filter(r => r.device_id === req.params.deviceId);
  res.json({ success: true, device_id: req.params.deviceId, data: devReadings });
});

// ESP32 IoT Ingestion API Endpoint (Hardware-Ready)
app.post('/api/iot/temperature', (req, res) => {
  const { device_id, temperature_c, timestamp, refrigerator_id, product_id } = req.body;

  if (!device_id || temperature_c === undefined) {
    return res.status(400).json({ success: false, error: 'Invalid payload. Missing device_id or temperature_c.' });
  }

  const devIndex = db.devices.findIndex(d => d.device_code === device_id || d.id === device_id);
  if (devIndex !== -1) {
    db.devices[devIndex].last_seen = new Date().toISOString();
    db.devices[devIndex].status = 'ONLINE';
  }

  const reading = {
    id: String(db.temperature_readings.length + 1),
    device_id,
    refrigerator_id: refrigerator_id || (devIndex !== -1 ? db.devices[devIndex].refrigerator_id : 'REF-001'),
    product_id: product_id || 'MILK-001',
    temperature_c: Number(temperature_c),
    timestamp: timestamp || new Date().toISOString()
  };

  db.temperature_readings.push(reading);

  // Trigger threshold check & alert generation
  checkTemperatureThresholds(reading.device_id, reading.refrigerator_id, reading.product_id, reading.temperature_c);

  res.json({
    success: true,
    message: 'Temperature recorded successfully',
    recorded: reading
  });
});

// Alerts API
app.get('/api/alerts', (req, res) => {
  res.json({ success: true, count: db.alerts.length, data: db.alerts });
});

app.put('/api/alerts/:id/acknowledge', (req, res) => {
  const alert = db.alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
  alert.status = 'ACKNOWLEDGED';
  alert.acknowledged_at = new Date().toISOString();
  res.json({ success: true, message: 'Alert acknowledged', data: alert });
});

app.put('/api/alerts/:id/resolve', (req, res) => {
  const alert = db.alerts.find(a => a.id === req.params.id);
  if (!alert) return res.status(404).json({ success: false, error: 'Alert not found' });
  alert.status = 'RESOLVED';
  alert.resolved_at = new Date().toISOString();
  res.json({ success: true, message: 'Alert resolved', data: alert });
});

// Analytics API
app.get('/api/analytics', (req, res) => {
  res.json({
    success: true,
    analytics: {
      temperature_history: db.temperature_readings,
      violations_count: db.alerts.filter(a => a.type === 'HIGH_TEMPERATURE' || a.type === 'TEMPERATURE_EXCURSION').length,
      alerts_over_time: db.alerts,
      device_uptime_pct: 98.4,
      products_monitored: db.products.length
    }
  });
});

// Reports API
app.get('/api/reports', (req, res) => {
  res.json({
    success: true,
    report: {
      title: 'ColdGuard AI Refrigerated Safety & Cold-Chain Summary',
      generated_at: new Date().toISOString(),
      products: db.products,
      refrigerators: db.refrigerators,
      devices: db.devices,
      alerts_summary: db.alerts
    }
  });
});

// Notifications API
app.get('/api/notifications', (req, res) => {
  res.json({ success: true, data: db.notifications });
});

app.put('/api/notifications/read', (req, res) => {
  db.notifications.forEach(n => n.read_status = true);
  res.json({ success: true, message: 'All notifications marked as read' });
});

// Settings API
app.get('/api/settings', (req, res) => {
  res.json({ success: true, data: db.settings });
});

app.put('/api/settings', (req, res) => {
  db.settings = { ...db.settings, ...req.body };
  res.json({ success: true, message: 'Settings updated successfully', data: db.settings });
});

// User Management API
app.get('/api/users', (req, res) => {
  res.json({ success: true, data: db.users });
});

app.post('/api/users', (req, res) => {
  const newUser = {
    id: String(db.users.length + 1),
    user_code: `USR-00${db.users.length + 1}`,
    name: req.body.name,
    email: req.body.email,
    role: req.body.role || 'OPERATOR',
    status: 'ACTIVE',
    created_at: new Date().toISOString()
  };
  db.users.push(newUser);
  res.status(201).json({ success: true, data: newUser });
});

app.put('/api/users/:id', (req, res) => {
  const idx = db.users.findIndex(u => u.id === req.params.id);
  if (idx === -1) return res.status(404).json({ success: false, error: 'User not found' });
  db.users[idx] = { ...db.users[idx], ...req.body };
  res.json({ success: true, data: db.users[idx] });
});

// -------------------------------------------------------------
// FUTURE ML CONTRACT ENDPOINTS (Strict Modular Placeholder)
// -------------------------------------------------------------
app.post('/ml/safety-predict', (req, res) => {
  res.json({
    available: false,
    code: 'ML_NOT_AVAILABLE',
    status_text: 'ML prediction not available',
    message: 'Machine learning model training and integration will be performed after dataset finalization.'
  });
});

app.post('/ml/shelf-life-predict', (req, res) => {
  res.json({
    available: false,
    code: 'ML_NOT_AVAILABLE',
    status_text: 'Shelf-life prediction unavailable',
    message: 'Shelf-life prediction model training is scheduled for future deployment phase.'
  });
});

// Start Server
app.listen(PORT, () => {
  console.log(`[ColdGuard AI] Production Backend REST Server running on port ${PORT}`);
});
