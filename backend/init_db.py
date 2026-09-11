import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

def init_db():
    try:
        conn = mysql.connector.connect(
            host=os.environ.get("DB_HOST", "127.0.0.1"),
            user=os.environ.get("DB_USER", "root"),
            password=os.environ.get("DB_PASSWORD", ""),
            database=os.environ.get("DB_NAME", "coldguard_ai")
        )
        cursor = conn.cursor()
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS devices (
            device_id VARCHAR(50) PRIMARY KEY,
            device_name VARCHAR(100),
            sensor_type VARCHAR(50),
            location VARCHAR(100),
            status VARCHAR(20) DEFAULT 'ONLINE'
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS milk_products (
            milk_id VARCHAR(50) PRIMARY KEY,
            product_name VARCHAR(100),
            milk_type VARCHAR(50),
            storage_start_time DATETIME,
            expiry_time DATETIME,
            device_id VARCHAR(50),
            status VARCHAR(20) DEFAULT 'SAFE',
            FOREIGN KEY (device_id) REFERENCES devices(device_id) ON DELETE SET NULL
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS temperature_readings (
            id INT AUTO_INCREMENT PRIMARY KEY,
            milk_id VARCHAR(50),
            temperature_c FLOAT,
            timestamp DATETIME,
            FOREIGN KEY (milk_id) REFERENCES milk_products(milk_id) ON DELETE CASCADE
        )
        """)
        
        cursor.execute("""
        CREATE TABLE IF NOT EXISTS predictions (
            id INT AUTO_INCREMENT PRIMARY KEY,
            milk_id VARCHAR(50),
            remaining_shelf_life_hours FLOAT,
            safety_status VARCHAR(20),
            prob_safe FLOAT,
            prob_caution FLOAT,
            prob_unsafe FLOAT,
            timestamp DATETIME,
            FOREIGN KEY (milk_id) REFERENCES milk_products(milk_id) ON DELETE CASCADE
        )
        """)

        cursor.execute("""
        CREATE TABLE IF NOT EXISTS system_settings (
            setting_key VARCHAR(100) PRIMARY KEY,
            setting_value TEXT
        )
        """)

        conn.commit()
        print("Tables created successfully.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals() and conn.is_connected():
            conn.close()

if __name__ == "__main__":
    init_db()
