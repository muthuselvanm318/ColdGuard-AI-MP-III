-- ============================================================
-- ColdGuard AI - Database Schema v2 (MySQL)
-- ML & Live Predictions Integration
-- ============================================================

CREATE DATABASE IF NOT EXISTS coldguard_ai;
USE coldguard_ai;

-- 1. milk_products Table
CREATE TABLE IF NOT EXISTS milk_products (
    id INT AUTO_INCREMENT PRIMARY KEY,
    milk_id VARCHAR(50) NOT NULL UNIQUE,
    product_name VARCHAR(100) NOT NULL UNIQUE,
    milk_type VARCHAR(50) NOT NULL,
    storage_start_time DATETIME NOT NULL,
    expiry_time DATETIME NOT NULL,
    device_id VARCHAR(50) NULL,
    status ENUM('SAFE', 'CAUTION', 'UNSAFE') NOT NULL DEFAULT 'SAFE',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 2. devices Table
CREATE TABLE IF NOT EXISTS devices (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL UNIQUE,
    device_name VARCHAR(100) NOT NULL UNIQUE,
    sensor_type VARCHAR(50) NOT NULL,
    location VARCHAR(100) NOT NULL,
    status ENUM('ONLINE', 'OFFLINE', 'WARNING', 'ERROR') NOT NULL DEFAULT 'ONLINE',
    last_temperature DECIMAL(5, 2) NULL,
    last_seen DATETIME DEFAULT CURRENT_TIMESTAMP,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- 3. temperature_readings Table
CREATE TABLE IF NOT EXISTS temperature_readings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    device_id VARCHAR(50) NOT NULL,
    milk_id VARCHAR(50) NOT NULL,
    temperature_c DECIMAL(5, 2) NOT NULL,
    recorded_at DATETIME NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast querying on temperature_readings
CREATE INDEX idx_temp_device ON temperature_readings(device_id);
CREATE INDEX idx_temp_milk ON temperature_readings(milk_id);
CREATE INDEX idx_temp_recorded ON temperature_readings(recorded_at);

-- 4. predictions Table
CREATE TABLE IF NOT EXISTS predictions (
    id INT AUTO_INCREMENT PRIMARY KEY,
    milk_id VARCHAR(50) NOT NULL,
    device_id VARCHAR(50) NOT NULL,
    prediction_time DATETIME NOT NULL,
    current_temperature_c DECIMAL(5, 2) NOT NULL,
    remaining_shelf_life_hours DECIMAL(6, 2) NOT NULL,
    safety_status ENUM('SAFE', 'CAUTION', 'UNSAFE') NOT NULL,
    safe_probability DECIMAL(5, 4) NOT NULL,
    caution_probability DECIMAL(5, 4) NOT NULL,
    unsafe_probability DECIMAL(5, 4) NOT NULL,
    model_version VARCHAR(50) NOT NULL,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Indexes for fast querying on predictions
CREATE INDEX idx_pred_milk ON predictions(milk_id);
CREATE INDEX idx_pred_device ON predictions(device_id);
CREATE INDEX idx_pred_time ON predictions(prediction_time);

-- Note: The User requested specific tables without explicit FOREIGN KEY constraints 
-- in the DDL (only mentioned relationships in doc). We will rely on application logic 
-- for consistency or add explicit foreign keys below if needed.
-- We can add them:
ALTER TABLE temperature_readings
    ADD CONSTRAINT fk_temp_device FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_temp_milk FOREIGN KEY (milk_id) REFERENCES milk_products(milk_id) ON DELETE CASCADE;

ALTER TABLE predictions
    ADD CONSTRAINT fk_pred_device FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE CASCADE,
    ADD CONSTRAINT fk_pred_milk FOREIGN KEY (milk_id) REFERENCES milk_products(milk_id) ON DELETE CASCADE;

-- 5. system_settings Table (Singleton)
CREATE TABLE IF NOT EXISTS system_settings (
    id INT AUTO_INCREMENT PRIMARY KEY,
    recommended_temperature DECIMAL(5, 2) NOT NULL DEFAULT 4.0,
    maximum_temperature DECIMAL(5, 2) NOT NULL DEFAULT 5.0,
    warning_temperature DECIMAL(5, 2) NOT NULL DEFAULT 7.0,
    critical_temperature DECIMAL(5, 2) NOT NULL DEFAULT 10.0,
    monitoring_interval_minutes INT NOT NULL DEFAULT 1,
    temperature_history_hours INT NOT NULL DEFAULT 24,
    excursion_duration_minutes INT NOT NULL DEFAULT 30,
    prediction_frequency VARCHAR(50) NOT NULL DEFAULT 'Automatically',
    minimum_prediction_confidence INT NOT NULL DEFAULT 70,
    temperature_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    prediction_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    shelf_life_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    sensor_offline_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    data_delay_alert_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    alert_cooldown_minutes INT NOT NULL DEFAULT 30,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);
