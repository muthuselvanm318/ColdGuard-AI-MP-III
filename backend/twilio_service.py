import os
from datetime import datetime

def send_twilio_sms(status: str, temp: float, device_id: str, milk_id: str) -> dict:
    """
    Sends an SMS using Twilio and returns success/failure dictionary.
    Safe execution: catches all exceptions to prevent crashing the main app.
    """
    try:
        from twilio.rest import Client
        from twilio.base.exceptions import TwilioRestException
    except ImportError:
        print("Twilio SDK not installed. Please run: pip install twilio")
        return {"success": False, "error_message": "Twilio SDK not installed"}

    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = os.environ.get("TWILIO_PHONE_NUMBER")
    to_number = os.environ.get("TWILIO_TO_PHONE_NUMBER")

    if not all([account_sid, auth_token, from_number, to_number]):
        return {"success": False, "error_message": "Missing Twilio configuration in environment variables."}

    message_body = f"""🚨 ColdGuard AI Alert

Status: {status}

A safety condition has been detected.

Please check the monitored product immediately.

Product: {milk_id}
Device: {device_id}
Temp: {temp}°C
Time: {datetime.now().strftime("%d-%b-%Y %H:%M")}"""

    try:
        client = Client(account_sid, auth_token)
        message = client.messages.create(
            body=message_body,
            from_=from_number,
            to=to_number
        )
        print(f"Twilio SMS sent successfully. SID: {message.sid}")
        return {"success": True, "error_message": None}
    except TwilioRestException as e:
        print(f"Twilio API Error: {e.msg}")
        return {"success": False, "error_message": str(e.msg)}
    except Exception as e:
        print(f"Failed to send Twilio SMS: {str(e)}")
        return {"success": False, "error_message": str(e)}

def send_test_sms() -> dict:
    """
    Sends a test SMS to verify Twilio configuration.
    """
    try:
        from twilio.rest import Client
        from twilio.base.exceptions import TwilioRestException
    except ImportError:
        return {"success": False, "message": "Twilio SDK not installed"}

    account_sid = os.environ.get("TWILIO_ACCOUNT_SID")
    auth_token = os.environ.get("TWILIO_AUTH_TOKEN")
    from_number = os.environ.get("TWILIO_PHONE_NUMBER")
    to_number = os.environ.get("TWILIO_TO_PHONE_NUMBER")

    if not all([account_sid, auth_token, from_number, to_number]):
        return {"success": False, "message": "Missing Twilio configuration in environment variables."}

    message_body = "ColdGuard AI test message.\n\nYour Twilio SMS notification system is working correctly."

    try:
        client = Client(account_sid, auth_token)
        client.messages.create(
            body=message_body,
            from_=from_number,
            to=to_number
        )
        return {"success": True, "message": "Test SMS sent successfully"}
    except TwilioRestException as e:
        return {"success": False, "message": f"Unable to send SMS: {e.msg}"}
    except Exception as e:
        return {"success": False, "message": f"Unable to send SMS: {str(e)}"}
