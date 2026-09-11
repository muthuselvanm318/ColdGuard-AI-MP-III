-- ============================================================
-- ColdGuard AI - Database Schema Definition
-- Cold-Chain Monitoring & Refrigerated Food Safety
-- ============================================================

CREATE DATABASE IF NOT EXISTS coldguard_ai;
USE coldguard_ai;

-- 1. Users Table (Role-Based Access Control)
CREATE TABLE IF NOT EXISTS users (
    id INT AUTO_INCREMENT PRIMARY KEY,
    user_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    email VARCHAR(100) NOT NULL UNIQUE,
    role ENUM('ADMIN', 'OPERATOR', 'QUALITY_MANAGER', 'VIEWER') NOT NULL DEFAULT 'VIEWER',
    status ENUM('ACTIVE', 'INACTIVE') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 2. Refrigerators Table
CREATE TABLE IF NOT EXISTS refrigerators (
    id INT AUTO_INCREMENT PRIMARY KEY,
    ref_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    location VARCHAR(100) NOT NULL,
    type VARCHAR(50) NOT NULL DEFAULT 'Walk-in Cooler',
    capacity_l DECIMAL(10, 2) NOT NULL DEFAULT 500.00,
    status ENUM('HEALTHY', 'WARNING', 'CRITICAL', 'OFFLINE') NOT NULL DEFAULT 'HEALTHY',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 3. IoT Devices Table (ESP32 Sensor Nodes)
CREATE TABLE IF NOT EXISTS iot_devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_code VARCHAR(50) NOT NULL UNIQUE,
    device_name VARCHAR(100) NOT NULL,
    sensor_type VARCHAR(50) NOT NULL DEFAULT 'DS18B20',
    refrigerator_id INT NULL,
    location VARCHAR(100) NOT NULL,
    status ENUM('ONLINE', 'OFFLINE', 'WARNING', 'ERROR') NOT NULL DEFAULT 'ONLINE',
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    ip_address VARCHAR(45) DEFAULT '192.168.1.100',
    firmware_version VARCHAR(20) DEFAULT 'v1.0.4',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (refrigerator_id) REFERENCES refrigerators(id) ON DELETE SET NULL
);

-- 4. Food Products Table (Pasteurized Whole Milk & future products)
CREATE TABLE IF NOT EXISTS products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_code VARCHAR(50) NOT NULL UNIQUE,
    name VARCHAR(100) NOT NULL,
    product_type VARCHAR(50) NOT NULL DEFAULT 'Dairy',
    batch_id VARCHAR(50) NOT NULL,
    manufacturing_date DATE NOT NULL,
    expiry_date DATE NOT NULL,
    storage_start_date DATETIME NOT NULL,
    initial_shelf_life_days INT NOT NULL DEFAULT 7,
    refrigerator_id INT NULL,
    device_id INT NULL,
    current_temperature_c DECIMAL(5, 2) NULL,
    status ENUM('SAFE', 'CAUTION', 'UNSAFE') NOT NULL DEFAULT 'SAFE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
    FOREIGN KEY (refrigerator_id) REFERENCES refrigerators(id) ON DELETE SET NULL,
    FOREIGN KEY (device_id) REFERENCES iot_devices(id) ON DELETE SET NULL
);

-- 5. Temperature Readings Table (Historical IoT Stream)
CREATE TABLE IF NOT EXISTS temperature_readings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    refrigerator_id VARCHAR(50) NULL,
    product_id VARCHAR(50) NULL,
    temperature_c DECIMAL(5, 2) NOT NULL,
    timestamp DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 6. Alerts Table (Threshold breaches & hardware warnings)
CREATE TABLE IF NOT EXISTS alerts (
    id INT AUTO_INCREMENT PRIMARY KEY,
    alert_code VARCHAR(50) NOT NULL UNIQUE,
    type ENUM(
        'HIGH_TEMPERATURE',
        'LOW_TEMPERATURE',
        'TEMPERATURE_EXCURSION',
        'DEVICE_OFFLINE',
        'SENSOR_ERROR',
        'LOW_SHELF_LIFE',
        'SAFETY_WARNING',
        'SAFETY_CRITICAL'
    ) NOT NULL,
    severity ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL,
    product_id VARCHAR(50) NULL,
    device_id VARCHAR(50) NULL,
    refrigerator_id VARCHAR(50) NULL,
    temperature_c DECIMAL(5, 2) NULL,
    message TEXT NOT NULL,
    status ENUM('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL DEFAULT 'ACTIVE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    acknowledged_at DATETIME NULL,
    resolved_at DATETIME NULL
);

-- 7. Notifications Table
CREATE TABLE IF NOT EXISTS notifications (
    id INT AUTO_INCREMENT PRIMARY KEY,
    title VARCHAR(150) NOT NULL,
    message TEXT NOT NULL,
    category ENUM('ALERT', 'DEVICE', 'SYSTEM', 'UNREAD') NOT NULL DEFAULT 'ALERT',
    severity ENUM('INFO', 'WARNING', 'CRITICAL') NOT NULL DEFAULT 'INFO',
    read_status BOOLEAN NOT NULL DEFAULT FALSE,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 8. Safety Thresholds Table (Dynamic Settings)
CREATE TABLE IF NOT EXISTS safety_thresholds (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_type VARCHAR(50) NOT NULL UNIQUE,
    recommended_min_c DECIMAL(5, 2) NOT NULL DEFAULT 0.00,
    recommended_max_c DECIMAL(5, 2) NOT NULL DEFAULT 4.00,
    warning_threshold_c DECIMAL(5, 2) NOT NULL DEFAULT 5.00,
    critical_threshold_c DECIMAL(5, 2) NOT NULL DEFAULT 8.00,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- 9. Predictions Table (Placeholder for Future ML Safety Model)
CREATE TABLE IF NOT EXISTS predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    device_id VARCHAR(50) NOT NULL,
    prediction_type ENUM('SAFETY', 'SHELF_LIFE') NOT NULL,
    status ENUM('SAFE', 'CAUTION', 'UNSAFE') NULL,
    probability DECIMAL(5, 4) NULL,
    model_version VARCHAR(20) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 10. Future Shelf-Life Predictions Table (Placeholder for Future ML Shelf-Life Model)
CREATE TABLE IF NOT EXISTS future_shelf_life_predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    product_id VARCHAR(50) NOT NULL,
    remaining_hours INT NULL,
    risk_level ENUM('LOW', 'MEDIUM', 'HIGH', 'CRITICAL') NULL,
    model_version VARCHAR(20) NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);
