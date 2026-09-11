import pandas as pd
import numpy as np
from sklearn.model_selection import train_test_split
from sklearn.ensemble import RandomForestClassifier
from sklearn.metrics import mean_squared_error, classification_report, accuracy_score
import xgboost as xgb
import pickle
import os

def train_and_export():
    data_path = 'synthetic_milk_data.csv'
    if not os.path.exists(data_path):
        print(f"Dataset {data_path} not found. Please run generate_data.py first.")
        return

    df = pd.read_csv(data_path)
    
    # Feature columns based on user request
    features = [
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

    X = df[features]
    
    # Target 1: Remaining Shelf Life (XGBoost Regressor)
    y_reg = df['remaining_shelf_life_hours']
    
    # Target 2: Safety Status (Random Forest Classifier)
    y_clf = df['safety_status']

    # --- 1. Train XGBoost Regressor ---
    print("Training XGBoost Regressor for Remaining Shelf Life...")
    X_train_r, X_test_r, y_train_r, y_test_r = train_test_split(X, y_reg, test_size=0.2, random_state=42)
    
    xgb_model = xgb.XGBRegressor(
        n_estimators=150,
        learning_rate=0.1,
        max_depth=5,
        random_state=42
    )
    xgb_model.fit(X_train_r, y_train_r)
    
    preds_r = xgb_model.predict(X_test_r)
    rmse = np.sqrt(mean_squared_error(y_test_r, preds_r))
    print(f"XGBoost Regressor RMSE: {rmse:.2f} hours")
    
    # Save XGBoost Model
    xgb_path = 'xgboost_shelf_life_model.pkl'
    with open(xgb_path, 'wb') as f:
        pickle.dump(xgb_model, f)
    print(f"Saved XGBoost model to {xgb_path}")


    # --- 2. Train Random Forest Classifier ---
    print("\nTraining Random Forest Classifier for Safety Status...")
    X_train_c, X_test_c, y_train_c, y_test_c = train_test_split(X, y_clf, test_size=0.2, random_state=42, stratify=y_clf)
    
    rf_model = RandomForestClassifier(
        n_estimators=100,
        max_depth=6,
        random_state=42,
        class_weight='balanced'
    )
    rf_model.fit(X_train_c, y_train_c)
    
    preds_c = rf_model.predict(X_test_c)
    acc = accuracy_score(y_test_c, preds_c)
    print(f"Random Forest Accuracy: {acc:.2%}")
    print("Classification Report:")
    print(classification_report(y_test_c, preds_c))
    
    # Save Random Forest Model
    rf_path = 'random_forest_safety_model.pkl'
    with open(rf_path, 'wb') as f:
        pickle.dump(rf_model, f)
    print(f"Saved Random Forest model to {rf_path}")
    
    # Also save the feature list so the backend knows the exact order
    with open('model_features.pkl', 'wb') as f:
        pickle.dump(features, f)

if __name__ == "__main__":
    train_and_export()
