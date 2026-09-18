-- ============================================================
-- ColdGuard AI — Migration: Live DB -> v3
-- Based on ACTUAL live schema (differs from schema_v2.sql docs)
-- MySQL 9.7.x compatible
-- ============================================================

USE coldguard_ai;

-- ─────────────────────────────────────────────────────────────
-- STEP 1: milk_products — already ENUM('SAFE','UNSAFE') ✓
--         Just ensure status column is correct
-- ─────────────────────────────────────────────────────────────
-- milk_products.status is already ENUM('SAFE','UNSAFE') — no change needed.

-- ─────────────────────────────────────────────────────────────
-- STEP 2: devices — add missing columns from schema_v2
-- ─────────────────────────────────────────────────────────────
DROP PROCEDURE IF EXISTS _cg_add;
DELIMITER //
CREATE PROCEDURE _cg_add(IN tbl VARCHAR(64), IN col VARCHAR(64), IN def TEXT)
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.COLUMNS
        WHERE TABLE_SCHEMA = 'coldguard_ai'
          AND TABLE_NAME   = tbl
          AND COLUMN_NAME  = col
    ) THEN
        SET @s = CONCAT('ALTER TABLE `', tbl, '` ADD COLUMN `', col, '` ', def);
        PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
    END IF;
END //
DELIMITER ;

-- devices: add last_temperature, last_seen, created_at
CALL _cg_add('devices', 'last_temperature', 'DECIMAL(5,2) NULL');
CALL _cg_add('devices', 'last_seen',        'DATETIME DEFAULT CURRENT_TIMESTAMP');
CALL _cg_add('devices', 'created_at',       'DATETIME DEFAULT CURRENT_TIMESTAMP');

-- devices: fix status column to ENUM if it's still VARCHAR
ALTER TABLE devices
    MODIFY COLUMN status ENUM('ONLINE','OFFLINE','WARNING','ERROR') NOT NULL DEFAULT 'ONLINE';

-- ─────────────────────────────────────────────────────────────
-- STEP 3: milk_products — add missing id, created_at
-- ─────────────────────────────────────────────────────────────
CALL _cg_add('milk_products', 'created_at', 'DATETIME DEFAULT CURRENT_TIMESTAMP');

-- ─────────────────────────────────────────────────────────────
-- STEP 4: predictions — rename + add columns
--  LIVE columns : id, milk_id, remaining_shelf_life_hours,
--                 safety_status, prob_safe, prob_caution,
--                 prob_unsafe, timestamp
--  NEED          : device_id, prediction_time,
--                  current_temperature_c, safe_probability,
--                  caution_probability, unsafe_probability,
--                  model_version, created_at,
--                  + v3 dashboard cols
-- ─────────────────────────────────────────────────────────────

-- 4a. Add missing core columns (backend main.py expects these names)
CALL _cg_add('predictions', 'device_id',
    'VARCHAR(50) NULL');

CALL _cg_add('predictions', 'prediction_time',
    'DATETIME NULL');

CALL _cg_add('predictions', 'current_temperature_c',
    'DECIMAL(5,2) NULL');

CALL _cg_add('predictions', 'safe_probability',
    'DECIMAL(5,4) NOT NULL DEFAULT 0.0000');

CALL _cg_add('predictions', 'caution_probability',
    'DECIMAL(5,4) NOT NULL DEFAULT 0.0000');

CALL _cg_add('predictions', 'unsafe_probability',
    'DECIMAL(5,4) NOT NULL DEFAULT 0.0000');

CALL _cg_add('predictions', 'model_version',
    'VARCHAR(50) NOT NULL DEFAULT "v2.0"');

CALL _cg_add('predictions', 'created_at',
    'DATETIME DEFAULT CURRENT_TIMESTAMP');

-- 4b. Migrate data from old column names -> new column names
UPDATE predictions
SET
    safe_probability   = COALESCE(prob_safe,    0),
    caution_probability= COALESCE(prob_caution, 0),
    unsafe_probability = COALESCE(prob_unsafe,  0),
    prediction_time    = COALESCE(`timestamp`,  NOW())
WHERE safe_probability = 0 AND prob_safe IS NOT NULL;

-- 4c. Add v3 dashboard columns
CALL _cg_add('predictions', 'confidence',
    'DECIMAL(5,4) NOT NULL DEFAULT 0.0000');

CALL _cg_add('predictions', 'shelf_life_days',
    'DECIMAL(6,2) NOT NULL DEFAULT 0.00');

CALL _cg_add('predictions', 'status_tag',
    'VARCHAR(20) NOT NULL DEFAULT "FRESH"');

CALL _cg_add('predictions', 'alert_level',
    'VARCHAR(20) NOT NULL DEFAULT "none"');

CALL _cg_add('predictions', 'status_color',
    'VARCHAR(10) NOT NULL DEFAULT "#22c55e"');

DROP PROCEDURE IF EXISTS _cg_add;

-- ─────────────────────────────────────────────────────────────
-- STEP 5: Back-fill all dashboard columns
-- ─────────────────────────────────────────────────────────────
UPDATE predictions SET
    confidence = CASE
        WHEN safety_status = 'SAFE' THEN safe_probability
        ELSE unsafe_probability
    END,
    shelf_life_days = ROUND(remaining_shelf_life_hours / 24.0, 2),
    status_tag = CASE
        WHEN remaining_shelf_life_hours > 120 THEN 'FRESH'
        WHEN remaining_shelf_life_hours > 72  THEN 'GOOD'
        WHEN remaining_shelf_life_hours > 24  THEN 'CAUTION'
        WHEN remaining_shelf_life_hours > 0   THEN 'CRITICAL'
        ELSE 'EXPIRED'
    END,
    alert_level = CASE
        WHEN safety_status = 'UNSAFE' AND unsafe_probability >= 0.95 THEN 'critical'
        WHEN safety_status = 'UNSAFE' AND unsafe_probability >= 0.80 THEN 'danger'
        WHEN safety_status = 'SAFE'   AND remaining_shelf_life_hours <= 24 THEN 'warning'
        WHEN safety_status = 'SAFE'   AND remaining_shelf_life_hours <= 72 THEN 'info'
        ELSE 'none'
    END,
    status_color = CASE
        WHEN safety_status = 'UNSAFE' AND unsafe_probability >= 0.95 THEN '#7f1d1d'
        WHEN safety_status = 'UNSAFE' AND unsafe_probability >= 0.80 THEN '#ef4444'
        WHEN safety_status = 'SAFE'   AND remaining_shelf_life_hours <= 24 THEN '#f59e0b'
        WHEN safety_status = 'SAFE'   AND remaining_shelf_life_hours <= 72 THEN '#3b82f6'
        ELSE '#22c55e'
    END;

-- ─────────────────────────────────────────────────────────────
-- STEP 6: system_settings — add if missing
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS system_settings (
    id                            INT AUTO_INCREMENT PRIMARY KEY,
    recommended_temperature       DECIMAL(5,2) NOT NULL DEFAULT 4.0,
    maximum_temperature           DECIMAL(5,2) NOT NULL DEFAULT 5.0,
    warning_temperature           DECIMAL(5,2) NOT NULL DEFAULT 7.0,
    critical_temperature          DECIMAL(5,2) NOT NULL DEFAULT 10.0,
    monitoring_interval_minutes   INT          NOT NULL DEFAULT 1,
    temperature_history_hours     INT          NOT NULL DEFAULT 24,
    excursion_duration_minutes    INT          NOT NULL DEFAULT 30,
    prediction_frequency          VARCHAR(50)  NOT NULL DEFAULT 'Automatically',
    minimum_prediction_confidence INT          NOT NULL DEFAULT 70,
    temperature_alert_enabled     BOOLEAN      NOT NULL DEFAULT TRUE,
    prediction_alert_enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
    shelf_life_alert_enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
    sensor_offline_alert_enabled  BOOLEAN      NOT NULL DEFAULT TRUE,
    data_delay_alert_enabled      BOOLEAN      NOT NULL DEFAULT TRUE,
    alert_cooldown_minutes        INT          NOT NULL DEFAULT 30,
    created_at  DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
);

-- ─────────────────────────────────────────────────────────────
-- STEP 7: prediction_alerts table (NEW)
-- ─────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS prediction_alerts (
    id               INT AUTO_INCREMENT PRIMARY KEY,
    milk_id          VARCHAR(50)   NOT NULL,
    device_id        VARCHAR(50)   NOT NULL,
    prediction_id    INT           NOT NULL,
    alert_level      VARCHAR(20)   NOT NULL,
    alert_message    TEXT          NOT NULL,
    temperature_c    DECIMAL(5,2)  NOT NULL,
    shelf_life_hours DECIMAL(7,2)  NOT NULL,
    confidence       DECIMAL(5,4)  NOT NULL,
    is_acknowledged  BOOLEAN       NOT NULL DEFAULT FALSE,
    fired_at         DATETIME      DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (prediction_id) REFERENCES predictions(id) ON DELETE CASCADE
);

-- Create indexes safely (IF NOT EXISTS not supported for INDEX in MySQL 9.7)
DROP PROCEDURE IF EXISTS _cg_idx;
DELIMITER //
CREATE PROCEDURE _cg_idx(IN tbl VARCHAR(64), IN idx VARCHAR(64), IN col VARCHAR(64))
BEGIN
    IF NOT EXISTS (
        SELECT 1 FROM INFORMATION_SCHEMA.STATISTICS
        WHERE TABLE_SCHEMA = 'coldguard_ai'
          AND TABLE_NAME   = tbl
          AND INDEX_NAME   = idx
    ) THEN
        SET @s = CONCAT('CREATE INDEX `', idx, '` ON `', tbl, '` (`', col, '`)');
        PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;
    END IF;
END //
DELIMITER ;

CALL _cg_idx('prediction_alerts', 'idx_alert_milk',   'milk_id');
CALL _cg_idx('prediction_alerts', 'idx_alert_device', 'device_id');
CALL _cg_idx('prediction_alerts', 'idx_alert_fired',  'fired_at');
DROP PROCEDURE IF EXISTS _cg_idx;

-- ─────────────────────────────────────────────────────────────
-- STEP 8: Verify
-- ─────────────────────────────────────────────────────────────
SELECT TABLE_NAME, GROUP_CONCAT(COLUMN_NAME ORDER BY ORDINAL_POSITION SEPARATOR ', ') AS columns
FROM INFORMATION_SCHEMA.COLUMNS
WHERE TABLE_SCHEMA = 'coldguard_ai'
GROUP BY TABLE_NAME
ORDER BY TABLE_NAME;
