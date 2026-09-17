# Data Source Reference — ColdGuard AI ML Pipeline

## Primary Dataset Reference

| Field       | Value |
|-------------|-------|
| **Title**   | Milk Quality Prediction |
| **URL**     | https://www.kaggle.com/datasets/cplinta/milkquality |
| **Author**  | cplinta |
| **Platform**| Kaggle |
| **License** | Open Database License (ODbL) |
| **Format**  | CSV — 1,059 rows × 8 features |
| **Task**    | Multi-class classification (Low / Medium / High quality) |

### Kaggle Dataset Features

| # | Column      | Type    | Description |
|---|-------------|---------|-------------|
| 1 | `pH`        | float   | Acidity level (3.0 – 9.5) |
| 2 | `Temperature` | int   | Storage temperature in °C |
| 3 | `Taste`     | binary  | 1 = Good taste |
| 4 | `Odor`      | binary  | 1 = Good odor |
| 5 | `Fat`       | binary  | 1 = Adequate fat content |
| 6 | `Turbidity` | binary  | 1 = High turbidity (indicates spoilage) |
| 7 | `Colour`    | int     | Colour intensity (240–255) |
| 8 | `Grade`     | string  | `low` / `medium` / `high` quality |

---

## Feature Alignment — Kaggle → ColdGuard AI Synthetic

| Kaggle Column | ColdGuard AI Equivalent | Notes |
|---------------|-------------------------|-------|
| `Temperature` | `current_temperature_c`, `avg_temperature_c` | Extended to full time-series history |
| `Grade`       | `safety_label` (SAFE/UNSAFE), `is_safe` | Simplified to binary per project safety rules |
| `Turbidity`   | `degradation_rate_per_hour` | Spoilage rate proxy via Q10 biochemical model |
| `pH` / `Taste` / `Odor` | `remaining_shelf_life_hours` | Aggregated into shelf-life target via spoilage model |
| *(not present)* | `storage_hours`, `temp_last_1h/3h/6h`, `hour_of_day` | New temporal features added by ColdGuard AI |

---

## Spoilage Physics Model

The dataset uses the **Q10 Rule** (van 't Hoff rule) for biological reaction rate scaling:

```
Rate(T) = Q10 ^ ((T - T_ref) / 10)

Where:
  T_ref = 4 °C       (reference refrigeration temperature)
  Q10   = 3.0        (milk spoilage rate triples per 10 °C rise)
  Base shelf life = 336 hours (14 days) at 4 °C for pasteurized whole milk
```

**Hourly spoilage accumulation:**
```
spoilage_consumed = Σ [Q10 ^ ((T_h - 4) / 10)]  for each hour h
remaining_life    = 336 - spoilage_consumed        (floored at 0)
```

**References:**
- Dairy Technology International: Shelf Life Extension in Refrigerated Milk
- IDF Standard 94C: Pasteurized Milk Shelf Life Guidelines
- Arrhenius / Q10 kinetics: Labuza, T.P. (1984) Application of Chemical Kinetics to Deterioration of Foods.

---

## Safety Threshold Rules

Based on **FDA Food Code** and **EU Regulation (EC) 853/2004**:

| Condition | Temperature | Label | `is_safe` |
|-----------|-------------|-------|-----------|
| Safe storage | ≤ 5 °C | SAFE | 1 |
| Borderline + shelf_life > 72h | 5–8 °C | SAFE | 1 |
| Borderline + shelf_life ≤ 72h | 5–8 °C | UNSAFE | 0 |
| Danger zone | ≥ 8 °C | UNSAFE | 0 |

---

## Dataset Statistics (35,000 rows)

### Scenario Distribution

| Scenario | % of Data | Avg Temp (°C) | Avg Shelf Life (h) |
|----------|-----------|----------------|---------------------|
| ideal_cold | 20% | ~4.0 | ~285 |
| good_cold | 22% | ~4.5 | ~250 |
| short_excursion | 15% | ~4.5 | ~230 |
| long_excursion | 10% | ~5.0 | ~180 |
| chronic_mild_abuse | 13% | ~7.0 | ~100 |
| moderate_abuse | 8% | ~10.0 | ~30 |
| severe_abuse | 7% | ~14.0 | ~0 |
| variable_chain | 5% | ~5.5 | ~200 |

### Expected Label Balance

| Label | Expected % |
|-------|-----------|
| SAFE  | ~65–70% |
| UNSAFE | ~30–35% |

> SMOTE oversampling is applied in `train_models.py` to handle any remaining imbalance.

---

## Data Integrity Notes

1. **No missing values** — all fields are generated deterministically per batch.
2. **Physical bounds** — temperatures clipped to [0.5 °C, 35 °C].
3. **Temporal consistency** — `temp_last_1h/3h/6h` always computed from actual hourly profile.
4. **No data leakage** — `remaining_shelf_life_hours` is computed from cumulative spoilage, not from `is_safe`.
