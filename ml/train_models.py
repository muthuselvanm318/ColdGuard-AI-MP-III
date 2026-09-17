"""
=============================================================================
ColdGuard AI — Model Training & Evaluation Pipeline
=============================================================================

Models trained:
  1. XGBoost Regressor  → predict remaining_shelf_life_hours
  2. Random Forest Classifier → predict is_safe (binary: SAFE / UNSAFE)

Split strategy : 70 % train / 15 % validation / 15 % test
Imbalance      : SMOTE applied to classifier training set
Outputs saved  :
  ml/xgboost_shelf_life_model.pkl
  ml/random_forest_safety_model.pkl
  ml/model_features.pkl
  ml/label_encoder.pkl
  ml/plots/feature_importance_regressor.png
  ml/plots/feature_importance_classifier.png
  ml/plots/confusion_matrix.png
  ml/plots/roc_curve.png
  ml/training_summary.json

Reference dataset : ml/synthetic_milk_data.csv  (35,000 rows)
Kaggle source     : https://www.kaggle.com/datasets/cplinta/milkquality
=============================================================================
"""

import os
import sys
import json
import pickle
import warnings
import numpy as np
import pandas as pd
import matplotlib
matplotlib.use("Agg")          # non-interactive backend for CI / server environments
import matplotlib.pyplot as plt

from datetime import datetime
from sklearn.model_selection    import train_test_split
from sklearn.preprocessing      import LabelEncoder
from sklearn.ensemble           import RandomForestClassifier
from sklearn.metrics            import (
    mean_squared_error, mean_absolute_error, r2_score,
    accuracy_score, classification_report,
    confusion_matrix, roc_auc_score, roc_curve, ConfusionMatrixDisplay,
)
import xgboost as xgb

warnings.filterwarnings("ignore")

# ─── Paths ─────────────────────────────────────────────────────────────────
SCRIPT_DIR  = os.path.dirname(os.path.abspath(__file__))
DATA_PATH   = os.path.join(SCRIPT_DIR, "synthetic_milk_data.csv")
PLOTS_DIR   = os.path.join(SCRIPT_DIR, "plots")
os.makedirs(PLOTS_DIR, exist_ok=True)

XGB_PATH     = os.path.join(SCRIPT_DIR, "xgboost_shelf_life_model.pkl")
RF_PATH      = os.path.join(SCRIPT_DIR, "random_forest_safety_model.pkl")
FEAT_PATH    = os.path.join(SCRIPT_DIR, "model_features.pkl")
LE_PATH      = os.path.join(SCRIPT_DIR, "label_encoder.pkl")
SUMMARY_PATH = os.path.join(SCRIPT_DIR, "training_summary.json")

# ─── Feature columns ────────────────────────────────────────────────────────
REGRESSOR_FEATURES = [
    "storage_hours",
    "hour_of_day",
    "day_of_week",
    "is_weekend",
    "current_temperature_c",
    "avg_temperature_c",
    "min_temperature_c",
    "max_temperature_c",
    "temperature_std_c",
    "temp_last_1h",
    "temp_last_3h",
    "temp_last_6h",
    "temp_volatility",
    "time_above_6c_hours",
    "time_above_8c_hours",
    "time_in_danger_zone_pct",
    "num_temperature_excursions",
    "longest_excursion_hours",
    "cumulative_temperature_exposure",
    "temperature_trend",
    "degradation_rate_per_hour",
]

CLASSIFIER_FEATURES = REGRESSOR_FEATURES  # identical feature set

# ─── Utility helpers ────────────────────────────────────────────────────────
def _print_section(title: str):
    width = 72
    print("\n" + "═" * width)
    print(f"  {title}")
    print("═" * width)


def _save_feature_importance(model, feature_names: list, title: str, out_path: str):
    if hasattr(model, "feature_importances_"):
        importances = model.feature_importances_
    else:
        return

    indices = np.argsort(importances)[::-1]
    sorted_feats = [feature_names[i] for i in indices]
    sorted_imps  = importances[indices]

    fig, ax = plt.subplots(figsize=(10, 6))
    colors  = plt.cm.viridis(np.linspace(0.3, 0.9, len(sorted_feats)))
    ax.barh(sorted_feats[::-1], sorted_imps[::-1], color=colors[::-1], edgecolor="white", linewidth=0.4)
    ax.set_xlabel("Importance Score", fontsize=11)
    ax.set_title(title, fontsize=13, fontweight="bold")
    ax.spines[["top", "right"]].set_visible(False)
    plt.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  → Feature importance plot saved: {out_path}")


def _save_confusion_matrix(y_true, y_pred, labels: list, out_path: str):
    cm   = confusion_matrix(y_true, y_pred)
    disp = ConfusionMatrixDisplay(cm, display_labels=labels)
    fig, ax = plt.subplots(figsize=(6, 5))
    disp.plot(ax=ax, colorbar=False, cmap="Blues")
    ax.set_title("Confusion Matrix — Safety Classifier", fontsize=13, fontweight="bold")
    plt.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  → Confusion matrix saved: {out_path}")


def _save_roc_curve(y_true, y_proba, out_path: str):
    fpr, tpr, _ = roc_curve(y_true, y_proba)
    auc_score   = roc_auc_score(y_true, y_proba)
    fig, ax = plt.subplots(figsize=(6, 5))
    ax.plot(fpr, tpr, color="#3b82f6", lw=2, label=f"ROC Curve (AUC = {auc_score:.4f})")
    ax.plot([0, 1], [0, 1], "k--", lw=1)
    ax.set_xlabel("False Positive Rate", fontsize=11)
    ax.set_ylabel("True Positive Rate", fontsize=11)
    ax.set_title("ROC Curve — Safety Classifier", fontsize=13, fontweight="bold")
    ax.legend(loc="lower right")
    ax.spines[["top", "right"]].set_visible(False)
    plt.tight_layout()
    fig.savefig(out_path, dpi=150)
    plt.close(fig)
    print(f"  → ROC curve saved: {out_path}")
    return auc_score


# ─── Data loading & splitting ───────────────────────────────────────────────
def load_and_split(df: pd.DataFrame, features: list, target_col: str,
                   val_size: float = 0.15, test_size: float = 0.15,
                   stratify_col=None):
    """
    Returns (X_train, X_val, X_test, y_train, y_val, y_test)
    Split: 70 % train / 15 % val / 15 % test
    """
    X = df[features].copy()
    y = df[target_col].copy()

    # First split: 70 % train vs 30 % temp
    strat = df[stratify_col] if stratify_col else None
    X_train, X_temp, y_train, y_temp = train_test_split(
        X, y, test_size=(val_size + test_size), random_state=42,
        stratify=(strat if stratify_col else None),
    )
    # Second split: 50/50 → val / test  (each = 15 % of total)
    strat_temp = y_temp if stratify_col else None
    X_val, X_test, y_val, y_test = train_test_split(
        X_temp, y_temp, test_size=0.5, random_state=42,
        stratify=(strat_temp if stratify_col else None),
    )
    return X_train, X_val, X_test, y_train, y_val, y_test


# ─── Model 1 — XGBoost Regressor ────────────────────────────────────────────
def train_shelf_life_regressor(df: pd.DataFrame) -> dict:
    _print_section("Model 1 — XGBoost Regressor (Shelf Life Prediction)")

    X_train, X_val, X_test, y_train, y_val, y_test = load_and_split(
        df, REGRESSOR_FEATURES, "remaining_shelf_life_hours"
    )
    print(f"  Train: {len(X_train):,}  |  Val: {len(X_val):,}  |  Test: {len(X_test):,}")

    # ── Hyperparameters (tuned for 35K dataset) ─────────────────────────
    model = xgb.XGBRegressor(
        n_estimators      = 300,
        learning_rate     = 0.05,
        max_depth         = 6,
        min_child_weight  = 3,
        subsample         = 0.8,
        colsample_bytree  = 0.8,
        gamma             = 0.1,
        reg_alpha         = 0.1,
        reg_lambda        = 1.0,
        tree_method       = "hist",
        random_state      = 42,
        n_jobs            = -1,
    )

    # Fit with early stopping on validation set
    model.fit(
        X_train, y_train,
        eval_set      = [(X_val, y_val)],
        verbose       = 50,
    )

    # ── Evaluation ───────────────────────────────────────────────────────
    preds_val  = model.predict(X_val)
    preds_test = model.predict(X_test)

    # Clip negative predictions (shelf life cannot be negative)
    preds_val  = np.clip(preds_val,  0, None)
    preds_test = np.clip(preds_test, 0, None)

    val_rmse  = np.sqrt(mean_squared_error(y_val,  preds_val))
    val_mae   = mean_absolute_error(y_val,  preds_val)
    val_r2    = r2_score(y_val,  preds_val)

    test_rmse = np.sqrt(mean_squared_error(y_test, preds_test))
    test_mae  = mean_absolute_error(y_test, preds_test)
    test_r2   = r2_score(y_test, preds_test)

    print(f"\n  ── Validation Metrics ──")
    print(f"  RMSE : {val_rmse:.2f} hours")
    print(f"  MAE  : {val_mae:.2f}  hours")
    print(f"  R²   : {val_r2:.4f}")

    print(f"\n  ── Test Metrics ──")
    print(f"  RMSE : {test_rmse:.2f} hours")
    print(f"  MAE  : {test_mae:.2f}  hours")
    print(f"  R²   : {test_r2:.4f}")

    # ── Save plots ───────────────────────────────────────────────────────
    _save_feature_importance(
        model, REGRESSOR_FEATURES,
        "Feature Importance — XGBoost Shelf Life Regressor",
        os.path.join(PLOTS_DIR, "feature_importance_regressor.png"),
    )

    # ── Save model ───────────────────────────────────────────────────────
    with open(XGB_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"\n  ✓ Model saved → {XGB_PATH}")

    return {
        "model": "XGBoost Regressor v2.0",
        "trained_at": datetime.now().isoformat(),
        "train_samples": len(X_train),
        "val_samples": len(X_val),
        "test_samples": len(X_test),
        "features": REGRESSOR_FEATURES,
        "hyperparameters": {
            "n_estimators": 300,
            "learning_rate": 0.05,
            "max_depth": 6,
            "subsample": 0.8,
            "colsample_bytree": 0.8,
        },
        "val_metrics":  {"rmse": round(val_rmse, 4),  "mae": round(val_mae, 4),  "r2": round(val_r2, 4)},
        "test_metrics": {"rmse": round(test_rmse, 4), "mae": round(test_mae, 4), "r2": round(test_r2, 4)},
    }


# ─── Model 2 — Random Forest Classifier ─────────────────────────────────────
def train_safety_classifier(df: pd.DataFrame) -> dict:
    _print_section("Model 2 — Random Forest Classifier (Safety Status)")

    # Label encoding: SAFE=1, UNSAFE=0 (already binary in `is_safe`)
    le = LabelEncoder()
    le.fit(["UNSAFE", "SAFE"])     # 0 = UNSAFE, 1 = SAFE
    with open(LE_PATH, "wb") as f:
        pickle.dump(le, f)

    X_train, X_val, X_test, y_train, y_val, y_test = load_and_split(
        df, CLASSIFIER_FEATURES, "is_safe", stratify_col="is_safe"
    )
    print(f"  Train: {len(X_train):,}  |  Val: {len(X_val):,}  |  Test: {len(X_test):,}")
    print(f"  Train label dist: {dict(zip(*np.unique(y_train, return_counts=True)))}")

    # ── SMOTE oversampling (handle minority class) ───────────────────────
    try:
        from imblearn.over_sampling import SMOTE
        smote = SMOTE(random_state=42, k_neighbors=5)
        X_train_res, y_train_res = smote.fit_resample(X_train, y_train)
        print(f"  SMOTE applied → {len(X_train_res):,} samples "
              f"(was {len(X_train):,})")
        print(f"  Resampled dist: {dict(zip(*np.unique(y_train_res, return_counts=True)))}")
    except ImportError:
        print("  [WARNING] imbalanced-learn not installed. Skipping SMOTE.")
        print("  Run: pip install imbalanced-learn>=0.12.0")
        X_train_res, y_train_res = X_train, y_train

    # ── Hyperparameters ──────────────────────────────────────────────────
    model = RandomForestClassifier(
        n_estimators    = 200,
        max_depth       = 12,
        min_samples_leaf= 2,
        min_samples_split=5,
        max_features    = "sqrt",
        class_weight    = "balanced",
        random_state    = 42,
        n_jobs          = -1,
    )
    model.fit(X_train_res, y_train_res)

    # ── Evaluation — Validation ──────────────────────────────────────────
    preds_val      = model.predict(X_val)
    probas_val     = model.predict_proba(X_val)[:, 1]   # P(SAFE)
    val_acc        = accuracy_score(y_val,  preds_val)
    val_auc        = roc_auc_score(y_val,   probas_val)

    # ── Evaluation — Test ────────────────────────────────────────────────
    preds_test     = model.predict(X_test)
    probas_test    = model.predict_proba(X_test)[:, 1]
    test_acc       = accuracy_score(y_test, preds_test)
    test_auc       = roc_auc_score(y_test,  probas_test)

    print(f"\n  ── Validation Metrics ──")
    print(f"  Accuracy : {val_acc:.4f}  ({val_acc*100:.2f}%)")
    print(f"  ROC-AUC  : {val_auc:.4f}")

    print(f"\n  ── Test Metrics ──")
    print(f"  Accuracy : {test_acc:.4f}  ({test_acc*100:.2f}%)")
    print(f"  ROC-AUC  : {test_auc:.4f}")
    print(f"\n  ── Classification Report (Test) ──")
    report_dict = classification_report(
        y_test, preds_test,
        target_names=["UNSAFE", "SAFE"],
        output_dict=True,
    )
    print(classification_report(y_test, preds_test, target_names=["UNSAFE", "SAFE"]))

    # ── Save plots ───────────────────────────────────────────────────────
    _save_feature_importance(
        model, CLASSIFIER_FEATURES,
        "Feature Importance — Random Forest Safety Classifier",
        os.path.join(PLOTS_DIR, "feature_importance_classifier.png"),
    )
    _save_confusion_matrix(
        y_test, preds_test, ["UNSAFE", "SAFE"],
        os.path.join(PLOTS_DIR, "confusion_matrix.png"),
    )
    auc_from_plot = _save_roc_curve(
        y_test, probas_test,
        os.path.join(PLOTS_DIR, "roc_curve.png"),
    )

    # ── Save model ───────────────────────────────────────────────────────
    with open(RF_PATH, "wb") as f:
        pickle.dump(model, f)
    print(f"\n  ✓ Model saved → {RF_PATH}")
    print(f"  ✓ Label encoder saved → {LE_PATH}")

    return {
        "model": "Random Forest Classifier v2.0",
        "trained_at": datetime.now().isoformat(),
        "train_samples": len(X_train),
        "train_samples_after_smote": len(X_train_res),
        "val_samples": len(X_val),
        "test_samples": len(X_test),
        "features": CLASSIFIER_FEATURES,
        "hyperparameters": {
            "n_estimators": 200,
            "max_depth": 12,
            "class_weight": "balanced",
        },
        "val_metrics":  {"accuracy": round(val_acc, 4),  "roc_auc": round(val_auc, 4)},
        "test_metrics": {
            "accuracy":   round(test_acc, 4),
            "roc_auc":    round(auc_from_plot, 4),
            "precision_SAFE":   round(report_dict["SAFE"]["precision"], 4),
            "recall_SAFE":      round(report_dict["SAFE"]["recall"], 4),
            "f1_SAFE":          round(report_dict["SAFE"]["f1-score"], 4),
            "precision_UNSAFE": round(report_dict["UNSAFE"]["precision"], 4),
            "recall_UNSAFE":    round(report_dict["UNSAFE"]["recall"], 4),
            "f1_UNSAFE":        round(report_dict["UNSAFE"]["f1-score"], 4),
        },
    }


# ─── Main ───────────────────────────────────────────────────────────────────
def train_and_export():
    start_time = datetime.now()

    _print_section("ColdGuard AI — ML Training Pipeline  (v2.0)")
    print(f"  Dataset     : {DATA_PATH}")
    print(f"  Kaggle ref  : https://www.kaggle.com/datasets/cplinta/milkquality")
    print(f"  Started at  : {start_time.strftime('%Y-%m-%d %H:%M:%S')}")

    # ── Load data ────────────────────────────────────────────────────────
    if not os.path.exists(DATA_PATH):
        print(f"\n[ERROR] Dataset not found: {DATA_PATH}")
        print("  Run `python generate_data.py` first.")
        sys.exit(1)

    df = pd.read_csv(DATA_PATH)
    print(f"\n  ✓ Loaded {len(df):,} rows × {len(df.columns)} columns")

    # Validate expected columns
    missing = [c for c in REGRESSOR_FEATURES + ["remaining_shelf_life_hours", "is_safe"]
               if c not in df.columns]
    if missing:
        print(f"[ERROR] Missing columns in dataset: {missing}")
        sys.exit(1)

    # ── Encode storage_phase → ordinal ──────────────────────────────────
    phase_map = {"fresh": 0, "mid": 1, "late": 2}
    if "storage_phase" in df.columns:
        df["storage_phase_enc"] = df["storage_phase"].map(phase_map).fillna(1)

    # ── Data quality check ───────────────────────────────────────────────
    print(f"\n  Null values  : {df.isnull().sum().sum()}")
    print(f"  SAFE rows    : {(df['is_safe'] == 1).sum():,}  "
          f"({(df['is_safe']==1).mean()*100:.1f}%)")
    print(f"  UNSAFE rows  : {(df['is_safe'] == 0).sum():,}  "
          f"({(df['is_safe']==0).mean()*100:.1f}%)")
    print(f"  Shelf life   : min={df['remaining_shelf_life_hours'].min():.0f}h  "
          f"max={df['remaining_shelf_life_hours'].max():.0f}h  "
          f"mean={df['remaining_shelf_life_hours'].mean():.1f}h")

    # ── Train models ─────────────────────────────────────────────────────
    reg_summary  = train_shelf_life_regressor(df)
    clf_summary  = train_safety_classifier(df)

    # ── Save shared feature list ─────────────────────────────────────────
    feature_bundle = {
        "regressor_features":  REGRESSOR_FEATURES,
        "classifier_features": CLASSIFIER_FEATURES,
    }
    with open(FEAT_PATH, "wb") as f:
        pickle.dump(feature_bundle, f)
    print(f"\n  ✓ Feature list saved → {FEAT_PATH}")

    # ── Save training summary JSON ────────────────────────────────────────
    elapsed = (datetime.now() - start_time).total_seconds()
    summary = {
        "pipeline_version": "2.0",
        "dataset": {
            "path": DATA_PATH,
            "rows": len(df),
            "kaggle_reference": "https://www.kaggle.com/datasets/cplinta/milkquality",
        },
        "training_time_seconds": round(elapsed, 1),
        "model_1_regressor":   reg_summary,
        "model_2_classifier":  clf_summary,
    }
    with open(SUMMARY_PATH, "w") as f:
        json.dump(summary, f, indent=2)

    # ── Final dashboard-ready summary ────────────────────────────────────
    _print_section("Training Complete — Dashboard Summary")
    print(json.dumps({
        "Model 1 (XGBoost Regressor)": {
            "Test RMSE (hours)": reg_summary["test_metrics"]["rmse"],
            "Test MAE  (hours)": reg_summary["test_metrics"]["mae"],
            "Test R²"          : reg_summary["test_metrics"]["r2"],
        },
        "Model 2 (RF Classifier)": {
            "Test Accuracy" : clf_summary["test_metrics"]["accuracy"],
            "Test ROC-AUC"  : clf_summary["test_metrics"]["roc_auc"],
            "F1 (SAFE)"     : clf_summary["test_metrics"]["f1_SAFE"],
            "F1 (UNSAFE)"   : clf_summary["test_metrics"]["f1_UNSAFE"],
        },
        "Training Time (s)": round(elapsed, 1),
        "Summary saved"    : SUMMARY_PATH,
    }, indent=2))


if __name__ == "__main__":
    train_and_export()
