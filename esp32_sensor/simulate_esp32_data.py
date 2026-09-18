import requests
import time
import random
from datetime import datetime, timedelta

API_URL = "http://localhost:8000/api/temperature"
DEVICE_ID = "ESP32-5659"
MILK_ID = "MILK-0248"

def simulate_data(num_readings=20):
    print(f"Injecting {num_readings} historical temperature readings for {MILK_ID}...")
    base_temp = 4.2
    
    # Generate past timestamps
    now = datetime.now()
    
    for i in range(num_readings):
        temp = base_temp + random.uniform(-0.5, 0.8)
        base_temp += 0.05 # slight degradation
        
        # Space readings 5 mins apart in the past
        past_time = now - timedelta(minutes=5 * (num_readings - i))
        
        payload = {
            "device_id": DEVICE_ID,
            "milk_id": MILK_ID,
            "temperature_c": round(temp, 2),
            "timestamp": past_time.strftime('%Y-%m-%d %H:%M:%S')
        }
        
        res = requests.post(API_URL, json=payload)
        print(f"[{i+1}/{num_readings}] {past_time.strftime('%H:%M')} -> {temp:.2f}°C (Status {res.status_code})")
        time.sleep(0.1)

if __name__ == "__main__":
    simulate_data()
