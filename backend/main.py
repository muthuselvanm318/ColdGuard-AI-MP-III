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
from dotenv import load_dotenv

try:
    from backend.notifications import send_alert
except ImportError:
    from notifications import send_alert

load_dotenv(os.path.join(os.path.dirname(__file__), '../.env'))

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

# Setup CORS for Vite proxy or direct access
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ── Load ML Models (v2.0) ───────────────────────────────────────────────────
# UPDATED FOR MODEL v2.0: added label_encoder.pkl load
xgb_model    = None
rf_model     = None
label_encoder = None
try:
    _ml_dir   = os.path.join(os.path.dirname(__file__), '../ml')
    xgb_path  = os.path.join(_ml_dir, 'xgboost_shelf_life_model.pkl')
    rf_path   = os.path.join(_ml_dir, 'random_forest_safety_model.pkl')
    le_path   = os.path.join(_ml_dir, 'label_encoder.pkl')

    with open(xgb_path, 'rb') as f:
        xgb_model = pickle.load(f)
    with open(rf_path, 'rb') as f:
        rf_model = pickle.load(f)
    # UPDATED FOR MODEL v2.0: label encoder maps binary classes 0/1 → UNSAFE/SAFE
    if os.path.exists(le_path):
        with open(le_path, 'rb') as f:
            label_encoder = pickle.load(f)
    print("[v2.0] Successfully loaded XGBoost, Random Forest, and LabelEncoder.")
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
    'temp_last_6h',
    'temp_volatility',
    'time_in_danger_zone_pct',
    'num_temperature_excursions',
    'longest_excursion_hours',
    'temperature_trend',
    'degradation_rate_per_hour',
]

# UPDATED FOR MODEL v2.0: Q10 spoilage constants (same as generate_data.py)
_Q10_FACTOR     = 3.0
_REFERENCE_TEMP = 4.0


def calculate_features(milk_id: str, current_temp: float):
    """
    Fetches historical temperature data for the given milk_id and computes
    all 21 features required by the v2.0 ML models.

    New vs v1.0 (9 added):
      hour_of_day, day_of_week, is_weekend,
      temp_last_1h, temp_last_3h, temp_last_6h, temp_volatility,
      time_in_danger_zone_pct, degradation_rate_per_hour
    """
    conn = get_db_connection()
    if not conn:
        raise Exception("Database unavailable")

    cursor = conn.cursor(dictionary=True)

    # ── 1. Fetch Product Start Time ──────────────────────────────────────
    cursor.execute(
        "SELECT storage_start_time FROM milk_products WHERE milk_id = %s",
        (milk_id,)
    )
    product = cursor.fetchone()
    if not product:
        conn.close()
        raise Exception(f"Product not found: {milk_id}")

    start_time = product['storage_start_time']
    if isinstance(start_time, str):
        try:
            start_time = datetime.fromisoformat(start_time.replace("Z", "+00:00"))
        except Exception:
            raise Exception("Invalid storage_start_time")
            
    if start_time.tzinfo is None:
        start_time = start_time.replace(tzinfo=timezone.utc)
    else:
        start_time = start_time.astimezone(timezone.utc)

    now = datetime.now(timezone.utc)
    storage_hours = max(0.0, (now - start_time).total_seconds() / 3600.0)

    # ── 2. Fetch Temperature History (ASC) ───────────────────────────────
    cursor.execute(
        "SELECT temperature_c, recorded_at FROM temperature_readings "
        "WHERE milk_id = %s ORDER BY recorded_at ASC",
        (milk_id,)
    )
    readings = cursor.fetchall()
    conn.close()

    temps = [float(r['temperature_c']) for r in readings]
    if not temps:
        temps = [current_temp]

    temps_array = np.array(temps)
    n = len(temps)

    # ── 3. Classic statistics (same as v1) ───────────────────────────────
    avg_temp = float(np.mean(temps_array))
    min_temp = float(np.min(temps_array))
    max_temp = float(np.max(temps_array))
    std_temp = float(np.std(temps_array)) if n > 1 else 0.0
    cumulative = float(np.sum(temps_array))

    # Excursion stats (>8 °C)
    above_6 = sum(1 for t in temps if t > 6.0)
    above_8 = sum(1 for t in temps if t > 8.0)

    longest_excursion = 0
    current_excursion = 0
    num_excursions    = 0
    in_excursion      = False
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

    # Trend: slope of last 5 readings
    if n >= 5:
        trend = float(np.polyfit(range(5), temps[-5:], 1)[0])
    else:
        trend = 0.0

    # ── 4. NEW temporal features (v2.0) ──────────────────────────────────
    hour_of_day = now.hour
    day_of_week = now.weekday()          # 0=Mon … 6=Sun
    is_weekend  = int(day_of_week >= 5)

    # Rolling lag averages
    temp_last_1h = float(np.mean(temps[-1:]))
    temp_last_3h = float(np.mean(temps[-3:])) if n >= 3 else temp_last_1h
    temp_last_6h = float(np.mean(temps[-6:])) if n >= 6 else temp_last_1h

    # Rolling volatility (std of last 6 readings)
    temp_volatility = float(np.std(temps[-6:])) if n >= 6 else 0.0

    # Danger zone percentage (%  of time above 8 °C)
    time_in_danger_zone_pct = round(above_8 / max(1, n) * 100.0, 4)

    # Cumulative spoilage via Q10 kinetics → degradation rate per hour
    spoilage_consumed = sum(
        _Q10_FACTOR ** ((t - _REFERENCE_TEMP) / 10.0) for t in temps
    )
    degradation_rate_per_hour = round(
        spoilage_consumed / max(1.0, storage_hours), 6
    )

    # ── 5. Assemble full 14-feature dict ─────────────────────────────────
    features = {
        'storage_hours':                  storage_hours,
        'current_temperature_c':          current_temp,
        'avg_temperature_c':              avg_temp,
        'min_temperature_c':              min_temp,
        'max_temperature_c':              max_temp,
        'temperature_std_c':              std_temp,
        'temp_last_6h':                   temp_last_6h,
        'temp_volatility':                temp_volatility,
        'time_in_danger_zone_pct':        time_in_danger_zone_pct,
        'num_temperature_excursions':     num_excursions,
        'longest_excursion_hours':        longest_excursion,
        'temperature_trend':              trend,
        'degradation_rate_per_hour':      degradation_rate_per_hour,
    }
    return features


def generate_live_prediction(milk_id: str, device_id: str, current_temp: float):
    """
    UPDATED FOR MODEL v2.0:
    - Uses 21 features (9 new temporal features added)
    - RF model is now binary: classes are int 0 (UNSAFE) and 1 (SAFE)
    - Safety label derived from temp threshold rules + model confidence
    - caution_probability always 0.0 (binary model, DB col kept for compatibility)
    - model_version stored as 'v2.0'
    """
    if not xgb_model or not rf_model:
        print("[v2.0] Models not loaded. Cannot predict.")
        return

    try:
        # ── Step 1: Compute all 21 features ──────────────────────────────
        feat_dict = calculate_features(milk_id, current_temp)

        # UPDATED FOR MODEL v2.0: use the full 21-feature ordered list
        df_features = pd.DataFrame([feat_dict], columns=MODEL_FEATURE_ORDER)

        # ── Step 2: Shelf life prediction (XGBoost Regressor) ────────────
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

        # ── Step 3: Safety classification (Random Forest — binary) ───────
        # UPDATED FOR MODEL v2.0: RF classes are integers 0=UNSAFE, 1=SAFE
        raw_pred  = rf_model.predict(df_features)[0]      # int 0 or 1
        raw_probs = rf_model.predict_proba(df_features)[0] # [P(0), P(1)]
        classes   = list(rf_model.classes_)                # [0, 1]

        prob_map   = {cls: float(prob) for cls, prob in zip(classes, raw_probs)}
        safe_prob  = prob_map.get(1, 0.0)    # P(SAFE)
        unsafe_prob= prob_map.get(0, 0.0)    # P(UNSAFE)
        caution_prob = 0.0                   # binary model — always 0 (DB compat)

        if unsafe_prob > 0.5:
            # Check if there's already an active alert for this milk_id to prevent SMS spam
            conn_alert = get_db_connection()
            should_alert = True
            if conn_alert:
                try:
                    c_alert = conn_alert.cursor(dictionary=True)
                    c_alert.execute("SELECT id FROM alerts WHERE milk_id = %s AND status = 'ACTIVE' LIMIT 1", (milk_id,))
                    if c_alert.fetchone():
                        should_alert = False
                except Exception:
                    pass
            
            if should_alert:
                send_alert(milk_id, current_temp, unsafe_prob)
                
                # --- Save to alerts table ---
                if conn_alert:
                    try:
                        c_alert = conn_alert.cursor()
                        alert_code = f"ALT-{int(datetime.now(timezone.utc).timestamp())}"
                        c_alert.execute("""
                            INSERT INTO alerts (alert_code, type, severity, milk_id, device_id, temperature_c, message, status)
                            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                        """, (alert_code, "SPOILAGE", "CRITICAL", milk_id, device_id, current_temp, f"Product {milk_id} safety breached >50%", "ACTIVE"))
                        conn_alert.commit()
                    except Exception as e:
                        print(f"[v2.0] Failed to save alert to database: {e}")
            if conn_alert:
                conn_alert.close()

        # UPDATED FOR MODEL v2.0: apply temperature threshold safety rules
        # These override the model when temperature is unambiguous
        if current_temp >= 8.0:
            status_pred = "UNSAFE"
            is_safe_flag = 0
        elif current_temp <= 5.0:
            status_pred = "SAFE"
            is_safe_flag = 1
        else:
            # Borderline 5–8 °C: trust model output, tie-break by shelf life
            if raw_pred == 1 and shelf_life > 72:
                status_pred  = "SAFE"
                is_safe_flag = 1
            else:
                status_pred  = "UNSAFE"
                is_safe_flag = 0

        confidence = safe_prob if status_pred == "SAFE" else unsafe_prob

        # ── Step 4: Alert level for dashboard ────────────────────────────
        if status_pred == "UNSAFE" and confidence >= 0.95:
            alert_level = "critical"
            status_color = "#7f1d1d"
        elif status_pred == "UNSAFE" and confidence >= 0.80:
            alert_level = "danger"
            status_color = "#ef4444"
        elif status_pred == "SAFE" and shelf_life <= 24:
            alert_level = "warning"
            status_color = "#f59e0b"
        elif status_pred == "SAFE" and shelf_life <= 72:
            alert_level = "info"
            status_color = "#3b82f6"
        else:
            alert_level = "none"
            status_color = "#22c55e"

        badge_text  = "✓ Good Condition" if status_pred == "SAFE" else "⚠ Unsafe"
        summary_msg = (
            f"Milk is safely stored. ~{shelf_life_days} days remaining."
            if status_pred == "SAFE"
            else f"Temperature breach detected. Shelf life: {shelf_life:.1f}h."
        )

        # ── Step 5: Persist to database ───────────────────────────────────
        conn = get_db_connection()
        if conn:
            cursor = conn.cursor()

            # Insert prediction row (caution_probability=0 for binary compat)
            cursor.execute(
                """
                INSERT INTO predictions
                (milk_id, device_id, prediction_time, current_temperature_c,
                 remaining_shelf_life_hours, safety_status, safe_probability,
                 caution_probability, unsafe_probability, model_version)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (
                    milk_id, device_id, datetime.now(timezone.utc), current_temp,
                    shelf_life, status_pred,
                    round(safe_prob, 4), round(caution_prob, 4), round(unsafe_prob, 4),
                    "v2.0",          # UPDATED FOR MODEL v2.0
                )
            )

            # Update product status (SAFE / UNSAFE; CAUTION kept in ENUM for compat)
            cursor.execute(
                "UPDATE milk_products SET status = %s WHERE milk_id = %s",
                (status_pred, milk_id)
            )

            # Update device heartbeat
            cursor.execute(
                "UPDATE devices SET last_temperature = %s, last_seen = %s WHERE device_id = %s",
                (current_temp, datetime.now(timezone.utc), device_id)
            )

            conn.commit()
            conn.close()

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
    UPDATED FOR MODEL v2.0: response now includes full dashboard JSON block
    alongside the existing `prediction` block (backward compatible).
    """
    conn = get_db_connection()
    if not conn:
        return {"success": False}
    cursor = conn.cursor(dictionary=True)
    cursor.execute(
        "SELECT * FROM predictions WHERE milk_id = %s ORDER BY prediction_time DESC LIMIT 1",
        (milk_id,)
    )
    data = cursor.fetchone()
    conn.close()

    if data:
        shelf_life  = float(data["remaining_shelf_life_hours"])
        safe_prob   = float(data["safe_probability"])
        unsafe_prob = float(data["unsafe_probability"])
        status      = data["safety_status"]   # "SAFE" or "UNSAFE"
        confidence  = safe_prob if status == "SAFE" else unsafe_prob

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

        # Alert level
        if status == "UNSAFE" and confidence >= 0.95:
            alert_level  = "critical"
            status_color = "#7f1d1d"
        elif status == "UNSAFE" and confidence >= 0.80:
            alert_level  = "danger"
            status_color = "#ef4444"
        elif status == "SAFE" and shelf_life <= 24:
            alert_level  = "warning"
            status_color = "#f59e0b"
        elif status == "SAFE" and shelf_life <= 72:
            alert_level  = "info"
            status_color = "#3b82f6"
        else:
            alert_level  = "none"
            status_color = "#22c55e"

        return {
            "success": True,
            # ── Existing block (backward compatible) ──────────────────────
            "prediction": {
                "remaining_shelf_life_hours": shelf_life,
                "safety_status":             status,
                "probabilities": {
                    "SAFE":    safe_prob,
                    "CAUTION": float(data["caution_probability"]),  # always 0 in v2
                    "UNSAFE":  unsafe_prob,
                }
            },
            # ── NEW v2.0 dashboard block ──────────────────────────────────
            "shelf_life": {
                "model":           "XGBoost Regressor v2.0",
                "remaining_hours": shelf_life,
                "remaining_days":  round(shelf_life / 24.0, 2),
                "status_tag":      status_tag,
            },
            "safety": {
                "model":      "Random Forest Classifier v2.0",
                "label":      status,
                "is_safe":    1 if status == "SAFE" else 0,
                "confidence": round(confidence, 4),
                "class_probabilities": {
                    "SAFE":   round(safe_prob,   4),
                    "UNSAFE": round(unsafe_prob, 4),
                },
            },
            "dashboard": {
                "overall_status":  status,
                "status_color":    status_color,
                "alert_level":     alert_level,
                "badge_text":      "✓ Good Condition" if status == "SAFE" else "⚠ Unsafe",
                "summary":         (
                    f"Milk is safely stored. ~{round(shelf_life/24.0,1)} days remaining."
                    if status == "SAFE"
                    else f"Temperature breach detected. Shelf life: {shelf_life:.1f}h."
                ),
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
