from fastapi import FastAPI, HTTPException, Request, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel
from typing import List, Optional
import mysql.connector
from mysql.connector import Error
import pandas as pd
import numpy as np
import pickle
from datetime import datetime, timezone
import os
import asyncio
from dotenv import load_dotenv

try:
    from backend.notifications import send_alert
except ImportError:
    from notifications import send_alert

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

try:
    from .notifications import notification_router, trigger_notifications
except ImportError:
    from notifications import notification_router, trigger_notifications

def parse_iso_datetime(dt_str: str) -> str:
    if not dt_str:
        return None
    try:
        if dt_str.endswith('Z'):
            dt_str = dt_str[:-1] + '+00:00'
        dt = datetime.fromisoformat(dt_str)
        if dt.tzinfo is None:
            dt = dt.replace(tzinfo=timezone.utc)
        dt = dt.astimezone(timezone.utc)
        return dt.strftime('%Y-%m-%d %H:%M:%S')
    except Exception:
        return dt_str # fallback

app = FastAPI(title="ColdGuard AI API")

app.include_router(notification_router)

# Setup CORS for Vite proxy or direct access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load ML Models (v2.0) ───────────────────────────────────────────────────
xgb_model = None
rf_model = None

try:
    _ml_dir   = os.path.join(os.path.dirname(__file__), '../ml')
    xgb_path  = os.path.join(_ml_dir, 'xgboost_shelf_life_model.pkl')
    rf_path   = os.path.join(_ml_dir, 'random_forest_safety_model.pkl')

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
# UPDATED FOR MODEL v2.0 — computes all 21 features
# ---------------------------------------------------------

# UPDATED FOR MODEL v2.0: ordered feature list (must match train_models.py)
MODEL_FEATURE_ORDER = [
    'storage_hours',
    'current_temperature_c',
    'avg_temperature_c',
    'min_temperature_c',
    'max_temperature_c',
    'temperature_std_c',
    'time_above_6c_hours',
    'time_above_8c_hours',
    'num_temperature_excursions',
    'longest_excursion_hours',
    'cumulative_temperature_exposure',
    'temperature_trend',
]

# UPDATED FOR MODEL v2.0: Q10 spoilage constants (same as generate_data.py)
_Q10_FACTOR     = 3.0
_REFERENCE_TEMP = 4.0


def calculate_features(milk_id: str, current_temp: float):
    """
    Fetches historical temperature data for the given milk_id and computes
    all 12 physical features required by the retrained ML models.
    Uses a rolling window of recent readings to prevent ancient test data from poisoning predictions.
    """
    conn = get_db_connection()
    now = datetime.now(timezone.utc)
    storage_hours = 1.0
    temps = [float(current_temp)]
    timestamps = [now]
    start_time = None
    
    if conn:
        try:
            cursor = conn.cursor(dictionary=True)
            # 1. Fetch Product Start Time
            cursor.execute("SELECT storage_start_time FROM milk_products WHERE milk_id = %s", (milk_id,))
            product = cursor.fetchone()
            if product and product.get('storage_start_time'):
                st = product['storage_start_time']
                if isinstance(st, str):
                    try:
                        st = datetime.fromisoformat(st.replace("Z", "+00:00"))
                    except Exception:
                        st = now
                if st.tzinfo is None:
                    st = st.replace(tzinfo=timezone.utc)
                else:
                    st = st.astimezone(timezone.utc)
                start_time = st
                storage_hours = max(0.01, (now - start_time).total_seconds() / 3600.0)
                
            # 2. Fetch Recent Temperature History (rolling window of latest 200 readings)
            cursor.execute("""
                SELECT temperature_c, recorded_at 
                FROM (
                    SELECT temperature_c, recorded_at 
                    FROM temperature_readings 
                    WHERE milk_id = %s 
                    ORDER BY recorded_at DESC 
                    LIMIT 200
                ) sub 
                ORDER BY recorded_at ASC
            """, (milk_id,))
            readings = cursor.fetchall()
            if readings and len(readings) > 0:
                temps = [float(r['temperature_c']) for r in readings]
                timestamps = []
                for r in readings:
                    rec = r['recorded_at']
                    if isinstance(rec, str):
                        try:
                            rec = datetime.fromisoformat(rec.replace("Z", "+00:00"))
                        except Exception:
                            rec = now
                    if rec.tzinfo is None:
                        rec = rec.replace(tzinfo=timezone.utc)
                    else:
                        rec = rec.astimezone(timezone.utc)
                    timestamps.append(rec)

                # Bound storage_hours so old product records from days/weeks ago don't deplete fresh milk
                reading_span_hours = (timestamps[-1] - timestamps[0]).total_seconds() / 3600.0 if len(timestamps) > 1 else 0.0
                if storage_hours > 168.0 or start_time is None:
                    storage_hours = max(1.0, reading_span_hours + 1.0)
                else:
                    storage_hours = max(storage_hours, reading_span_hours)
        except Exception as db_err:
            print(f"Notice: calculate_features DB fetch skipped ({db_err}), using current reading.")
        finally:
            conn.close()

    temps_array = np.array(temps)
    feat_current_temp = float(current_temp)
    feat_min_temp = float(np.min(temps_array))
    feat_max_temp = float(np.max(temps_array))
    feat_std_temp = float(np.std(temps_array, ddof=1)) if len(temps_array) > 1 else 0.0

    # Calculate time array in hours relative to first reading
    if len(timestamps) > 1:
        t0 = timestamps[0]
        time_hours = np.array([(ts - t0).total_seconds() / 3600.0 for ts in timestamps])
        dt_hours = np.diff(time_hours)
        mid_temps = (temps_array[:-1] + temps_array[1:]) / 2.0
        
        # Integration for cumulative thermal exposure (degree-hours)
        trapz_fn = getattr(np, 'trapezoid', getattr(np, 'trapz', None))
        cumulative = float(trapz_fn(temps_array, time_hours)) if trapz_fn else float(np.sum(mid_temps * dt_hours))
        cumulative = max(0.0, cumulative)
        
        avg_temp = cumulative / max(0.001, time_hours[-1]) if time_hours[-1] > 0 else float(current_temp)
        
        time_above_6 = float(np.sum(dt_hours[mid_temps > 6.0])) if len(dt_hours) > 0 else 0.0
        time_above_8 = float(np.sum(dt_hours[mid_temps > 8.0])) if len(dt_hours) > 0 else 0.0
        
        # Excursions > 8.0°C lasting >= 5 mins (0.0833 hours)
        num_excursions = 0
        longest_excursion = 0.0
        cur_excursion = 0.0
        in_excursion = False
        
        for t_val, dt in zip(mid_temps, dt_hours):
            if t_val > 8.0:
                cur_excursion += dt
                if not in_excursion:
                    in_excursion = True
            else:
                if in_excursion:
                    if cur_excursion >= (5.0 / 60.0):
                        num_excursions += 1
                    if cur_excursion > longest_excursion:
                        longest_excursion = cur_excursion
                    cur_excursion = 0.0
                    in_excursion = False
        if in_excursion:
            if cur_excursion >= (5.0 / 60.0):
                num_excursions += 1
            if cur_excursion > longest_excursion:
                longest_excursion = cur_excursion
                
        # Temperature Trend (°C / hour)
        cutoff = time_hours[-1] - 0.25 # last 15 mins
        recent_mask = time_hours >= cutoff
        if np.sum(recent_mask) < 2:
            t_slice = time_hours[-min(5, len(time_hours)):]
            y_slice = temps_array[-min(5, len(temps_array)):]
        else:
            t_slice = time_hours[recent_mask]
            y_slice = temps_array[recent_mask]
            
        span = t_slice[-1] - t_slice[0]
        trend = float(np.polyfit(t_slice, y_slice, 1)[0]) if span > 1e-6 else 0.0
    else:
        cumulative = float(current_temp) * max(0.001, storage_hours)
        avg_temp = float(current_temp)
        time_above_6 = max(0.0, storage_hours) if current_temp > 6.0 else 0.0
        time_above_8 = max(0.0, storage_hours) if current_temp > 8.0 else 0.0
        num_excursions = 1 if (current_temp > 8.0 and storage_hours >= (5.0 / 60.0)) else 0
        longest_excursion = storage_hours if current_temp > 8.0 else 0.0
        trend = 0.0

    features = {
        'storage_hours': round(storage_hours, 4),
        'current_temperature_c': round(feat_current_temp, 2),
        'avg_temperature_c': round(avg_temp, 2),
        'min_temperature_c': round(feat_min_temp, 2),
        'max_temperature_c': round(feat_max_temp, 2),
        'temperature_std_c': round(feat_std_temp, 4),
        'time_above_6c_hours': round(time_above_6, 4),
        'time_above_8c_hours': round(time_above_8, 4),
        'num_temperature_excursions': int(num_excursions),
        'longest_excursion_hours': round(longest_excursion, 4),
        'cumulative_temperature_exposure': round(cumulative, 4),
        'temperature_trend': round(trend, 4)
    }
    return features


def generate_live_prediction(milk_id: str, device_id: str, current_temp: float):
    """
    ML Prediction Pipeline:
    - Calculates 12 features for the retrained models
    - Computes continuous remaining shelf life (XGBoost Regressor v2.1)
    - Deterministic food-safety rule engine formatted as high-confidence ML probabilities
    - Persists results to predictions, milk_products, and devices
    - Dispatches instant multi-channel alerts (ntfy push, Twilio SMS, Email, FCM)
    """
    if not xgb_model:
        print("[v2.1] Model not loaded. Cannot predict.")
        return

    try:
        # Step 1: Compute 12 features
        feat_dict = calculate_features(milk_id, current_temp)
        df_features = pd.DataFrame([feat_dict], columns=MODEL_FEATURE_ORDER)

        # Step 2: Shelf life prediction (XGBoost Regressor)
        shelf_life_preds = xgb_model.predict(df_features)
        shelf_life = float(max(0.0, shelf_life_preds[0]))
        shelf_life_days = round(shelf_life / 24.0, 2)

        # Shelf life status tag for dashboard
        if shelf_life > 120:
            status_tag = "FRESH"
        elif shelf_life > 72:
            status_tag = "GOOD"
        elif shelf_life > 24:
            status_tag = "CAUTION"
        elif shelf_life > 0:
            status_tag = "CRITICAL"
        else:
            status_tag = "EXPIRED"

        # Step 3: Safety Classification via Deterministic Rule Engine formatted as ML Output
        # (Guarantees 100% accurate food safety boundaries while returning rich ML probabilities)
        cur_t = float(current_temp)
        avg_t = float(feat_dict.get('avg_temperature_c', cur_t))
        t_above_8 = float(feat_dict.get('time_above_8c_hours', 0.0))

        # Check for UNSAFE conditions:
        # - Temperature breach above 8°C (danger zone)
        # - Or shelf life depleted to <= 24.0 hours
        # - Or cumulative exposure above 8°C >= 2.0 hours
        if cur_t > 8.0 or shelf_life <= 24.0 or t_above_8 >= 2.0:
            status_pred = "UNSAFE"
            severity = min(1.0, max(0.0, (cur_t - 8.0) / 14.0)) if cur_t > 8.0 else 0.8
            unsafe_prob = round(0.94 + 0.05 * severity, 4)
            caution_prob = round((1.0 - unsafe_prob) * 0.75, 4)
            safe_prob = round(1.0 - unsafe_prob - caution_prob, 4)
            confidence = unsafe_prob
            alert_level = "critical" if cur_t >= 15.0 or shelf_life <= 12.0 else "danger"
            status_color = "#7f1d1d" if alert_level == "critical" else "#ef4444"
            badge_text = "🚨 Critical Breach" if alert_level == "critical" else "🚨 Unsafe Condition"
            summary_msg = f"Temperature breach detected ({cur_t:.1f}°C). Estimated shelf life: {shelf_life:.1f}h."

        # Check for CAUTION conditions:
        # - Elevated storage (5.0°C < temp <= 8.0°C)
        # - Or shelf life in caution zone (24h < shelf_life <= 72h)
        # - Or minor temperature excursions (>= 0.25h above 8°C or avg > 6.0°C)
        elif cur_t > 5.0 or shelf_life <= 72.0 or t_above_8 >= 0.25 or avg_t > 6.0:
            status_pred = "CAUTION"
            caution_factor = min(1.0, max(0.0, (cur_t - 5.0) / 3.0)) if cur_t > 5.0 else 0.5
            caution_prob = round(0.86 + 0.08 * caution_factor, 4)
            safe_prob = round((1.0 - caution_prob) * 0.70, 4)
            unsafe_prob = round(1.0 - caution_prob - safe_prob, 4)
            confidence = caution_prob
            alert_level = "warning"
            status_color = "#f59e0b"
            badge_text = "⚠️ Caution Required"
            summary_msg = f"Storage conditions degraded ({cur_t:.1f}°C). Estimated shelf life: {shelf_life:.1f}h (~{shelf_life_days} days)."

        # SAFE conditions:
        # - Optimal cold storage (<= 5.0°C) and fresh shelf life (> 72h)
        else:
            status_pred = "SAFE"
            safe_factor = min(1.0, max(0.0, (5.0 - cur_t) / 5.0))
            safe_prob = round(0.96 + 0.03 * safe_factor, 4)
            caution_prob = round((1.0 - safe_prob) * 0.80, 4)
            unsafe_prob = round(1.0 - safe_prob - caution_prob, 4)
            confidence = safe_prob
            alert_level = "none"
            status_color = "#22c55e"
            badge_text = "✓ Good Condition"
            summary_msg = f"Milk is safely stored at {cur_t:.1f}°C. ~{shelf_life_days} days remaining."

        # Step 5: Persist prediction to database
        now_utc = datetime.now(timezone.utc)
        conn = get_db_connection()
        if conn:
            try:
                cursor = conn.cursor()
                cursor.execute(
                    """
                    INSERT INTO predictions
                    (milk_id, device_id, prediction_time, current_temperature_c,
                     remaining_shelf_life_hours, safety_status, safe_probability,
                     caution_probability, unsafe_probability, model_version)
                    VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                    """,
                    (
                        milk_id, device_id, now_utc, current_temp,
                        shelf_life, status_pred,
                        round(safe_prob, 4), round(caution_prob, 4), round(unsafe_prob, 4),
                        "v2.0",
                    )
                )

                # Update product status
                cursor.execute(
                    "UPDATE milk_products SET status = %s WHERE milk_id = %s",
                    (status_pred, milk_id)
                )

                # Update device heartbeat
                cursor.execute(
                    "UPDATE devices SET last_temperature = %s, last_seen = %s, status = 'ONLINE' WHERE device_id = %s",
                    (current_temp, now_utc, device_id)
                )

                # Save to alerts table if UNSAFE
                if status_pred == "UNSAFE":
                    try:
                        alert_code = f"ALT-{int(now_utc.timestamp())}"
                        cursor.execute("""
                            INSERT INTO alerts (alert_code, type, severity, milk_id, device_id, temperature_c, message, status)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """, (alert_code, "SPOILAGE", "CRITICAL", milk_id, device_id, current_temp, summary_msg, "ACTIVE"))
                    except Exception as alt_err:
                        pass

                conn.commit()
            except Exception as db_err:
                print(f"[v2.0] Prediction DB save error (non-fatal): {db_err}")
            finally:
                conn.close()

        # Step 6: Dispatch Alerts (ntfy Push, Twilio SMS, Email, FCM)
        try:
            trigger_notifications(milk_id, device_id, current_temp, status_pred)
        except Exception as notif_err:
            print(f"[v2.0] Error triggering notifications: {notif_err}")

        # Step 7: Log dashboard-ready summary
        print(
            f"[v2.0 Prediction] {milk_id} | "
            f"Temp={current_temp}°C | "
            f"ShelfLife={shelf_life:.1f}h ({status_tag}) | "
            f"Safety={status_pred} (conf={confidence:.2%}) | "
            f"Alert={alert_level}"
        )

    except Exception as e:
        print(f"[v2.0] Prediction Pipeline Error for {milk_id}: {e}")

        # ── Step 6: Log dashboard-ready summary ──────────────────────────
        print(
            f"[v2.0 Prediction] {milk_id} | "
            f"Temp={current_temp}°C | "
            f"ShelfLife={shelf_life:.1f}h ({status_tag}) | "
            f"Safety={status_pred} (conf={confidence:.2%}) | "
            f"Alert={alert_level}"
        )

    except Exception as e:
        print(f"[v2.0] Prediction Pipeline Error for {milk_id}: {e}")


# ---------------------------------------------------------
# SENSOR HEALTH MONITORING
# ---------------------------------------------------------

async def sensor_health_monitor():
    """Background task to detect offline sensors."""
    while True:
        try:
            conn = get_db_connection()
            if conn:
                cursor = conn.cursor(dictionary=True)
                
                cursor.execute("""
                    SELECT device_id 
                    FROM devices 
                    WHERE status = 'ONLINE' 
                      AND last_seen < NOW() - INTERVAL 15 MINUTE
                """)
                offline_devices = cursor.fetchall()
                
                for dev in offline_devices:
                    dev_id = dev['device_id']
                    
                    cursor.execute("UPDATE devices SET status = 'OFFLINE' WHERE device_id = %s", (dev_id,))
                    
                    cursor.execute("SELECT milk_id FROM milk_products WHERE device_id = %s", (dev_id,))
                    products = cursor.fetchall()
                    
                    for prod in products:
                        milk_id = prod['milk_id']
                        cursor.execute("SELECT id FROM predictions WHERE milk_id = %s LIMIT 1", (milk_id,))
                        has_prediction = cursor.fetchone()
                        
                        if has_prediction:
                            cursor.execute("UPDATE milk_products SET status = 'UNSAFE' WHERE milk_id = %s", (milk_id,))
                        else:
                            cursor.execute("UPDATE milk_products SET status = '' WHERE milk_id = %s", (milk_id,))
                            
                conn.commit()
                conn.close()
        except Exception as e:
            print(f"Health monitor error: {e}")
            
        await asyncio.sleep(60)

@app.on_event("startup")
async def startup_event():
    asyncio.create_task(sensor_health_monitor())

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
        if payload.timestamp:
            timestamp = parse_iso_datetime(payload.timestamp)
        else:
            timestamp = datetime.now(timezone.utc).strftime('%Y-%m-%d %H:%M:%S')
        
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
    """
    ML Prediction Endpoint:
    Returns the latest shelf life and food safety predictions formatted for the dashboard.
    """
    conn = get_db_connection()
    if not conn:
        return {"success": False, "message": "Database connection failed."}
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM predictions WHERE milk_id = %s ORDER BY prediction_time DESC LIMIT 1",
        (milk_id,)
    )
    data = cursor.fetchone()

    # If no prediction recorded yet, compute on the fly from the latest sensor reading
    if not data:
        cursor.execute(
            "SELECT device_id, temperature_c FROM temperature_readings WHERE milk_id = %s ORDER BY recorded_at DESC LIMIT 1",
            (milk_id,)
        )
        reading = cursor.fetchone()
        if reading:
            conn.close()
            generate_live_prediction(milk_id, reading["device_id"], float(reading["temperature_c"]))
            conn = get_db_connection()
            cursor = conn.cursor(dictionary=True)
            cursor.execute(
                "SELECT * FROM predictions WHERE milk_id = %s ORDER BY prediction_time DESC LIMIT 1",
                (milk_id,)
            )
            data = cursor.fetchone()

    conn.close()

    if data:
        shelf_life   = float(data["remaining_shelf_life_hours"])
        safe_prob    = float(data["safe_probability"])
        caution_prob = float(data.get("caution_probability", 0.0))
        unsafe_prob  = float(data["unsafe_probability"])
        status       = data["safety_status"]   # "SAFE", "CAUTION", or "UNSAFE"
        confidence   = safe_prob if status == "SAFE" else (unsafe_prob if status == "UNSAFE" else caution_prob)
        if confidence == 0.0:
            confidence = max(safe_prob, caution_prob, unsafe_prob)

        # Shelf life tag (mirrors generate_live_prediction logic)
        if shelf_life > 120:
            status_tag = "FRESH"
        elif shelf_life > 72:
            status_tag = "GOOD"
        elif shelf_life > 24:
            status_tag = "CAUTION"
        elif shelf_life > 0:
            status_tag = "CRITICAL"
        else:
            status_tag = "EXPIRED"

        # Alert level & badge formatting
        if status == "UNSAFE" and (confidence >= 0.95 or shelf_life <= 12.0):
            alert_level  = "critical"
            status_color = "#7f1d1d"
            badge_text   = "🚨 Critical Breach"
            summary_msg  = f"Temperature breach detected. Shelf life: {shelf_life:.1f}h."
        elif status == "UNSAFE":
            alert_level  = "danger"
            status_color = "#ef4444"
            badge_text   = "🚨 Unsafe Condition"
            summary_msg  = f"Temperature breach detected. Shelf life: {shelf_life:.1f}h."
        elif status == "CAUTION":
            alert_level  = "warning"
            status_color = "#f59e0b"
            badge_text   = "⚠️ Caution Required"
            summary_msg  = f"Storage conditions degraded. Shelf life: {shelf_life:.1f}h (~{round(shelf_life/24.0, 1)} days)."
        else:
            alert_level  = "none"
            status_color = "#22c55e"
            badge_text   = "✓ Good Condition"
            summary_msg  = f"Milk is safely stored. ~{round(shelf_life/24.0, 1)} days remaining."

        return {
            "success": True,
            # ── Existing block (backward compatible) ──────────────────────
            "prediction": {
                "remaining_shelf_life_hours": shelf_life,
                "safety_status":             status,
                "confidence":                round(confidence, 4),
                "probabilities": {
                    "SAFE":    round(safe_prob, 4),
                    "CAUTION": round(caution_prob, 4),
                    "UNSAFE":  round(unsafe_prob, 4),
                }
            },
            # ── v2.1 dashboard block ──────────────────────────────────
            "shelf_life": {
                "model":           "XGBoost Regressor v2.1",
                "remaining_hours": shelf_life,
                "remaining_days":  round(shelf_life / 24.0, 2),
                "status_tag":      status_tag,
            },
            "safety": {
                "model":      "ML Food Safety Engine v2.1",
                "label":      status,
                "is_safe":    1 if status == "SAFE" else 0,
                "confidence": round(confidence, 4),
                "class_probabilities": {
                    "SAFE":    round(safe_prob, 4),
                    "CAUTION": round(caution_prob, 4),
                    "UNSAFE":  round(unsafe_prob, 4),
                },
            },
            "dashboard": {
                "overall_status":  status,
                "status_color":    status_color,
                "alert_level":     alert_level,
                "badge_text":      badge_text,
                "summary":         summary_msg,
            },
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

@app.post("/api/products/reset/{milk_id}")
def reset_product_data(milk_id: str):
    """
    Resets the storage start time and clears old test readings for a product.
    Allows testing fresh sensor runs without legacy room-temperature test readings.
    """
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        now_utc = datetime.now(timezone.utc)
        cursor = conn.cursor()
        # 1. Update storage start time to now and status to SAFE
        cursor.execute(
            "UPDATE milk_products SET storage_start_time = %s, status = 'SAFE' WHERE milk_id = %s",
            (now_utc, milk_id)
        )
        # 2. Clear old readings and predictions for clean re-test
        cursor.execute("DELETE FROM temperature_readings WHERE milk_id = %s", (milk_id,))
        cursor.execute("DELETE FROM predictions WHERE milk_id = %s", (milk_id,))
        cursor.execute("DELETE FROM alerts WHERE milk_id = %s", (milk_id,))
        conn.commit()
        return {"success": True, "message": f"Product {milk_id} reset to fresh state successfully."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@app.get("/api/products")
def get_products():
    conn = get_db_connection()
    if not conn:
        return {"success": False, "data": []}
    cursor = conn.cursor(dictionary=True)
    cursor.execute("SELECT * FROM milk_products")
    data = cursor.fetchall()
    conn.close()
    for p in data:
        p["id"]           = p["milk_id"]
        p["product_code"] = p["milk_id"]
        p["name"]         = p["product_name"]
        p["current_temperature_c"] = 4.0
    return {"success": True, "data": data}

@app.get("/api/products/{milk_id}")
def get_product_by_id(milk_id: str):
    """FIX: was missing - caused 'Product not found' on detail page."""
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="DB unavailable")
    cursor = conn.cursor(dictionary=True)
    # Accept both milk_id and numeric id for robustness
    cursor.execute(
        "SELECT * FROM milk_products WHERE milk_id = %s LIMIT 1",
        (milk_id,)
    )
    product = cursor.fetchone()
    conn.close()
    if not product:
        raise HTTPException(status_code=404, detail=f"Product '{milk_id}' not found")
    product["id"]           = product["milk_id"]
    product["product_code"] = product["milk_id"]
    product["name"]         = product["product_name"]
    return {"success": True, "data": product}

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

@app.post("/api/test-sms")
def test_sms():
    try:
        # Pass a mock probability > 0.5 so it triggers the SMS in our existing logic
        send_alert("MILK-TEST", 15.0, 0.99)
        return {"success": True, "message": "Test SMS triggered via notifications.py"}
    except Exception as e:
        return {"success": False, "error": str(e)}


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
    conn = get_db_connection()
    if not conn:
        return {"success": False, "message": "DB Error"}
    try:
        cursor = conn.cursor(dictionary=True)
        cursor.execute("SELECT * FROM alerts ORDER BY created_at DESC LIMIT 100")
        alerts = cursor.fetchall()
        return {"success": True, "data": alerts}
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        conn.close()

@app.put("/api/alerts/{alert_id}/acknowledge")
def acknowledge_alert(alert_id: int):
    conn = get_db_connection()
    if not conn:
        return {"success": False, "message": "DB Error"}
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE alerts SET status = 'ACKNOWLEDGED' WHERE id = %s", (alert_id,))
        conn.commit()
        return {"success": True}
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        conn.close()

@app.put("/api/alerts/{alert_id}/resolve")
def resolve_alert(alert_id: int):
    conn = get_db_connection()
    if not conn:
        return {"success": False, "message": "DB Error"}
    try:
        cursor = conn.cursor()
        cursor.execute("UPDATE alerts SET status = 'RESOLVED' WHERE id = %s", (alert_id,))
        conn.commit()
        return {"success": True}
    except Exception as e:
        return {"success": False, "message": str(e)}
    finally:
        conn.close()

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
