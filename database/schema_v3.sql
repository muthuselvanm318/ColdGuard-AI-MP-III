-- ============================================================
-- ColdGuard AI — Database Schema v3 (MySQL)
-- Aligned with ML Pipeline v2.0 (Binary Safety Model)
-- ============================================================
--
-- WHAT CHANGED FROM v2 → v3:
--
--  1. milk_products.status
--     ENUM('SAFE','CAUTION','UNSAFE') → ENUM('SAFE','UNSAFE')
--     Model v2.0 is binary — CAUTION is no longer emitted.
--
--  2. predictions.safety_status
--     ENUM('SAFE','CAUTION','UNSAFE') → ENUM('SAFE','UNSAFE')
--
--  3. predictions.caution_probability
--     Kept for backward compatibility but DEFAULT 0.0000
--     (binary model always writes 0 here)
--
--  4. predictions — 5 new dashboard columns added:
--     alert_level, status_color, status_tag,
--     shelf_life_days, confidence
--
--  5. predictions.model_version DEFAULT changed to 'v2.0'
--
--  6. New table: prediction_alerts
--     Stores fired alerts so dashboard can display history.
--
--  TABLES NOT CHANGED:
--     devices, temperature_readings, system_settings
-- ============================================================

CREATE DATABASE IF NOT EXISTS coldguard_ai;
USE coldguard_ai;

-- ============================================================
-- 1. milk_products
--    CHANGED: status ENUM drops 'CAUTION'
-- ============================================================
CREATE TABLE IF NOT EXISTS milk_products (
    id                 INT AUTO_INCREMENT PRIMARY KEY,
    milk_id            VARCHAR(50)  NOT NULL UNIQUE,
    product_name       VARCHAR(100) NOT NULL UNIQUE,
    milk_type          VARCHAR(50)  NOT NULL,
    storage_start_time DATETIME     NOT NULL,
    expiry_time        DATETIME     NOT NULL,
    device_id          VARCHAR(50)  NULL,
    -- v3: CAUTION removed (binary model only emits SAFE / UNSAFE)
    status             ENUM('SAFE', 'UNSAFE') NOT NULL DEFAULT 'SAFE',
    created_at         DATETIME     DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 2. devices  (unchanged from v2)
-- ============================================================
CREATE TABLE IF NOT EXISTS devices (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    device_id        VARCHAR(50)  NOT NULL UNIQUE,
    device_name      VARCHAR(100) NOT NULL UNIQUE,
    sensor_type      VARCHAR(50)  NOT NULL,
    location         VARCHAR(100) NOT NULL,
    status           ENUM('ONLINE', 'OFFLINE', 'WARNING', 'ERROR') NOT NULL DEFAULT 'ONLINE',
    last_temperature DECIMAL(5, 2) NULL,
    last_seen        DATETIME      DEFAULT CURRENT_TIMESTAMP,
    created_at       DATETIME      DEFAULT CURRENT_TIMESTAMP
);

-- ============================================================
-- 3. temperature_readings  (unchanged from v2)
-- ============================================================
CREATE TABLE IF NOT EXISTS temperature_readings (
    id            INT AUTO_INCREMENT PRIMARY KEY,
    device_id     VARCHAR(50)   NOT NULL,
    milk_id       VARCHAR(50)   NOT NULL,
    temperature_c DECIMAL(5, 2) NOT NULL,
    recorded_at   DATETIME      NOT NULL,
    created_at    DATETIME      DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_temp_device   ON temperature_readings(device_id);
CREATE INDEX IF NOT EXISTS idx_temp_milk     ON temperature_readings(milk_id);
CREATE INDEX IF NOT EXISTS idx_temp_recorded ON temperature_readings(recorded_at);

-- ============================================================
-- 4. predictions
--    CHANGED: safety_status ENUM, new dashboard columns
-- ============================================================
CREATE TABLE IF NOT EXISTS predictions (
    id                         INT AUTO_INCREMENT PRIMARY KEY,
    milk_id                    VARCHAR(50)   NOT NULL,
    device_id                  VARCHAR(50)   NOT NULL,
    prediction_time            DATETIME      NOT NULL,
    current_temperature_c      DECIMAL(5, 2) NOT NULL,
    remaining_shelf_life_hours DECIMAL(7, 2) NOT NULL,

    -- v3: CAUTION removed
    safety_status              ENUM('SAFE', 'UNSAFE') NOT NULL,

    -- Probabilities (caution always 0.0000 in v2.0, kept for compat)
    safe_probability           DECIMAL(5, 4) NOT NULL DEFAULT 0.0000,
    caution_probability        DECIMAL(5, 4) NOT NULL DEFAULT 0.0000,
    unsafe_probability         DECIMAL(5, 4) NOT NULL DEFAULT 0.0000,

    -- v3: NEW — pre-computed dashboard values stored at prediction time
    confidence                 DECIMAL(5, 4) NOT NULL DEFAULT 0.0000,
    shelf_life_days            DECIMAL(6, 2) NOT NULL DEFAULT 0.00,
    status_tag                 VARCHAR(20)   NOT NULL DEFAULT 'FRESH',
    -- 'none' | 'info' | 'warning' | 'danger' | 'critical'
    alert_level                VARCHAR(20)   NOT NULL DEFAULT 'none',
    -- hex color for dashboard badge
    status_color               VARCHAR(10)   NOT NULL DEFAULT '#22c55e',

    -- v3: default bumped to v2.0
    model_version              VARCHAR(50)   NOT NULL DEFAULT 'v2.0',
    created_at                 DATETIME      DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pred_milk   ON predictions(milk_id);
CREATE INDEX IF NOT EXISTS idx_pred_device ON predictions(device_id);
CREATE INDEX IF NOT EXISTS idx_pred_time   ON predictions(prediction_time);

-- ============================================================
-- 5. prediction_alerts  (NEW in v3)
--    Stores alert history shown in dashboard notifications panel.
-- ============================================================
CREATE TABLE IF NOT EXISTS prediction_alerts (
    id              INT AUTO_INCREMENT PRIMARY KEY,
    milk_id         VARCHAR(50)  NOT NULL,
    device_id       VARCHAR(50)  NOT NULL,
    prediction_id   INT          NOT NULL,
    alert_level     VARCHAR(20)  NOT NULL,   -- warning / danger / critical
    alert_message   TEXT         NOT NULL,
    temperature_c   DECIMAL(5,2) NOT NULL,
    shelf_life_hours DECIMAL(7,2) NOT NULL,
    confidence      DECIMAL(5,4) NOT NULL,
    is_acknowledged BOOLEAN      NOT NULL DEFAULT FALSE,
    fired_at        DATETIME     DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS idx_alert_milk    ON prediction_alerts(milk_id);
CREATE INDEX IF NOT EXISTS idx_alert_device  ON prediction_alerts(device_id);
CREATE INDEX IF NOT EXISTS idx_alert_fired   ON prediction_alerts(fired_at);
CREATE INDEX IF NOT EXISTS idx_alert_ack     ON prediction_alerts(is_acknowledged);

-- ============================================================
-- 6. system_settings  (unchanged from v2)
-- ============================================================
CREATE TABLE IF NOT EXISTS system_settings (
    id                           INT AUTO_INCREMENT PRIMARY KEY,
    recommended_temperature      DECIMAL(5, 2) NOT NULL DEFAULT 4.0,
    maximum_temperature          DECIMAL(5, 2) NOT NULL DEFAULT 5.0,
    warning_temperature          DECIMAL(5, 2) NOT NULL DEFAULT 7.0,
    critical_temperature         DECIMAL(5, 2) NOT NULL DEFAULT 10.0,
    monitoring_interval_minutes  INT           NOT NULL DEFAULT 1,
    temperature_history_hours    INT           NOT NULL DEFAULT 24,
    excursion_duration_minutes   INT           NOT NULL DEFAULT 30,
    prediction_frequency         VARCHAR(50)   NOT NULL DEFAULT 'Automatically',
    minimum_prediction_confidence INT          NOT NULL DEFAULT 70,
    temperature_alert_enabled    BOOLEAN       NOT NULL DEFAULT TRUE,
    prediction_alert_enabled     BOOLEAN       NOT NULL DEFAULT TRUE,
    shelf_life_alert_enabled     BOOLEAN       NOT NULL DEFAULT TRUE,
    sensor_offline_alert_enabled BOOLEAN       NOT NULL DEFAULT TRUE,
    data_delay_alert_enabled     BOOLEAN       NOT NULL DEFAULT TRUE,
    alert_cooldown_minutes       INT           NOT NULL DEFAULT 30,
    created_at                   DATETIME      DEFAULT CURRENT_TIMESTAMP,
    updated_at                   DATETIME      DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ============================================================
-- Foreign Key Constraints
-- ============================================================
ALTER TABLE temperature_readings
    ADD CONSTRAINT fk_temp_device FOREIGN KEY (device_id) REFERENCES devices(device_id)      ON DELETE CASCADE,
    ADD CONSTRAINT fk_temp_milk   FOREIGN KEY (milk_id)   REFERENCES milk_products(milk_id)  ON DELETE CASCADE;

ALTER TABLE predictions
    ADD CONSTRAINT fk_pred_device FOREIGN KEY (device_id) REFERENCES devices(device_id)      ON DELETE CASCADE,
    ADD CONSTRAINT fk_pred_milk   FOREIGN KEY (milk_id)   REFERENCES milk_products(milk_id)  ON DELETE CASCADE;
