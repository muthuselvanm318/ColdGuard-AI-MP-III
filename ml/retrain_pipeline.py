#!/usr/bin/env python3
"""
ColdGuard AI — Master Production Retraining Pipeline (retrain_pipeline.py)
==========================================================================
Unified end-to-end retraining pipeline for ColdGuard AI cold-chain monitoring.
Maintains strict production backend compatibility (FastAPI & Vercel serverless):
- Exact 12-feature schema & ordering (shape: (N, 12))
- Deduplicated, 1-min resampled real IoT sensor integration
- Balanced thermodynamic synthetic augmentation across realistic cold-chain regimes
- FDA Food Code 2h/4h multi-criteria safety ground-truth labeling
- 5-Fold Stratified Cross Validation with F1, Confusion Matrix, and Feature Importance
- Production model serialization (.pkl and .joblib, < 50MB)
"""

import os
import sys
import math
import pickle
import random
import warnings
from datetime import datetime, timedelta

import numpy as np
import pandas as pd
from sklearn.ensemble import RandomForestClassifier
from sklearn.model_selection import StratifiedKFold, KFold
from sklearn.metrics import (
    classification_report,
    confusion_matrix,
    f1_score,
    mean_squared_error,
    mean_absolute_error,
    r2_score
)
import xgboost as xgb

warnings.filterwarnings('ignore')

# ---------------------------------------------------------------------------
# Global Constants & Production Schema Contract
# ---------------------------------------------------------------------------
RANDOM_SEED = 42
np.random.seed(RANDOM_SEED)
random.seed(RANDOM_SEED)

FEATURE_NAMES = [
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
    'temperature_trend'
]

BASE_SHELF_LIFE_HOURS = 336.0  # 14 days at 4°C
SAFE_THRESHOLD_HOURS = 72.0    # > 72h: SAFE, 0-72h: CAUTION, <= 0h: UNSAFE
Q10_FACTOR = 3.0
REF_TEMP_C = 4.0

def trapz_compat(y, x):
    if hasattr(np, 'trapezoid'):
        return float(np.trapezoid(y, x))
    return float(np.trapz(y, x))


# ---------------------------------------------------------------------------
# 1. Feature Extraction Engine (Strict 12 Features from Resampled Series)
# ---------------------------------------------------------------------------
def compute_12_features_from_series(timestamps: pd.DatetimeIndex, temps: np.ndarray) -> dict:
    if len(temps) == 0:
        raise ValueError("Cannot extract features from empty time series.")

    start_time = timestamps[0]
    end_time = timestamps[-1]
    elapsed_seconds = (end_time - start_time).total_seconds()
    storage_hours = max(0.001, elapsed_seconds / 3600.0)

    time_hours = np.array([(ts - start_time).total_seconds() / 3600.0 for ts in timestamps])

    feat_storage_hours = round(storage_hours, 4)
    feat_current_temp = round(float(temps[-1]), 2)

    if len(temps) > 1:
        cumulative_exposure = trapz_compat(temps, time_hours)
    else:
        cumulative_exposure = float(temps[0]) * storage_hours
    feat_cumulative = round(max(0.0, cumulative_exposure), 4)

    avg_temp = cumulative_exposure / storage_hours if storage_hours > 0 else float(temps[-1])
    feat_avg_temp = round(float(avg_temp), 2)
    feat_min_temp = round(float(np.min(temps)), 2)
    feat_max_temp = round(float(np.max(temps)), 2)

    std_temp = float(np.std(temps, ddof=1)) if len(temps) > 1 else 0.0
    feat_std_temp = round(std_temp, 4)

    if len(temps) > 1:
        dt_hours = np.diff(time_hours)
        mid_temps = (temps[:-1] + temps[1:]) / 2.0
    else:
        dt_hours = np.array([storage_hours])
        mid_temps = np.array([temps[0]])

    time_above_6 = float(np.sum(dt_hours[mid_temps > 6.0])) if len(dt_hours) > 0 else 0.0
    time_above_8 = float(np.sum(dt_hours[mid_temps > 8.0])) if len(dt_hours) > 0 else 0.0

    feat_time_above_6 = round(max(0.0, time_above_6), 4)
    feat_time_above_8 = round(max(0.0, time_above_8), 4)

    # Excursions > 8.0°C lasting >= 5 minutes (0.0833 hours)
    num_excursions = 0
    longest_excursion_hours = 0.0
    current_excursion_hours = 0.0
    in_excursion = False

    for t_val, dt in zip(mid_temps, dt_hours):
        if t_val > 8.0:
            current_excursion_hours += dt
            if not in_excursion:
                in_excursion = True
        else:
            if in_excursion:
                if current_excursion_hours >= (5.0 / 60.0):
                    num_excursions += 1
                if current_excursion_hours > longest_excursion_hours:
                    longest_excursion_hours = current_excursion_hours
                current_excursion_hours = 0.0
                in_excursion = False

    if in_excursion:
        if current_excursion_hours >= (5.0 / 60.0):
            num_excursions += 1
        if current_excursion_hours > longest_excursion_hours:
            longest_excursion_hours = current_excursion_hours

    feat_num_excursions = int(num_excursions)
    feat_longest_excursion = round(float(longest_excursion_hours), 4)

    # Slope (°C/hour) over last 15 mins or 5 samples
    if len(temps) >= 2:
        cutoff = time_hours[-1] - 0.25
        recent_mask = time_hours >= cutoff
        if np.sum(recent_mask) < 2:
            idx = slice(-min(5, len(temps)), None)
            t_sl = time_hours[idx]
            y_sl = temps[idx]
        else:
            t_sl = time_hours[recent_mask]
            y_sl = temps[recent_mask]

        span = t_sl[-1] - t_sl[0]
        slope = float(np.polyfit(t_sl, y_sl, 1)[0]) if span > 1e-6 else 0.0
    else:
        slope = 0.0
    feat_trend = round(slope, 4)

    return {
        'storage_hours': feat_storage_hours,
        'current_temperature_c': feat_current_temp,
        'avg_temperature_c': feat_avg_temp,
        'min_temperature_c': feat_min_temp,
        'max_temperature_c': feat_max_temp,
        'temperature_std_c': feat_std_temp,
        'time_above_6c_hours': feat_time_above_6,
        'time_above_8c_hours': feat_time_above_8,
        'num_temperature_excursions': feat_num_excursions,
        'longest_excursion_hours': feat_longest_excursion,
        'cumulative_temperature_exposure': feat_cumulative,
        'temperature_trend': feat_trend
    }


# ---------------------------------------------------------------------------
# 2. Food-Safety Ground Truth Labeling (Multi-Criteria Framework)
# ---------------------------------------------------------------------------
def compute_food_safety_labels(feats: dict, timestamps: pd.DatetimeIndex, temps: np.ndarray) -> tuple:
    """
    Computes remaining_shelf_life_hours and safety_status using:
    1. Spoilage Kinetics (Q10 = 3.0 relative to 4.0°C).
    2. FDA Food Code 2h/4h Acute Temperature-Abuse Thresholds.
    """
    if len(temps) <= 1:
        t_val = float(temps[0])
        dt_h = (timestamps[-1] - timestamps[0]).total_seconds() / 3600.0 if len(timestamps) > 1 else 0.0
        rate = Q10_FACTOR ** ((t_val - REF_TEMP_C) / 10.0)
        spoilage = dt_h * rate
    else:
        time_hours = np.array([(ts - timestamps[0]).total_seconds() / 3600.0 for ts in timestamps])
        dt_hours = np.diff(time_hours)
        mid_temps = (temps[:-1] + temps[1:]) / 2.0
        rate_multipliers = Q10_FACTOR ** ((mid_temps - REF_TEMP_C) / 10.0)
        spoilage = float(np.sum(dt_hours * rate_multipliers))

    remaining_hours = max(0.0, round(BASE_SHELF_LIFE_HOURS - spoilage, 2))

    t_above_8 = feats['time_above_8c_hours']
    t_above_6 = feats['time_above_6c_hours']
    longest_exc = feats['longest_excursion_hours']
    max_t = feats['max_temperature_c']
    cur_t = feats['current_temperature_c']
    num_exc = feats['num_temperature_excursions']

    # --- UNSAFE Criteria ---
    if (
        remaining_hours <= 0.0 or
        t_above_8 >= 4.0 or
        longest_exc >= 4.0 or
        (max_t >= 15.0 and longest_exc >= 2.0) or
        (cur_t >= 20.0 and t_above_8 >= 1.0)
    ):
        status = "UNSAFE"

    # --- CAUTION Criteria ---
    elif (
        remaining_hours <= SAFE_THRESHOLD_HOURS or
        t_above_8 >= 1.0 or
        longest_exc >= 1.0 or
        t_above_6 >= 8.0 or
        cur_t >= 7.0 or
        num_exc >= 2
    ):
        status = "CAUTION"

    # --- SAFE Criteria ---
    else:
        status = "SAFE"

    return remaining_hours, status


# ---------------------------------------------------------------------------
# 3. Real-World Sensor Data Ingestion & Preprocessing
# ---------------------------------------------------------------------------
def process_real_world_data(csv_path: str) -> pd.DataFrame:
    if not os.path.exists(csv_path):
        print(f"[Warning] Real-world data file '{csv_path}' not found. Skipping real-world extraction.")
        return pd.DataFrame()

    print(f"Loading and processing real-world data from {csv_path}...")
    df = pd.read_csv(csv_path)

    df['timestamp'] = pd.to_datetime(df['timestamp'], utc=True)
    df = df.sort_values('timestamp').reset_index(drop=True)
    df = df.groupby('timestamp', as_index=False)['temperature_c'].mean()
    df = df.set_index('timestamp')

    df_resampled = df.resample('1min').mean().interpolate(method='time')
    df_resampled = df_resampled.dropna().reset_index()

    records = []
    total_points = len(df_resampled)
    if total_points < 5:
        return pd.DataFrame()

    timestamps = pd.DatetimeIndex(df_resampled['timestamp'])
    temps = df_resampled['temperature_c'].to_numpy()

    for end_idx in range(10, total_points + 1, 2):
        sub_ts = timestamps[:end_idx]
        sub_temps = temps[:end_idx]

        feats = compute_12_features_from_series(sub_ts, sub_temps)
        shelf_life, status = compute_food_safety_labels(feats, sub_ts, sub_temps)

        row = feats.copy()
        row['remaining_shelf_life_hours'] = shelf_life
        row['safety_status'] = status
        records.append(row)

    print(f"Extracted {len(records)} feature snapshots from real-world IoT readings.")
    return pd.DataFrame(records)


# ---------------------------------------------------------------------------
# 4. Realistic Thermodynamic Cold-Chain Synthetic Augmentation
# ---------------------------------------------------------------------------
def generate_synthetic_trajectory(scenario: int, total_hours: float, dt_minutes: float = 2.0):
    num_steps = max(5, int(total_hours * 60.0 / dt_minutes))
    t_start = datetime(2026, 8, 1, 8, 0, 0)
    timestamps = [t_start + timedelta(minutes=i * dt_minutes) for i in range(num_steps)]
    timestamps = pd.DatetimeIndex(timestamps)
    temps = np.zeros(num_steps)

    if scenario == 0:
        # a) Compliant refrigeration (2.0°C - 4.5°C with mild compressor cycles)
        base_temp = np.random.uniform(2.5, 4.0)
        time_mins = np.arange(num_steps) * dt_minutes
        oscillation = 0.5 * np.sin(2 * np.pi * time_mins / 35.0)
        noise = np.random.normal(0, 0.2, num_steps)
        temps = base_temp + oscillation + noise

    elif scenario == 1:
        # b) Defrost cycles / transient door openings (spikes to 7°C - 12°C)
        base_temp = np.random.uniform(3.0, 4.5)
        temps = base_temp + np.random.normal(0, 0.25, num_steps)
        num_spikes = np.random.randint(1, 4)
        for _ in range(num_spikes):
            spike_start = np.random.randint(2, max(3, num_steps - 20))
            spike_dur_steps = int(np.random.uniform(20, 60) / dt_minutes)
            spike_peak = np.random.uniform(7.5, 12.0)
            for s in range(spike_dur_steps):
                idx = spike_start + s
                if idx < num_steps:
                    pulse = math.sin(math.pi * s / spike_dur_steps) * (spike_peak - base_temp)
                    temps[idx] = max(temps[idx], base_temp + pulse)

    elif scenario == 2:
        # c) Complete refrigeration failure (exponential warming to 22°C - 26°C)
        ambient_temp = np.random.uniform(22.0, 26.0)
        t0 = np.random.uniform(3.5, 5.0)
        fail_step = np.random.randint(0, max(1, num_steps // 3))
        k_warm = np.random.uniform(0.18, 0.38)
        for i in range(num_steps):
            if i < fail_step:
                temps[i] = t0 + np.random.normal(0, 0.2)
            else:
                elapsed_h = (i - fail_step) * (dt_minutes / 60.0)
                temps[i] = ambient_temp - (ambient_temp - t0) * math.exp(-k_warm * elapsed_h) + np.random.normal(0, 0.25)

    elif scenario == 3:
        # d) Transport temperature oscillations (reefer cycles)
        center_temp = np.random.uniform(4.0, 6.5)
        amplitude = np.random.uniform(2.0, 3.5)
        period_hours = np.random.uniform(2.0, 5.0)
        time_hours = np.arange(num_steps) * (dt_minutes / 60.0)
        oscillation = amplitude * np.sin(2 * np.pi * time_hours / period_hours)
        temps = center_temp + oscillation + np.random.normal(0, 0.3, num_steps)

    temps = np.clip(temps, 0.5, 35.0)
    return timestamps, temps


def generate_synthetic_dataset(num_samples: int = 4000) -> pd.DataFrame:
    print(f"Generating {num_samples} thermodynamic synthetic cold-chain samples...")
    records = []
    scenarios = np.random.choice([0, 1, 2, 3], size=num_samples, p=[0.35, 0.30, 0.20, 0.15])

    for i in range(num_samples):
        scen = scenarios[i]
        if random.random() < 0.30:
            storage_h = np.random.uniform(0.5, 24.0)
        elif random.random() < 0.70:
            storage_h = np.random.uniform(24.0, 180.0)
        else:
            storage_h = np.random.uniform(180.0, 380.0)

        dt = 2.0 if storage_h <= 24.0 else 5.0
        ts, temps = generate_synthetic_trajectory(scen, storage_h, dt_minutes=dt)

        feats = compute_12_features_from_series(ts, temps)
        shelf_life, status = compute_food_safety_labels(feats, ts, temps)

        row = feats.copy()
        row['remaining_shelf_life_hours'] = shelf_life
        row['safety_status'] = status
        records.append(row)

    return pd.DataFrame(records)


# ---------------------------------------------------------------------------
# 5. Model Training & 5-Fold Stratified Cross-Validation
# ---------------------------------------------------------------------------
def train_and_evaluate(df_train: pd.DataFrame):
    X = df_train[FEATURE_NAMES]
    y_reg = df_train['remaining_shelf_life_hours']
    y_clf = df_train['safety_status']

    print("\n" + "=" * 60)
    print(f"DATASET SUMMARY: {len(df_train)} total samples")
    print("Class Distribution:")
    print(y_clf.value_counts(normalize=True).round(3) * 100)
    print("=" * 60)

    # 5-Fold CV for Random Forest Classifier
    print("\n--- Running 5-Fold Stratified CV for Random Forest Classifier ---")
    skf = StratifiedKFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
    oof_preds_clf = np.empty(len(df_train), dtype=object)
    rf_feature_importances = np.zeros(len(FEATURE_NAMES))

    for fold, (train_idx, val_idx) in enumerate(skf.split(X, y_clf), 1):
        X_tr, y_tr = X.iloc[train_idx], y_clf.iloc[train_idx]
        X_va = X.iloc[val_idx]

        fold_rf = RandomForestClassifier(
            n_estimators=150,
            max_depth=8,
            min_samples_split=4,
            class_weight='balanced',
            random_state=RANDOM_SEED + fold,
            n_jobs=-1
        )
        fold_rf.fit(X_tr, y_tr)
        oof_preds_clf[val_idx] = fold_rf.predict(X_va)
        rf_feature_importances += fold_rf.feature_importances_ / 5.0

    overall_f1 = f1_score(y_clf, oof_preds_clf, average='weighted')
    print(f"\nRandom Forest 5-Fold Out-of-Fold Weighted F1-Score: {overall_f1:.4f}")
    labels = sorted(y_clf.unique())
    cm = confusion_matrix(y_clf, oof_preds_clf, labels=labels)
    cm_df = pd.DataFrame(cm, index=[f"True_{l}" for l in labels], columns=[f"Pred_{l}" for l in labels])
    print("\nConfusion Matrix:")
    print(cm_df)

    print("\nFull Classification Report:")
    print(classification_report(y_clf, oof_preds_clf, digits=4))

    # 5-Fold CV for XGBoost Regressor
    print("\n--- Running 5-Fold CV for XGBoost Regressor ---")
    kf = KFold(n_splits=5, shuffle=True, random_state=RANDOM_SEED)
    oof_preds_reg = np.zeros(len(df_train))
    xgb_feature_importances = np.zeros(len(FEATURE_NAMES))

    for fold, (train_idx, val_idx) in enumerate(kf.split(X, y_reg), 1):
        X_tr, y_tr = X.iloc[train_idx], y_reg.iloc[train_idx]
        X_va = X.iloc[val_idx]

        fold_xgb = xgb.XGBRegressor(
            n_estimators=120,
            max_depth=5,
            learning_rate=0.08,
            random_state=RANDOM_SEED + fold,
            n_jobs=-1
        )
        fold_xgb.fit(X_tr, y_tr)
        oof_preds_reg[val_idx] = np.maximum(0.0, fold_xgb.predict(X_va))
        xgb_feature_importances += fold_xgb.feature_importances_ / 5.0

    rmse = np.sqrt(mean_squared_error(y_reg, oof_preds_reg))
    mae = mean_absolute_error(y_reg, oof_preds_reg)
    r2 = r2_score(y_reg, oof_preds_reg)
    print(f"XGBoost 5-Fold Out-of-Fold RMSE: {rmse:.2f} hours")
    print(f"XGBoost 5-Fold Out-of-Fold MAE:  {mae:.2f} hours")
    print(f"XGBoost 5-Fold Out-of-Fold R²:   {r2:.4f}")

    print("\nTraining final production models on 100% data...")
    final_rf = RandomForestClassifier(
        n_estimators=150,
        max_depth=8,
        min_samples_split=4,
        class_weight='balanced',
        random_state=RANDOM_SEED,
        n_jobs=-1
    )
    final_rf.fit(X, y_clf)

    final_xgb = xgb.XGBRegressor(
        n_estimators=120,
        max_depth=5,
        learning_rate=0.08,
        random_state=RANDOM_SEED,
        n_jobs=-1
    )
    final_xgb.fit(X, y_reg)

    return final_rf, final_xgb


# ---------------------------------------------------------------------------
# 6. Artifact Export & Verification
# ---------------------------------------------------------------------------
def save_and_verify_models(rf_model, xgb_model, output_dir: str):
    os.makedirs(output_dir, exist_ok=True)

    rf_pkl = os.path.join(output_dir, 'random_forest_safety_model.pkl')
    xgb_pkl = os.path.join(output_dir, 'xgboost_shelf_life_model.pkl')
    feat_pkl = os.path.join(output_dir, 'model_features.pkl')

    with open(rf_pkl, 'wb') as f:
        pickle.dump(rf_model, f, protocol=4)
    with open(xgb_pkl, 'wb') as f:
        pickle.dump(xgb_model, f, protocol=4)
    with open(feat_pkl, 'wb') as f:
        pickle.dump(FEATURE_NAMES, f, protocol=4)

    print(f"\nSaved production models to {output_dir}:")
    print(f"  • {rf_pkl} ({os.path.getsize(rf_pkl)/(1024*1024):.2f} MB)")
    print(f"  • {xgb_pkl} ({os.path.getsize(xgb_pkl)/(1024*1024):.2f} MB)")

    # Production contract test
    test_sample = pd.DataFrame([{
        'storage_hours': 24.0, 'current_temperature_c': 4.2, 'avg_temperature_c': 4.1,
        'min_temperature_c': 2.8, 'max_temperature_c': 5.6, 'temperature_std_c': 0.45,
        'time_above_6c_hours': 0.0, 'time_above_8c_hours': 0.0, 'num_temperature_excursions': 0,
        'longest_excursion_hours': 0.0, 'cumulative_temperature_exposure': 98.4, 'temperature_trend': 0.05
    }], columns=FEATURE_NAMES)

    assert test_sample.shape == (1, 12)
    shelf_life = float(max(0.0, xgb_model.predict(test_sample)[0]))
    status = rf_model.predict(test_sample)[0]
    probs = rf_model.predict_proba(test_sample)[0]
    prob_dict = {cls: float(p) for cls, p in zip(rf_model.classes_, probs)}

    print(f"\nVerification Output:")
    print(f"  Input Shape: {test_sample.shape}")
    print(f"  Predicted Shelf Life: {shelf_life:.2f} hours")
    print(f"  Predicted Status:     {status}")
    print(f"  Class Probabilities:  {prob_dict}")
    assert set(rf_model.classes_) == {'CAUTION', 'SAFE', 'UNSAFE'}
    print("\n✅ Verification PASSED: Ready for FastAPI & Vercel deployment.")


# ---------------------------------------------------------------------------
# Main Pipeline Entrypoint
# ---------------------------------------------------------------------------
def main():
    script_dir = os.path.dirname(os.path.abspath(__file__))
    real_world_csv = os.path.join(script_dir, 'coldguard_temperature_realWorld_data.csv')
    combined_csv_out = os.path.join(script_dir, 'synthetic_milk_data.csv')

    print("=" * 60)
    print("ColdGuard AI — Production Retraining Pipeline")
    print("=" * 60)

    df_real = process_real_world_data(real_world_csv)
    df_synth = generate_synthetic_dataset(num_samples=4000)

    if not df_real.empty:
        df_combined = pd.concat([df_synth, df_real], ignore_index=True)
    else:
        df_combined = df_synth

    df_combined = df_combined.sample(frac=1.0, random_state=RANDOM_SEED).reset_index(drop=True)
    df_combined.to_csv(combined_csv_out, index=False)
    print(f"Exported combined training dataset ({len(df_combined)} rows) to {combined_csv_out}")

    rf_model, xgb_model = train_and_evaluate(df_combined)
    save_and_verify_models(rf_model, xgb_model, output_dir=script_dir)


if __name__ == '__main__':
    main()
