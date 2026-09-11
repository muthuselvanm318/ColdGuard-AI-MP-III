import mysql.connector
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

def test_insert():
    try:
        conn = mysql.connector.connect(
            host=os.environ.get("DB_HOST", "127.0.0.1"),
            user=os.environ.get("DB_USER", "root"),
            password=os.environ.get("DB_PASSWORD", ""),
            database=os.environ.get("DB_NAME", "coldguard_ai")
        )
        cursor = conn.cursor()
        
        iso_str = "2026-09-08T18:31:00.000Z"
        query = """
            INSERT INTO milk_products (milk_id, product_name, milk_type, storage_start_time, expiry_time, device_id)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        cursor.execute(query, ("TEST_MILK", "Test Milk", "Raw Milk", iso_str, iso_str, None))
        conn.commit()
        print("Insert successful.")
    except Exception as e:
        print(f"Error: {e}")
    finally:
        if 'conn' in locals() and conn.is_connected():
            cursor.execute("DELETE FROM milk_products WHERE milk_id='TEST_MILK'")
            conn.commit()
            conn.close()

if __name__ == "__main__":
    test_insert()
