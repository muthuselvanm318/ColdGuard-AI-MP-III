import pandas as pd
import numpy as np
from datetime import datetime, timedelta

# Configuration
NUM_ROWS = 35000
np.random.seed(42)

def generate_milk_dataset(num_rows):
    data = []
    base_time = datetime(2026, 8, 1)

    for i in range(num_rows):
        milk_id = f"MILK_{i:05d}"
        timestamp = (base_time + timedelta(hours=int(np.random.uniform(0, 720)))).strftime("%Y-%m-%dT%H:00:00")
        storage_hours = int(np.random.uniform(1, 168)) # Up to 7 days
        
        # Determine scenario to ensure a good mix of SAFE, CAUTION, and UNSAFE
        scenario = np.random.choice(['ideal', 'caution', 'unsafe_spike', 'room_temp'], p=[0.55, 0.20, 0.15, 0.10])
        
        if scenario == 'ideal':
            current_temp = np.random.uniform(0.5, 3.8)
            avg_temp = current_temp + np.random.uniform(-0.5, 0.5)
            max_temp = avg_temp + np.random.uniform(0.1, 1.5)
            min_temp = avg_temp - np.random.uniform(0.1, 1.0)
            is_opened = np.random.choice([0, 1])
        elif scenario == 'caution':
            current_temp = np.random.uniform(4.1, 6.0)
            avg_temp = current_temp + np.random.uniform(-1.0, 0.5)
            max_temp = current_temp + np.random.uniform(0.0, 1.0)
            min_temp = avg_temp - np.random.uniform(0.5, 2.0)
            is_opened = np.random.choice([0, 1])
        elif scenario == 'unsafe_spike':
            current_temp = np.random.uniform(6.1, 12.0)
            avg_temp = np.random.uniform(4.0, 8.0)
            max_temp = current_temp + np.random.uniform(0.0, 3.0)
            min_temp = avg_temp - np.random.uniform(1.0, 3.0)
            is_opened = np.random.choice([0, 1])
        else: # room_temp
            current_temp = np.random.uniform(22.0, 25.0)
            avg_temp = np.random.uniform(18.0, 24.0)
            max_temp = current_temp + np.random.uniform(0.0, 2.0)
            min_temp = avg_temp - np.random.uniform(2.0, 5.0)
            is_opened = np.random.choice([0, 1])

        # Derived Temperature Features
        temp_std = round(np.random.uniform(0.1, 2.5), 2)
        cumulative_exposure = round(max(0, avg_temp * storage_hours), 2)
        temp_trend = round(np.random.uniform(-1.5, 1.5), 4)

        # Excursion Logic
        time_above_6c = 0
        time_above_8c = 0
        num_excursions = 0
        longest_excursion = 0

        if max_temp > 6.0:
            time_above_6c = int(np.random.uniform(1, min(storage_hours, 72)))
            num_excursions = int(np.random.uniform(1, 5))
            longest_excursion = int(np.random.uniform(1, time_above_6c))
            if max_temp > 8.0:
                time_above_8c = int(np.random.uniform(1, time_above_6c))

        # RWD Shelf-Life Logic (Pasteurized Whole Milk)
        if scenario == 'room_temp':
            # Strict Room Temp Rule: 8-14 hours max if just exposed, drops to 0 rapidly
            base_shelf_life = np.random.uniform(8, 14)
            remaining_shelf_life = max(0.0, base_shelf_life - (storage_hours * 2)) # Degrades 2x as fast
        else:
            if is_opened == 0:
                base_shelf_life = np.random.uniform(120, 168) # 5-7 days
            else:
                base_shelf_life = np.random.uniform(72, 120)  # 3-5 days
            
            # Decay based on temperature (Q10 rule approximation)
            if avg_temp <= 4.0:
                temp_factor = 1.0
            else:
                temp_factor = 2.0 ** ((avg_temp - 4.0) / 7.5)
            
            remaining_shelf_life = max(0.0, (base_shelf_life - storage_hours) / temp_factor)

        # Safety Status Logic
        if current_temp > 6.0 or remaining_shelf_life <= 0:
            safety_status = "UNSAFE"
        elif 4.1 <= current_temp <= 6.0:
            safety_status = "CAUTION"
        else:
            safety_status = "SAFE"

        # Ensure bounds and formatting
        data.append({
            "milk_id": milk_id,
            "timestamp": timestamp,
            "storage_hours": storage_hours,
            "current_temperature_c": round(current_temp, 2),
            "avg_temperature_c": round(avg_temp, 2),
            "min_temperature_c": round(min_temp, 2),
            "max_temperature_c": round(max_temp, 2),
            "temperature_std_c": temp_std,
            "time_above_6c_hours": time_above_6c,
            "time_above_8c_hours": time_above_8c,
            "num_temperature_excursions": num_excursions,
            "longest_excursion_hours": longest_excursion,
            "cumulative_temperature_exposure": cumulative_exposure,
            "temperature_trend": temp_trend,
            "remaining_shelf_life_hours": round(remaining_shelf_life, 2),
            "safety_status": safety_status
        })

    return pd.DataFrame(data)

# Generate and save the dataset
if __name__ == "__main__":
    print("Generating 35,000 rows based on Whole Milk RWD...")
    df = generate_milk_dataset(NUM_ROWS)
    df.to_csv("synthetic_milk_16_features_35k.csv", index=False)
    print("Dataset successfully saved as 'synthetic_milk_16_features_35k.csv'!")
