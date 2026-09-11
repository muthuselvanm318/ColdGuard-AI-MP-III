import pandas as pd
import numpy as np
from datetime import datetime, timedelta
import random
import os

def generate_synthetic_data(num_samples=200, output_path='synthetic_milk_data.csv'):
    """
    Generates synthetic but scientifically plausible temperature history profiles
    for pasteurized whole milk.
    Base shelf life at 4°C is ~14 days (336 hours).
    Higher temperatures accelerate spoilage (Q10 rule, roughly Q10=3 for milk).
    """
    np.random.seed(42)
    random.seed(42)

    records = []
    
    for i in range(num_samples):
        milk_id = f"MILK_{i:04d}"
        
        # Determine scenario
        # 0: Perfect refrigeration (4C)
        # 1: Slight variation (2C to 6C)
        # 2: One major excursion (e.g. left out for 4 hours)
        # 3: Chronic slight abuse (6C to 8C)
        # 4: Major abuse (>10C)
        scenario = np.random.choice([0, 1, 2, 3, 4], p=[0.3, 0.4, 0.15, 0.1, 0.05])
        
        # Start time
        start_time = datetime(2026, 8, 1) + timedelta(days=random.randint(0, 30), hours=random.randint(0, 23))
        
        # How long has it been stored so far?
        # Max reasonable storage before consumption/spoilage is ~20 days (480h)
        total_hours_stored = random.randint(10, 400)
        
        current_time = start_time
        
        # Spoilage tracking
        base_shelf_life_hours = 336.0 # 14 days
        spoilage_consumed = 0.0
        
        # History lists
        temps = []
        timestamps = []
        
        # Excursion events
        excursion_start = None
        if scenario == 2:
            excursion_start = random.randint(5, max(10, total_hours_stored - 5))
            excursion_duration = random.randint(2, 8)
        
        for h in range(total_hours_stored + 1):
            if scenario == 0:
                temp = np.random.normal(4.0, 0.5)
            elif scenario == 1:
                temp = np.random.normal(4.5, 1.5)
            elif scenario == 2:
                if excursion_start and excursion_start <= h <= (excursion_start + excursion_duration):
                    temp = np.random.normal(15.0, 2.0)
                else:
                    temp = np.random.normal(4.0, 0.5)
            elif scenario == 3:
                temp = np.random.normal(7.0, 1.0)
            elif scenario == 4:
                temp = np.random.normal(12.0, 3.0)
                
            temp = max(0.5, temp) # Milk shouldn't freeze for this model
            temps.append(temp)
            timestamps.append(current_time)
            
            # Calculate spoilage rate for this hour
            # Q10 = 3 => Spoilage rate multiplies by 3 for every 10C increase
            # Rate relative to 4C
            rate_multiplier = 3.0 ** ((temp - 4.0) / 10.0)
            spoilage_consumed += (1.0 * rate_multiplier)
            
            current_time += timedelta(hours=1)
            
        # Calculate final remaining shelf life
        remaining_life = base_shelf_life_hours - spoilage_consumed
        remaining_shelf_life_hours = max(0.0, round(remaining_life, 2))
        
        # Safety Status Label
        if remaining_shelf_life_hours > 72:
            safety_status = "SAFE"
        elif remaining_shelf_life_hours > 0:
            safety_status = "CAUTION"
        else:
            safety_status = "UNSAFE"
            
        # Feature Engineering at the current point (end of the series)
        temps_array = np.array(temps)
        
        # excursions
        above_6 = sum(1 for t in temps if t > 6.0)
        above_8 = sum(1 for t in temps if t > 8.0)
        
        # find longest excursion > 8C
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

        # trend (slope over last 5 hours)
        if len(temps) >= 5:
            last_5 = temps[-5:]
            trend = np.polyfit(range(5), last_5, 1)[0]
        else:
            trend = 0.0

        records.append({
            'milk_id': milk_id,
            'timestamp': timestamps[-1].isoformat(),
            'storage_hours': total_hours_stored,
            'current_temperature_c': round(temps[-1], 2),
            'avg_temperature_c': round(np.mean(temps_array), 2),
            'min_temperature_c': round(np.min(temps_array), 2),
            'max_temperature_c': round(np.max(temps_array), 2),
            'temperature_std_c': round(np.std(temps_array), 2),
            'time_above_6c_hours': above_6,
            'time_above_8c_hours': above_8,
            'num_temperature_excursions': num_excursions,
            'longest_excursion_hours': longest_excursion,
            'cumulative_temperature_exposure': round(np.sum(temps_array), 2),
            'temperature_trend': round(trend, 4),
            'remaining_shelf_life_hours': remaining_shelf_life_hours,
            'safety_status': safety_status
        })

    df = pd.DataFrame(records)
    
    # Save dataset
    df.to_csv(output_path, index=False)
    print(f"Generated {len(df)} records of synthetic real-world compatible data at {output_path}")
    print("\nSample Data:")
    print(df.head())

if __name__ == "__main__":
    generate_synthetic_data(2000, 'synthetic_milk_data.csv')
