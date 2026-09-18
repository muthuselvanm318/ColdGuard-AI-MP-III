import os
from backend.notifications import send_alert
from unittest.mock import patch
import sys
from io import StringIO

def test_default_recipients():
    print("Running default recipient test...")
    
    # Capture standard output to verify the target email and phone
    captured_output = StringIO()
    sys.stdout = captured_output
    
    # We explicitly pass None to simulate empty config/unspecified recipients
    send_alert(
        milk_id="MILK-TEST", 
        current_temp=12.5, 
        unsafe_prob=0.85, 
        target_email=None, 
        target_phone=None
    )
    
    sys.stdout = sys.__stdout__
    output = captured_output.getvalue()
    
    # Verify the fallback defaults are embedded in the printed output
    if "Would have sent to muthuselvanb.24cse@kongu.edu" in output:
        print("✅ SUCCESS: Email gracefully fell back to default: muthuselvanb.24cse@kongu.edu")
    else:
        print("❌ ERROR: Default email fallback failed.")
        
    if "Would have sent to +918610231943" in output:
        print("✅ SUCCESS: SMS gracefully fell back to default: +918610231943")
    else:
        print("❌ ERROR: Default SMS fallback failed.")
        
    print("\n--- Captured Output ---")
    print(output)

if __name__ == "__main__":
    test_default_recipients()
