# Dashboard Output Specification — ColdGuard AI ML Models

## Overview

The two ML models feed into the ColdGuard AI real-time dashboard. This document specifies:
- The JSON payload format returned by each model inference endpoint
- Update frequency recommendations
- Alert trigger logic
- Key Performance Indicators (KPIs) to display

---

## 1. Model API Endpoints

### Model 1 — Shelf Life Prediction (XGBoost Regressor)
```
GET/POST /api/predict/shelf-life
```

### Model 2 — Safety Status Classification (Random Forest)
```
GET/POST /api/predict/safety
```

### Combined (used by dashboard)
```
POST /api/predict/full
```

---

## 2. Request Payload (Input)

```json
{
  "milk_id": "MILK_00123",
  "device_id": "ESP32_001",
  "storage_hours": 48,
  "current_temperature_c": 4.2,
  "avg_temperature_c": 4.1,
  "min_temperature_c": 3.5,
  "max_temperature_c": 5.8,
  "temperature_std_c": 0.42,
  "temp_last_1h": 4.2,
  "temp_last_3h": 4.0,
  "temp_last_6h": 4.1,
  "temp_volatility": 0.21,
  "time_above_6c_hours": 1,
  "time_above_8c_hours": 0,
  "time_in_danger_zone_pct": 0.0,
  "num_temperature_excursions": 0,
  "longest_excursion_hours": 0,
  "cumulative_temperature_exposure": 197.8,
  "temperature_trend": -0.003,
  "degradation_rate_per_hour": 1.02,
  "hour_of_day": 14,
  "day_of_week": 2,
  "is_weekend": 0,
  "storage_phase": "fresh"
}
```

---

## 3. Response Payload (Output)

```json
{
  "milk_id": "MILK_00123",
  "device_id": "ESP32_001",
  "predicted_at": "2026-09-17T17:30:00+05:30",

  "shelf_life": {
    "model": "XGBoost Regressor v2.0",
    "remaining_hours": 284.5,
    "remaining_days": 11.9,
    "predicted_expiry_at": "2026-09-29T17:30:00+05:30",
    "confidence_interval_hours": {
      "lower_95": 271.0,
      "upper_95": 298.0
    },
    "status_tag": "FRESH"
  },

  "safety": {
    "model": "Random Forest Classifier v2.0",
    "label": "SAFE",
    "is_safe": 1,
    "confidence": 0.97,
    "class_probabilities": {
      "SAFE": 0.97,
      "UNSAFE": 0.03
    }
  },

  "dashboard": {
    "overall_status":  "SAFE",
    "status_color":    "#22c55e",
    "alert_level":     "none",
    "badge_text":      "✓ Good Condition",
    "summary":         "Milk is safely stored. ~11.9 days remaining."
  }
}
```

---

## 4. Status Tags & Color Codes

### Shelf Life Status Tags (`shelf_life.status_tag`)

| Tag | Condition | Color (Hex) | Badge |
|-----|-----------|-------------|-------|
| `FRESH` | > 120 h remaining | `#22c55e` (green) | ✓ Fresh |
| `GOOD` | 72–120 h remaining | `#84cc16` (lime) | ✓ Good |
| `CAUTION` | 24–72 h remaining | `#f59e0b` (amber) | ⚠ Use Soon |
| `CRITICAL` | 0–24 h remaining | `#ef4444` (red) | ⚠ Use Today |
| `EXPIRED` | 0 h remaining | `#7f1d1d` (dark red) | ✕ Expired |

### Safety Alert Levels (`dashboard.alert_level`)

| Level | Condition | Color | Action |
|-------|-----------|-------|--------|
| `none` | SAFE + shelf_life > 72h | `#22c55e` | No action |
| `info` | SAFE + shelf_life 24–72h | `#3b82f6` | Inform user |
| `warning` | SAFE + shelf_life < 24h | `#f59e0b` | Push notification |
| `danger` | UNSAFE (confidence > 80%) | `#ef4444` | Immediate alert |
| `critical` | UNSAFE (confidence > 95%) | `#7f1d1d` | Auto-flag + alert |

---

## 5. Alert Trigger Logic

```
IF safety.label == "UNSAFE" AND safety.confidence >= 0.80:
    trigger_alert(level="danger", push_notification=True)

IF safety.label == "UNSAFE" AND safety.confidence >= 0.95:
    trigger_alert(level="critical", push_notification=True, auto_quarantine=True)

IF shelf_life.remaining_hours <= 24 AND safety.label == "SAFE":
    trigger_alert(level="warning", push_notification=True)

IF shelf_life.remaining_hours <= 0:
    trigger_alert(level="critical", mark_expired=True)
```

---

## 6. Update Frequency

| Mode | Frequency | Trigger |
|------|-----------|---------|
| **Idle / Normal** | Every 15 minutes | Scheduled IoT polling |
| **Caution zone** | Every 5 minutes | shelf_life < 72h |
| **Alert active** | Every 1 minute | UNSAFE label detected |
| **On-demand** | Immediate | User opens dashboard |
| **ESP32 push** | Real-time | Sensor threshold crossed |

---

## 7. Dashboard KPIs

| KPI | Source | Display |
|-----|--------|---------|
| Current Temperature | Sensor (live) | °C gauge with safe zone |
| Safety Status | Model 2 output | Color-coded badge |
| Remaining Shelf Life | Model 1 output | Countdown timer |
| Confidence Score | Model 2 probability | % indicator |
| Time in Danger Zone | Feature `time_in_danger_zone_pct` | % bar |
| Excursion Count | Feature `num_temperature_excursions` | Number badge |
| Temperature Trend | Feature `temperature_trend` | Up/Down arrow |
| Predicted Expiry Date | Derived from Model 1 | Date + time |

---

## 8. Model Versioning & Retraining

| Field | Value |
|-------|-------|
| Model 1 (XGBoost) | `xgboost_shelf_life_model.pkl` |
| Model 2 (RF) | `random_forest_safety_model.pkl` |
| Feature list | `model_features.pkl` |
| Label encoder | `label_encoder.pkl` |
| Retrain trigger | Monthly OR when RMSE drifts > 20% |
| Dataset size | 35,000 rows (expand by 5K monthly) |

---

## 9. Error Handling (API)

```json
{
  "error": true,
  "code": "MODEL_UNAVAILABLE",
  "message": "ML model not loaded. Using rule-based fallback.",
  "fallback": {
    "label": "UNSAFE",
    "reason": "current_temperature_c >= 8.0 (rule-based)",
    "is_safe": 0
  }
}
```

Fallback rule: if model unavailable → apply hard temperature threshold:
- `≥ 8°C → UNSAFE`
- `≤ 5°C → SAFE`
- `5–8°C → CAUTION` (treat as UNSAFE for safety)
