-- ============================================================
-- ColdGuard AI - Database Seed Script
-- Production-ready seed data for cold-chain monitoring
-- ============================================================

USE coldguard_ai;

-- Clear old records in clean order
DELETE FROM predictions;
DELETE FROM future_shelf_life_predictions;
DELETE FROM notifications;
DELETE FROM alerts;
DELETE FROM temperature_readings;
DELETE FROM products;
DELETE FROM iot_devices;
DELETE FROM refrigerators;
DELETE FROM users;
DELETE FROM safety_thresholds;

-- 1. Insert Initial Safety Thresholds
INSERT INTO safety_thresholds (product_type, recommended_min_c, recommended_max_c, warning_threshold_c, critical_threshold_c) VALUES
('Dairy', 0.00, 4.00, 5.00, 8.00),
('Pasteurized Whole Milk', 0.00, 4.00, 5.00, 8.00),
('Meat & Poultry', -2.00, 2.00, 3.50, 6.00),
('Seafood', -1.00, 2.00, 3.00, 5.00),
('Vaccines & Pharma', 2.00, 8.00, 9.00, 12.00);

-- 2. Insert Initial System Users
INSERT INTO users (id, user_code, name, email, role, status) VALUES
(1, 'USR-001', 'System Administrator', 'admin@coldguard.ai', 'ADMIN', 'ACTIVE'),
(2, 'USR-002', 'Cold Chain Operator', 'operator@coldguard.ai', 'OPERATOR', 'ACTIVE'),
(3, 'USR-003', 'Quality Assurance Manager', 'quality@coldguard.ai', 'QUALITY_MANAGER', 'ACTIVE'),
(4, 'USR-004', 'Auditor Visitor', 'viewer@coldguard.ai', 'VIEWER', 'ACTIVE');

-- 3. Insert Refrigerators
INSERT INTO refrigerators (id, ref_code, name, location, type, capacity_l, status) VALUES
(1, 'REF-001', 'Main Dairy Walk-in Cooler A', 'Facility Bay 1', 'Walk-in Commercial Refrigerator', 1200.00, 'HEALTHY'),
(2, 'REF-002', 'Secondary Storage Unit B', 'Facility Bay 2', 'Reach-in Refrigerator', 600.00, 'WARNING'),
(3, 'REF-003', 'Deep Freeze Reserve C', 'Cold Storage Room 3', 'Industrial Freezer', 2500.00, 'HEALTHY');

-- 4. Insert IoT Devices (ESP32 Nodes)
INSERT INTO iot_devices (id, device_code, device_name, sensor_type, refrigerator_id, location, status, last_seen, ip_address, firmware_version) VALUES
(1, 'ESP32-001', 'Dairy Bay Node 1 (DS18B20)', 'DS18B20', 1, 'Facility Bay 1', 'ONLINE', NOW(), '192.168.1.101', 'v1.4.2'),
(2, 'ESP32-002', 'Storage Unit Node 2 (DS18B20)', 'DS18B20', 2, 'Facility Bay 2', 'ONLINE', NOW(), '192.168.1.102', 'v1.4.2'),
(3, 'ESP32-003', 'Freezer Node 3 (DS18B20)', 'DS18B20', 3, 'Cold Storage Room 3', 'OFFLINE', DATE_SUB(NOW(), INTERVAL 4 HOUR), '192.168.1.103', 'v1.4.0');

-- 5. Insert Monitored Products (Primary Product: Pasteurized Whole Milk)
INSERT INTO products (id, product_code, name, product_type, batch_id, manufacturing_date, expiry_date, storage_start_date, initial_shelf_life_days, refrigerator_id, device_id, current_temperature_c, status) VALUES
(1, 'MILK-001', 'Pasteurized Whole Milk (1L Container)', 'Pasteurized Whole Milk', 'BATCH-2026-08A', '2026-08-24', '2026-08-31', DATE_SUB(NOW(), INTERVAL 2 DAY), 7, 1, 1, 4.20, 'SAFE'),
(2, 'MILK-002', 'Pasteurized Organic Whole Milk', 'Pasteurized Whole Milk', 'BATCH-2026-08B', '2026-08-25', '2026-09-01', DATE_SUB(NOW(), INTERVAL 1 DAY), 7, 2, 2, 5.80, 'CAUTION'),
(3, 'MILK-003', 'Low-Fat Fresh Milk (Bulk Batch)', 'Pasteurized Whole Milk', 'BATCH-2026-07Z', '2026-08-20', '2026-08-27', DATE_SUB(NOW(), INTERVAL 6 DAY), 7, 3, 3, 9.10, 'UNSAFE');

-- 6. Insert Temperature History Readings for ESP32-001 / MILK-001
INSERT INTO temperature_readings (device_id, refrigerator_id, product_id, temperature_c, timestamp) VALUES
('ESP32-001', 'REF-001', 'MILK-001', 3.80, DATE_SUB(NOW(), INTERVAL 24 HOUR)),
('ESP32-001', 'REF-001', 'MILK-001', 3.70, DATE_SUB(NOW(), INTERVAL 20 HOUR)),
('ESP32-001', 'REF-001', 'MILK-001', 3.90, DATE_SUB(NOW(), INTERVAL 16 HOUR)),
('ESP32-001', 'REF-001', 'MILK-001', 4.10, DATE_SUB(NOW(), INTERVAL 12 HOUR)),
('ESP32-001', 'REF-001', 'MILK-001', 4.50, DATE_SUB(NOW(), INTERVAL 8 HOUR)),
('ESP32-001', 'REF-001', 'MILK-001', 4.30, DATE_SUB(NOW(), INTERVAL 4 HOUR)),
('ESP32-001', 'REF-001', 'MILK-001', 4.20, NOW());

-- Readings for ESP32-002 / MILK-002
INSERT INTO temperature_readings (device_id, refrigerator_id, product_id, temperature_c, timestamp) VALUES
('ESP32-002', 'REF-002', 'MILK-002', 4.00, DATE_SUB(NOW(), INTERVAL 12 HOUR)),
('ESP32-002', 'REF-002', 'MILK-002', 5.20, DATE_SUB(NOW(), INTERVAL 6 HOUR)),
('ESP32-002', 'REF-002', 'MILK-002', 5.80, NOW());

-- 7. Insert Initial System Alerts
INSERT INTO alerts (id, alert_code, type, severity, product_id, device_id, refrigerator_id, temperature_c, message, status, created_at) VALUES
(1, 'ALT-1001', 'HIGH_TEMPERATURE', 'WARNING', 'MILK-002', 'ESP32-002', 'REF-002', 5.80, 'Temperature breach detected: 5.8°C exceeds recommended maximum threshold (4.0°C).', 'ACTIVE', NOW()),
(2, 'ALT-1002', 'TEMPERATURE_EXCURSION', 'CRITICAL', 'MILK-003', 'ESP32-003', 'REF-003', 9.10, 'Critical temperature excursion: 9.1°C recorded in Deep Freeze Reserve C.', 'ACTIVE', DATE_SUB(NOW(), INTERVAL 2 HOUR)),
(3, 'ALT-1003', 'DEVICE_OFFLINE', 'WARNING', NULL, 'ESP32-003', 'REF-003', NULL, 'IoT Sensor Node ESP32-003 failed to send heartbeat for > 4 hours.', 'ACKNOWLEDGED', DATE_SUB(NOW(), INTERVAL 3 HOUR));

-- 8. Insert System Notifications
INSERT INTO notifications (id, title, message, category, severity, read_status, created_at) VALUES
(1, 'Temperature Excursion Alert', 'MILK-002 recorded temperature of 5.8°C in Main Dairy Walk-in Cooler.', 'ALERT', 'WARNING', FALSE, NOW()),
(2, 'Device Status Change', 'Sensor node ESP32-003 lost wireless heartbeat connection.', 'DEVICE', 'WARNING', FALSE, DATE_SUB(NOW(), INTERVAL 3 HOUR)),
(3, 'System Database Initialized', 'ColdGuard AI REST API and local SQLite/MySQL data store active.', 'SYSTEM', 'INFO', TRUE, DATE_SUB(NOW(), INTERVAL 1 DAY));
