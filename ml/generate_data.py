"""
=============================================================================
ColdGuard AI — Synthetic Milk Quality Dataset Generator
=============================================================================

DATASET REFERENCE:
  This synthetic dataset is structurally and statistically aligned with the
  real-world Kaggle Milk Quality Prediction dataset:

  Title   : Milk Quality Prediction
  Source  : https://www.kaggle.com/datasets/cplinta/milkquality
  Author  : cplinta (Kaggle)
  License : Open Database License (ODbL)
  Features: pH, Temperature, Taste, Odor, Fat, Turbidity, Colour, Grade

  ALIGNMENT NOTES:
  ─────────────────────────────────────────────────────────────────────────
  Kaggle Column      →  Our Synthetic Feature(s)
  ─────────────────────────────────────────────────────────────────────────
  Temperature        →  current_temperature_c, avg_temperature_c
  Grade (0/1/2)      →  safety_label (SAFE / UNSAFE)
  Turbidity          →  approximated via degradation_rate_per_hour
  (not in Kaggle)    →  storage_hours, temporal lag features (new)
  ─────────────────────────────────────────────────────────────────────────

  The temperature-based spoilage model uses the Q10 rule (Q10 = 3),
  a well-established biochemical kinetics principle for milk spoilage.
  Base shelf life at 4 °C: 336 hours (14 days) for pasteurized whole milk.

SAFETY RULES:
  UNSAFE  → current_temperature_c ≥ 8 °C   (is_safe = 0)
  SAFE    → current_temperature_c ≤ 5 °C   (is_safe = 1)
  5–8 °C  → borderline: labeled by remaining shelf life (>72 h → SAFE)

TARGET COLUMNS:
  remaining_shelf_life_hours  → Model 1 (XGBoost Regressor)
  is_safe                     → Model 2 (Random Forest Classifier)

Generated rows: 35,000 (configurable)
=============================================================================
"""

import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os

# ─── Reproducibility ───────────────────────────────────────────────────────
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
random.seed(RANDOM_SEED)

# ─── Physical constants ────────────────────────────────────────────────────
BASE_SHELF_LIFE_HOURS = 336.0   # 14 days @ 4 °C for pasteurized whole milk
Q10_FACTOR            = 3.0     # Spoilage rate doubles ~every 10 °C (actually triples)
REFERENCE_TEMP        = 4.0     # °C — reference temperature for Q10

# ─── Scenario definitions ──────────────────────────────────────────────────
#  Each tuple: (label, probability, params)
SCENARIOS = [
    # 0: Ideal cold-chain (4 °C, very tight)
    ("ideal_cold",          0.20, {"mean": 4.0,  "std": 0.4,  "excursion": False}),
    # 1: Good cold-chain (slight variation 2–6 °C)
    ("good_cold",           0.22, {"mean": 4.5,  "std": 1.2,  "excursion": False}),
    # 2: Single short excursion (door left open ~2–8 hrs)
    ("short_excursion",     0.15, {"mean": 4.0,  "std": 0.5,  "excursion": True,
                                    "exc_temp_mean": 15.0, "exc_temp_std": 2.0,
                                    "exc_dur": (2, 8)}),
    # 3: Single long excursion (power cut, hours)
    ("long_excursion",      0.10, {"mean": 4.0,  "std": 0.5,  "excursion": True,
                                    "exc_temp_mean": 18.0, "exc_temp_std": 3.0,
                                    "exc_dur": (8, 20)}),
    # 4: Chronic slight abuse (consistently 6–8 °C)
    ("chronic_mild_abuse",  0.13, {"mean": 7.0,  "std": 0.8,  "excursion": False}),
    # 5: Moderate abuse (8–12 °C)
    ("moderate_abuse",      0.08, {"mean": 10.0, "std": 1.5,  "excursion": False}),
    # 6: Severe abuse (>12 °C, transport mishap)
    ("severe_abuse",        0.07, {"mean": 14.0, "std": 2.5,  "excursion": False}),
    # 7: Variable chain (shop display with door cycling)
    ("variable_chain",      0.05, {"mean": 5.5,  "std": 2.5,  "excursion": False}),
]

SCENARIO_LABELS  = [s[0] for s in SCENARIOS]
SCENARIO_PROBS   = [s[1] for s in SCENARIOS]
SCENARIO_PARAMS  = [s[2] for s in SCENARIOS]


# ─── Helper: generate hourly temperature profile ───────────────────────────
def _generate_temp_profile(total_hours: int, params: dict) -> list:
    """Return list of hourly temperature readings for one milk batch."""
    temps = []
    excursion_start = excursion_end = -1

    if params.get("excursion"):
        exc_dur_min, exc_dur_max = params["exc_dur"]
        exc_duration = random.randint(exc_dur_min, exc_dur_max)
        max_start = max(1, total_hours - exc_duration - 2)
        excursion_start = random.randint(1, max_start)
        excursion_end   = excursion_start + exc_duration

    for h in range(total_hours):
        if params.get("excursion") and excursion_start <= h <= excursion_end:
            temp = np.random.normal(params["exc_temp_mean"], params["exc_temp_std"])
        else:
            temp = np.random.normal(params["mean"], params["std"])
        # Physical bounds: milk doesn't freeze in normal storage
        temp = float(np.clip(temp, 0.5, 35.0))
        temps.append(temp)

    return temps


# ─── Helper: calculate cumulative spoilage ────────────────────────────────
def _calc_spoilage(temps: list) -> float:
    """Return total spoilage units consumed (Q10 model)."""
    consumed = 0.0
    for t in temps:
        rate = Q10_FACTOR ** ((t - REFERENCE_TEMP) / 10.0)
        consumed += rate                       # 1 hour × rate
    return consumed


# ─── Helper: excursion statistics ─────────────────────────────────────────
def _excursion_stats(temps: list, threshold: float):
    """Return (count_hours_above, num_excursions, longest_excursion_hours)."""
    count_above = 0
    num_exc     = 0
    longest     = 0
    current     = 0
    in_exc      = False

    for t in temps:
        if t > threshold:
            count_above += 1
            current += 1
            if not in_exc:
                num_exc += 1
                in_exc = True
        else:
            if current > longest:
                longest = current
            current = 0
            in_exc  = False

    if current > longest:
        longest = current

    return count_above, num_exc, longest


# ─── Main generator ────────────────────────────────────────────────────────
def generate_synthetic_data(
    num_samples: int = 35_000,
    output_path: str = None,
) -> pd.DataFrame:
    """
    Generate a synthetic milk quality monitoring dataset.

    Parameters
    ----------
    num_samples : int
        Number of milk-batch observation records to generate.
    output_path : str | None
        If given, saves the CSV to this path.

    Returns
    -------
    pd.DataFrame
        Dataset with 27 columns aligned to Kaggle Milk Quality schema.
    """
    print(f"[generate_data] Generating {num_samples:,} records …")

    # Calendar base: spread across ~6 months
    calendar_start = datetime(2026, 1, 1)

    records = []

    for i in range(num_samples):
        milk_id  = f"MILK_{i:05d}"

        # ── Pick scenario ───────────────────────────────────────────────
        s_idx   = np.random.choice(len(SCENARIOS), p=SCENARIO_PROBS)
        s_label = SCENARIO_LABELS[s_idx]
        params  = SCENARIO_PARAMS[s_idx]

        # ── Storage duration ────────────────────────────────────────────
        # Range: 10 h → 400 h (up to ~16.7 days)
        total_hours_stored = random.randint(10, 400)

        # ── Random start timestamp ──────────────────────────────────────
        offset_days  = random.randint(0, 180)
        offset_hours = random.randint(0, 23)
        start_time   = calendar_start + timedelta(days=offset_days, hours=offset_hours)
        end_time     = start_time + timedelta(hours=total_hours_stored)

        # ── Temperature profile ─────────────────────────────────────────
        temps = _generate_temp_profile(total_hours_stored + 1, params)
        temps_arr = np.array(temps)

        # ── Spoilage computation ────────────────────────────────────────
        spoilage_consumed      = _calc_spoilage(temps)
        remaining_shelf_life   = max(0.0, BASE_SHELF_LIFE_HOURS - spoilage_consumed)
        remaining_shelf_life   = round(remaining_shelf_life, 2)

        # ── Excursion stats ─────────────────────────────────────────────
        above_6h, num_exc_6, longest_6 = _excursion_stats(temps, 6.0)
        above_8h, num_exc_8, longest_8 = _excursion_stats(temps, 8.0)

        # ── Current / last readings ─────────────────────────────────────
        current_temp = round(temps[-1], 2)

        # Rolling lag features (last N hours)
        temp_last_1h = round(float(np.mean(temps[-1:])),  2)
        temp_last_3h = round(float(np.mean(temps[-3:])),  2)
        temp_last_6h = round(float(np.mean(temps[-6:])),  2)

        # Volatility: rolling std of last 6 readings
        temp_volatility = round(float(np.std(temps[-6:])), 4) if len(temps) >= 6 else 0.0

        # Temperature trend: slope over last 5 readings
        if len(temps) >= 5:
            x_idx  = np.arange(5)
            trend  = round(float(np.polyfit(x_idx, temps[-5:], 1)[0]), 4)
        else:
            trend = 0.0

        # ── Temporal features ───────────────────────────────────────────
        hour_of_day  = end_time.hour
        day_of_week  = end_time.weekday()           # 0=Monday
        is_weekend   = int(day_of_week >= 5)

        # Storage phase (fresh < 30 % of shelf life; mid 30–70 %; late > 70 %)
        pct_consumed = spoilage_consumed / BASE_SHELF_LIFE_HOURS
        if pct_consumed < 0.30:
            storage_phase = "fresh"
        elif pct_consumed < 0.70:
            storage_phase = "mid"
        else:
            storage_phase = "late"

        # Danger zone percentage
        time_in_danger_pct = round(above_8h / max(1, total_hours_stored) * 100, 2)

        # Degradation rate per hour
        degradation_rate = round(spoilage_consumed / max(1, total_hours_stored), 4)

        # ── Safety label (binary) ───────────────────────────────────────
        if current_temp >= 8.0:
            is_safe      = 0
            safety_label = "UNSAFE"
        elif current_temp <= 5.0:
            is_safe      = 1
            safety_label = "SAFE"
        else:
            # Borderline 5–8 °C: use remaining shelf life
            if remaining_shelf_life > 72:
                is_safe      = 1
                safety_label = "SAFE"
            else:
                is_safe      = 0
                safety_label = "UNSAFE"

        # ── Assemble record ─────────────────────────────────────────────
        records.append({
            # Identifiers
            "milk_id":                        milk_id,
            "scenario":                       s_label,
            "timestamp":                      end_time.isoformat(),

            # Temporal features
            "hour_of_day":                    hour_of_day,
            "day_of_week":                    day_of_week,
            "is_weekend":                     is_weekend,
            "storage_hours":                  total_hours_stored,
            "storage_phase":                  storage_phase,

            # Temperature statistics
            "current_temperature_c":          current_temp,
            "avg_temperature_c":              round(float(np.mean(temps_arr)), 2),
            "min_temperature_c":              round(float(np.min(temps_arr)),  2),
            "max_temperature_c":              round(float(np.max(temps_arr)),  2),
            "temperature_std_c":              round(float(np.std(temps_arr)),  2),

            # Lag / rolling features
            "temp_last_1h":                   temp_last_1h,
            "temp_last_3h":                   temp_last_3h,
            "temp_last_6h":                   temp_last_6h,
            "temp_volatility":                temp_volatility,

            # Excursion analytics
            "time_above_6c_hours":            above_6h,
            "time_above_8c_hours":            above_8h,
            "time_in_danger_zone_pct":        time_in_danger_pct,
            "num_temperature_excursions":     num_exc_8,
            "longest_excursion_hours":        longest_8,
            "cumulative_temperature_exposure": round(float(np.sum(temps_arr)), 2),
            "temperature_trend":              trend,

            # Degradation metrics
            "degradation_rate_per_hour":      degradation_rate,

            # ── TARGETS ──────────────────────────────────────────────────
            "remaining_shelf_life_hours":     remaining_shelf_life,   # Model 1
            "is_safe":                        is_safe,                # Model 2
            "safety_label":                   safety_label,
        })

    df = pd.DataFrame(records)

    # ── Dataset summary ─────────────────────────────────────────────────────
    print(f"[generate_data] ✓ {len(df):,} records created.")
    print(f"[generate_data] Columns : {list(df.columns)}")
    print(f"\n[generate_data] Safety label distribution:")
    print(df["safety_label"].value_counts())
    print(f"\n[generate_data] Scenario distribution:")
    print(df["scenario"].value_counts())
    print(f"\n[generate_data] Shelf life stats (hours):")
    print(df["remaining_shelf_life_hours"].describe().round(2))

    if output_path:
        df.to_csv(output_path, index=False)
        size_mb = os.path.getsize(output_path) / 1024 / 1024
        print(f"\n[generate_data] ✓ Saved to '{output_path}' ({size_mb:.1f} MB)")

    return df


# ─── Entrypoint ────────────────────────────────────────────────────────────
if __name__ == "__main__":
    script_dir  = os.path.dirname(os.path.abspath(__file__))
    output_file = os.path.join(script_dir, "synthetic_milk_data.csv")
    generate_synthetic_data(num_samples=35_000, output_path=output_file)
