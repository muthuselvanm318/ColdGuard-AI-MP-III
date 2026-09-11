from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import mysql.connector
from mysql.connector import Error
import pandas as pd
import numpy as np
import pickle
from datetime import datetime
import os
from dotenv import load_dotenv

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

def parse_iso_datetime(dt_str: str) -> str:
    if not dt_str: return None
    if dt_str.endswith('Z'):
        dt_str = dt_str[:-1] + '+00:00'
    try:
        return datetime.fromisoformat(dt_str).strftime('%Y-%m-%d %H:%M:%S')
    except:
        return dt_str # fallback

app = FastAPI(title="ColdGuard AI API")

# Setup CORS for Vite proxy or direct access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Load ML Models
xgb_model = None
rf_model = None
try:
    xgb_path = os.path.join(os.path.dirname(__file__), '../ml/xgboost_shelf_life_model.pkl')
    rf_path = os.path.join(os.path.dirname(__file__), '../ml/random_forest_safety_model.pkl')
    with open(xgb_path, 'rb') as f:
        xgb_model = pickle.load(f)
    with open(rf_path, 'rb') as f:
        rf_model = pickle.load(f)
    print("Successfully loaded XGBoost and Random Forest models.")
except Exception as e:
    print(f"Warning: ML models could not be loaded. Ensure they are trained. Error: {e}")

# Database Connection Helper
def get_db_connection():
    try:
        # User needs to ensure MySQL is running locally with these credentials
        # or configure via environment variables.
        connection = mysql.connector.connect(
            host=os.environ.get("DB_HOST", "127.0.0.1"),
            user=os.environ.get("DB_USER", "root"),
            password=os.environ.get("DB_PASSWORD", "0407"),
            database=os.environ.get("DB_NAME", "coldguard_ai")
        )
        return connection
    except Error as e:
        print(f"Error connecting to MySQL: {e}")
        return None

# Pydantic Models
class TemperaturePayload(BaseModel):
    device_id: str
    milk_id: str
    temperature_c: float
    timestamp: Optional[str] = None

class ProductPayload(BaseModel):
    milk_id: str
    product_name: str
    milk_type: str = "Pasteurized Whole Milk"
    storage_start_time: str
    expiry_time: str
    device_id: Optional[str] = None

class DevicePayload(BaseModel):
    device_id: str
    device_name: str
    sensor_type: str = "DS18B20"
    location: str

class SettingsPayload(BaseModel):
    recommended_temperature: float = 4.0
    maximum_temperature: float = 5.0
    warning_temperature: float = 7.0
    critical_temperature: float = 10.0
    monitoring_interval_minutes: int = 1
    temperature_history_hours: int = 24
    excursion_duration_minutes: int = 30
    prediction_frequency: str = 'Automatically'
    minimum_prediction_confidence: int = 70
    temperature_alert_enabled: bool = True
    prediction_alert_enabled: bool = True
    shelf_life_alert_enabled: bool = True
    sensor_offline_alert_enabled: bool = True
    data_delay_alert_enabled: bool = True
    alert_cooldown_minutes: int = 30

# ---------------------------------------------------------
# ML Feature Engineering Logic
# ---------------------------------------------------------
def calculate_features(milk_id: str, current_temp: float):
    """
    Fetches historical temperature data for the given milk_id and calculates
    the 12 required features for the ML models.
    """
    conn = get_db_connection()
    if not conn:
        raise Exception("Database unavailable")
    
    cursor = conn.cursor(dictionary=True)
    
    # 1. Fetch Product Start Time
    cursor.execute("SELECT storage_start_time FROM milk_products WHERE milk_id = %s", (milk_id,))
    product = cursor.fetchone()
    if not product:
        conn.close()
        raise Exception("Product not found")
        
    start_time = product['storage_start_time']
    # If the returned type is string (depends on driver), convert it. Usually datetime object.
    if isinstance(start_time, str):
        start_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        
    now = datetime.now()
    storage_hours = (now - start_time).total_seconds() / 3600.0
    storage_hours = max(0, storage_hours)

    # 2. Fetch Temperature History
    cursor.execute("SELECT temperature_c, recorded_at FROM temperature_readings WHERE milk_id = %s ORDER BY recorded_at ASC", (milk_id,))
    readings = cursor.fetchall()
    conn.close()
    
    temps = [float(r['temperature_c']) for r in readings]
    if len(temps) == 0:
        temps = [current_temp]
    else:
        # Append the current live reading if we haven't saved it yet
        # But we actually save it before calling this. Let's assume it's in `temps` already.
        pass

    temps_array = np.array(temps)
    avg_temp = np.mean(temps_array)
    min_temp = np.min(temps_array)
    max_temp = np.max(temps_array)
    std_temp = np.std(temps_array) if len(temps_array) > 1 else 0.0
    
    above_6 = sum(1 for t in temps if t > 6.0)
    above_8 = sum(1 for t in temps if t > 8.0)
    
    longest_excursion = 0
    current_excursion = 0
    num_excursions = 0
    in_excursion = False
    
    for t in temps:
        if t > 8.0:
            current_excursion += 1
            if not in_excursion:
                num_excursions += 1
                in_excursion = True
        else:
            if current_excursion > longest_excursion:
                longest_excursion = current_excursion
            current_excursion = 0
            in_excursion = False
    if current_excursion > longest_excursion:
        longest_excursion = current_excursion

    if len(temps) >= 5:
        trend = np.polyfit(range(min(5, len(temps))), temps[-5:], 1)[0]
    else:
        trend = 0.0

    cumulative = np.sum(temps_array)

    features = {
        'storage_hours': storage_hours,
        'current_temperature_c': current_temp,
        'avg_temperature_c': avg_temp,
        'min_temperature_c': min_temp,
        'max_temperature_c': max_temp,
        'temperature_std_c': std_temp,
        'time_above_6c_hours': above_6,
        'time_above_8c_hours': above_8,
        'num_temperature_excursions': num_excursions,
        'longest_excursion_hours': longest_excursion,
        'cumulative_temperature_exposure': cumulative,
        'temperature_trend': trend
    }
    return features


def generate_live_prediction(milk_id: str, device_id: str, current_temp: float):
    if not xgb_model or not rf_model:
        print("Models not loaded. Cannot predict.")
        return

    try:
        # Calculate features
        feat_dict = calculate_features(milk_id, current_temp)
        
        # Prepare DataFrame for models
        # Order must match training
        feat_order = [
            'storage_hours', 'current_temperature_c', 'avg_temperature_c',
            'min_temperature_c', 'max_temperature_c', 'temperature_std_c',
            'time_above_6c_hours', 'time_above_8c_hours', 'num_temperature_excursions',
            'longest_excursion_hours', 'cumulative_temperature_exposure', 'temperature_trend'
        ]
        
        df_features = pd.DataFrame([feat_dict], columns=feat_order)
        
        # XGBoost prediction
        shelf_life_preds = xgb_model.predict(df_features)
        shelf_life = float(max(0.0, shelf_life_preds[0]))
        
        # Random Forest Prediction
        status_pred = rf_model.predict(df_features)[0]
        status_probs = rf_model.predict_proba(df_features)[0]
        classes = rf_model.classes_ # usually ['CAUTION', 'SAFE', 'UNSAFE'] or similar
        
        prob_dict = {cls: float(prob) for cls, prob in zip(classes, status_probs)}
        
        safe_prob = prob_dict.get("SAFE", 0.0)
        caution_prob = prob_dict.get("CAUTION", 0.0)
        unsafe_prob = prob_dict.get("UNSAFE", 0.0)
        
        # Save to DB
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()
            query = """
                INSERT INTO predictions 
                (milk_id, device_id, prediction_time, current_temperature_c, 
                 remaining_shelf_life_hours, safety_status, safe_probability, 
                 caution_probability, unsafe_probability, model_version)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            """
            cursor.execute(query, (
                milk_id, device_id, datetime.now(), current_temp,
                shelf_life, status_pred, safe_prob, caution_prob, unsafe_prob, "v1.0"
            ))
            
            # Update product status
            cursor.execute("UPDATE milk_products SET status = %s WHERE milk_id = %s", (status_pred, milk_id))
            
            # Update device last temperature
            cursor.execute("UPDATE devices SET last_temperature = %s, last_seen = %s WHERE device_id = %s", (current_temp, datetime.now(), device_id))
            
            conn.commit()
            conn.close()
            
    except Exception as e:
        print(f"Prediction Pipeline Error: {e}")


# ---------------------------------------------------------
# API ENDPOINTS (Core Requirements)
# ---------------------------------------------------------

@app.post("/api/temperature")
def post_temperature(payload: TemperaturePayload, background_tasks: BackgroundTasks):
    """ESP32 posts data here."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
        
    try:
        timestamp = payload.timestamp if payload.timestamp else datetime.now().isoformat()
        
        cursor = conn.cursor()
        query = "INSERT INTO temperature_readings (device_id, milk_id, temperature_c, recorded_at) VALUES (%s, %s, %s, %s)"
        cursor.execute(query, (payload.device_id, payload.milk_id, payload.temperature_c, timestamp))
        conn.commit()
        
        # Trigger ML prediction asynchronously
        background_tasks.add_task(generate_live_prediction, payload.milk_id, payload.device_id, payload.temperature_c)
        
        return {"success": True, "message": "Temperature recorded."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/temperature/history/{milk_id}")
def get_temperature_history(milk_id: str):
    conn = get_db_connection()
    if not conn:
        return {"success": False}
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM temperature_readings WHERE milk_id = %s ORDER BY recorded_at ASC", (milk_id,))
    data = cursor.fetchall()
    conn.close()
    return {"success": True, "data": data}

@app.get("/api/temperature/latest/{milk_id}")
def get_temperature_latest(milk_id: str):
    conn = get_db_connection()
    if not conn:
        return {"success": False}
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM temperature_readings WHERE milk_id = %s ORDER BY recorded_at DESC LIMIT 1", (milk_id,))
    data = cursor.fetchone()
    conn.close()
    return {"success": True, "data": data}

@app.get("/api/predictions/latest/{milk_id}")
def get_predictions_latest(milk_id: str):
    conn = get_db_connection()
    if not conn:
        return {"success": False}
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM predictions WHERE milk_id = %s ORDER BY prediction_time DESC LIMIT 1", (milk_id,))
    data = cursor.fetchone()
    conn.close()
    
    if data:
        return {
            "success": True,
            "prediction": {
                "remaining_shelf_life_hours": float(data["remaining_shelf_life_hours"]),
                "safety_status": data["safety_status"],
                "probabilities": {
                    "SAFE": float(data["safe_probability"]),
                    "CAUTION": float(data["caution_probability"]),
                    "UNSAFE": float(data["unsafe_probability"])
                }
            }
        }
    return {"success": False, "message": "No predictions found."}

@app.post("/api/predict/{milk_id}")
def force_prediction(milk_id: str):
    """Force a live prediction right now for the UI."""
    conn = get_db_connection()
    if not conn:
        return {"success": False}
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT device_id, temperature_c FROM temperature_readings WHERE milk_id = %s ORDER BY recorded_at DESC LIMIT 1", (milk_id,))
    reading = cursor.fetchone()
    conn.close()
    
    if not reading:
        raise HTTPException(status_code=404, detail="No temperature history found to generate prediction.")
        
    generate_live_prediction(milk_id, reading["device_id"], float(reading["temperature_c"]))
    
    return get_predictions_latest(milk_id)

@app.get("/api/products")
def get_products():
    conn = get_db_connection()
    if not conn:
        return {"success": False, "data": []}
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM milk_products")
    data = cursor.fetchall()
    conn.close()
    # Map 'milk_id' to 'id' for the UI compatibility if needed, though 'milk_id' is preferred.
    for p in data:
        p["id"] = p["milk_id"]
        p["product_code"] = p["milk_id"]
        p["name"] = p["product_name"]
        p["current_temperature_c"] = 4.0 # default/placeholder if no reading
    return {"success": True, "data": data}

@app.post("/api/products")
def add_product(payload: ProductPayload):
    conn = get_db_connection()
    if not conn:
        return {"success": False}
    try:
        cursor = conn.cursor()
        query = """
            INSERT INTO milk_products (milk_id, product_name, milk_type, storage_start_time, expiry_time, device_id)
            VALUES (%s, %s, %s, %s, %s, %s)
        """
        st_time = parse_iso_datetime(payload.storage_start_time)
        exp_time = parse_iso_datetime(payload.expiry_time)
        cursor.execute(query, (payload.milk_id, payload.product_name, payload.milk_type, st_time, exp_time, payload.device_id))
        conn.commit()
        return {"success": True}
    except mysql.connector.Error as e:
        if e.errno == 1062:
            raise HTTPException(status_code=400, detail="A product with this name or ID already exists.")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.put("/api/products/{milk_id}")
def update_product(milk_id: str, payload: ProductPayload):
    conn = get_db_connection()
    if not conn:
        return {"success": False}
    try:
        cursor = conn.cursor()
        query = """
            UPDATE milk_products 
            SET product_name=%s, milk_type=%s, storage_start_time=%s, expiry_time=%s, device_id=%s
            WHERE milk_id=%s
        """
        st_time = parse_iso_datetime(payload.storage_start_time)
        exp_time = parse_iso_datetime(payload.expiry_time)
        cursor.execute(query, (payload.product_name, payload.milk_type, st_time, exp_time, payload.device_id, milk_id))
        conn.commit()
        return {"success": True}
    except mysql.connector.Error as e:
        if e.errno == 1062:
            raise HTTPException(status_code=400, detail="A product with this name already exists.")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/products/{milk_id}")
def delete_product(milk_id: str):
    conn = get_db_connection()
    if not conn:
        return {"success": False}
    try:
        cursor = conn.cursor()
        cursor.execute("DELETE FROM predictions WHERE milk_id=%s", (milk_id,))
        cursor.execute("DELETE FROM temperature_readings WHERE milk_id=%s", (milk_id,))
        cursor.execute("DELETE FROM milk_products WHERE milk_id=%s", (milk_id,))
        conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/devices")
def get_devices():
    conn = get_db_connection()
    if not conn:
        return {"success": False, "data": []}
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM devices")
    data = cursor.fetchall()
    conn.close()
    return {"success": True, "data": data}

@app.post("/api/devices")
def add_device(payload: DevicePayload):
    conn = get_db_connection()
    if not conn:
        return {"success": False}
    try:
        cursor = conn.cursor()
        query = """
            INSERT INTO devices (device_id, device_name, sensor_type, location)
            VALUES (%s, %s, %s, %s)
        """
        cursor.execute(query, (payload.device_id, payload.device_name, payload.sensor_type, payload.location))
        conn.commit()
        return {"success": True}
    except mysql.connector.Error as e:
        if e.errno == 1062:
            raise HTTPException(status_code=400, detail="A device with this name or ID already exists.")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.put("/api/devices/{device_id}")
def update_device(device_id: str, payload: DevicePayload):
    conn = get_db_connection()
    if not conn:
        return {"success": False}
    try:
        cursor = conn.cursor()
        query = """
            UPDATE devices 
            SET device_name=%s, sensor_type=%s, location=%s
            WHERE device_id=%s
        """
        cursor.execute(query, (payload.device_name, payload.sensor_type, payload.location, device_id))
        conn.commit()
        return {"success": True}
    except mysql.connector.Error as e:
        if e.errno == 1062:
            raise HTTPException(status_code=400, detail="A device with this name already exists.")
        raise HTTPException(status_code=500, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.delete("/api/devices/{device_id}")
def delete_device(device_id: str):
    conn = get_db_connection()
    if not conn:
        return {"success": False}
    try:
        cursor = conn.cursor()
        # Unassign device from any products
        cursor.execute("UPDATE milk_products SET device_id=NULL WHERE device_id=%s", (device_id,))
        # Delete device
        cursor.execute("DELETE FROM devices WHERE device_id=%s", (device_id,))
        conn.commit()
        return {"success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()


# ---------------------------------------------------------
# MOCK ENDPOINTS FOR EXISTING UI COMPATIBILITY
# (To prevent the React app from breaking)
# ---------------------------------------------------------
@app.get("/api/dashboard")
def dashboard():
    return {
        "success": True,
        "summary": {
            "totalProducts": 1,
            "activeRefrigerators": 1,
            "onlineDevices": 1,
            "offlineDevices": 0,
            "currentAlerts": 0,
            "productsMonitored": 1
        },
        "temperatureSummary": {
            "current": 4.2,
            "average": 4.0,
            "maximum": 5.0,
            "minimum": 3.8
        },
        "foodStatusSummary": {
            "SAFE": 1,
            "CAUTION": 0,
            "UNSAFE": 0
        },
        "mlStatus": {
            "available": True,
            "message": "AI prediction models active"
        }
    }

@app.get("/api/settings")
def get_settings():
    conn = get_db_connection()
    if not conn:
        return {"success": False}
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM system_settings LIMIT 1")
    data = cursor.fetchone()
    
    if not data:
        # Insert defaults if empty
        cursor.execute("""
            INSERT INTO system_settings 
            (recommended_temperature, maximum_temperature, warning_temperature, critical_temperature, 
            monitoring_interval_minutes, temperature_history_hours, excursion_duration_minutes, 
            prediction_frequency, minimum_prediction_confidence, temperature_alert_enabled, 
            prediction_alert_enabled, shelf_life_alert_enabled, sensor_offline_alert_enabled, 
            data_delay_alert_enabled, alert_cooldown_minutes)
            VALUES (4.0, 5.0, 7.0, 10.0, 1, 24, 30, 'Automatically', 70, 1, 1, 1, 1, 1, 30)
        """)
        conn.commit()
        cursor.execute("SELECT * FROM system_settings LIMIT 1")
        data = cursor.fetchone()
        
    conn.close()
    
    # Cast boolean fields for JSON
    bool_fields = ['temperature_alert_enabled', 'prediction_alert_enabled', 'shelf_life_alert_enabled', 'sensor_offline_alert_enabled', 'data_delay_alert_enabled']
    for f in bool_fields:
        if f in data:
            data[f] = bool(data[f])
            
    # Cast decimals to float
    float_fields = ['recommended_temperature', 'maximum_temperature', 'warning_temperature', 'critical_temperature']
    for f in float_fields:
        if f in data and data[f] is not None:
            data[f] = float(data[f])
            
    return {"success": True, "data": data}

@app.put("/api/settings")
def update_settings(payload: SettingsPayload):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
        
    # Check if exists
    cursor = conn.cursor()
    cursor.execute("SELECT id FROM system_settings LIMIT 1")
    row = cursor.fetchone()
    
    if not row:
        get_settings() # initialize defaults
        cursor.execute("SELECT id FROM system_settings LIMIT 1")
        row = cursor.fetchone()
        
    settings_id = row[0]
    
    query = """
        UPDATE system_settings SET 
            recommended_temperature=%s, maximum_temperature=%s, warning_temperature=%s, critical_temperature=%s,
            monitoring_interval_minutes=%s, temperature_history_hours=%s, excursion_duration_minutes=%s,
            prediction_frequency=%s, minimum_prediction_confidence=%s, temperature_alert_enabled=%s,
            prediction_alert_enabled=%s, shelf_life_alert_enabled=%s, sensor_offline_alert_enabled=%s,
            data_delay_alert_enabled=%s, alert_cooldown_minutes=%s
        WHERE id=%s
    """
    
    values = (
        payload.recommended_temperature, payload.maximum_temperature, payload.warning_temperature, payload.critical_temperature,
        payload.monitoring_interval_minutes, payload.temperature_history_hours, payload.excursion_duration_minutes,
        payload.prediction_frequency, payload.minimum_prediction_confidence, payload.temperature_alert_enabled,
        payload.prediction_alert_enabled, payload.shelf_life_alert_enabled, payload.sensor_offline_alert_enabled,
        payload.data_delay_alert_enabled, payload.alert_cooldown_minutes,
        settings_id
    )
    
    try:
        cursor.execute(query, values)
        conn.commit()
        return {"success": True, "message": "Settings updated successfully"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.post("/api/settings/reset")
def reset_settings():
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor()
        cursor.execute("TRUNCATE TABLE system_settings")
        conn.commit()
        return get_settings()
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/alerts")
def get_alerts():
    return {"success": True, "data": []}

@app.get("/api/refrigerators")
def get_refrigerators():
    return {"success": True, "data": []}

@app.get("/api/notifications")
def get_notifications():
    return {"success": True, "data": []}

@app.get("/api/users")
def get_users():
    return {"success": True, "data": []}

@app.get("/api/auth/me")
def get_me():
    return {"success": True, "user": {"id": "1", "name": "Admin", "role": "ADMIN"}}

@app.post("/api/auth/login")
def login():
    return {"success": True, "token": "mock-token", "user": {"id": "1", "name": "Admin", "role": "ADMIN"}}

# Fallback wrapper for UI polling /api/temperature
@app.get("/api/temperature")
def get_temperature_all(limit: int = 50):
    conn = get_db_connection()
    if not conn:
        return {"success": False, "data": []}
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM temperature_readings ORDER BY recorded_at DESC LIMIT %s", (limit,))
    data = cursor.fetchall()
    conn.close()
    
    # UI expects `timestamp`
    for d in data:
        d["timestamp"] = str(d["recorded_at"])
    
    # return in chronological order
    data.reverse()
    return {"success": True, "data": data, "thresholds": get_settings()["data"]}

# Run using: uvicorn backend.main:app --port 8000 --reload
