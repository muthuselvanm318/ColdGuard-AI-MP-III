import mysql.connector
import os

env_vars = {}
with open(".env") as f:
    for line in f:
        if "=" in line and not line.startswith("#"):
            key, val = line.strip().split("=", 1)
            env_vars[key] = val.strip("'\"")

def create_alerts():
    try:
        conn = mysql.connector.connect(
            host=env_vars.get("DB_HOST"),
            user=env_vars.get("DB_USER"),
            password=env_vars.get("DB_PASSWORD"),
            database=env_vars.get("DB_NAME"),
            port=int(env_vars.get("DB_PORT", 3306)),
            ssl_disabled=False
        )
        cursor = conn.cursor()
        create_sql = """
        CREATE TABLE IF NOT EXISTS alerts (
            id INT AUTO_INCREMENT PRIMARY KEY,
            alert_code VARCHAR(20) NOT NULL,
            type VARCHAR(50) NOT NULL,
            severity VARCHAR(50) NOT NULL,
            milk_id VARCHAR(50) NULL,
            device_id VARCHAR(50) NULL,
            temperature_c DECIMAL(5, 2) NULL,
            message TEXT NOT NULL,
            status ENUM('ACTIVE', 'ACKNOWLEDGED', 'RESOLVED') NOT NULL DEFAULT 'ACTIVE',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        );
        """
        cursor.execute(create_sql)
        conn.commit()
        print("Table 'alerts' created successfully.")
    except Exception as e:
        print("Error:", e)

create_alerts()
