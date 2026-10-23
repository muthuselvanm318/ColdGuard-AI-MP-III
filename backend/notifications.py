import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from datetime import datetime, timedelta
import json
import urllib.request
import urllib.error
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
import mysql.connector

notification_router = APIRouter()

def get_db_connection():
    try:
        connection = mysql.connector.connect(
            host=os.environ.get("DB_HOST", "127.0.0.1"),
            user=os.environ.get("DB_USER", "root"),
            password=os.environ.get("DB_PASSWORD", "0407"),
            database=os.environ.get("DB_NAME", "coldguard_ai")
        )
        return connection
    except Exception as e:
        print(f"Notification DB Error: {e}")
        return None

def init_notification_db():
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS fcm_tokens (
                token VARCHAR(255) PRIMARY KEY,
                created_at DATETIME
            )
            """)
            
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS notification_cooldowns (
                id VARCHAR(255) PRIMARY KEY,
                last_sent DATETIME
            )
            """)
            
            cursor.execute("""
            CREATE TABLE IF NOT EXISTS sms_history (
                id INT AUTO_INCREMENT PRIMARY KEY,
                notification_type VARCHAR(50) DEFAULT 'SMS',
                status VARCHAR(50),
                recipient VARCHAR(100),
                message TEXT,
                timestamp DATETIME,
                error_message TEXT
            )
            """)
            conn.commit()
        except Exception as e:
            print(f"Error init notification db: {e}")
        finally:
            conn.close()

init_notification_db()

class FCMTokenPayload(BaseModel):
    fcm_token: str

@notification_router.post("/api/notifications/register-device")
def register_device(payload: FCMTokenPayload):
    conn = get_db_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cursor = conn.cursor()
        cursor.execute("REPLACE INTO fcm_tokens (token, created_at) VALUES (%s, %s)", (payload.fcm_token, datetime.now()))
        conn.commit()
        return {"success": True, "message": "FCM token registered"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
    finally:
        conn.close()

@notification_router.post("/api/notifications/test-sms")
def test_sms():
    try:
        from backend.twilio_service import send_test_sms
    except ImportError:
        from twilio_service import send_test_sms
    
    result = send_test_sms()
    return result

def send_ntfy_notification(title: str, status: str, temp: float, device_id: str, milk_id: str):
    """
    Sends a 100% free, instant mobile push notification via ntfy.sh
    No account, phone number, or paid credits required.
    """
    topic = os.environ.get("NTFY_TOPIC", "coldguard_alerts_selvam")
    url = f"https://ntfy.sh/{topic}"
    
    body = (
        f"🚨 ColdGuard AI Alert: {status} Condition Detected!\n"
        f"• Product: {milk_id}\n"
        f"• Device: {device_id}\n"
        f"• Temperature: {temp:.2f}°C\n"
        f"• Warning: Acute temperature excursion / spoilage risk.\n"
        f"Please inspect refrigeration immediately!"
    )
    
    headers = {
        "Title": f"ColdGuard Alert: {status} ({temp:.1f}C)",
        "Priority": "urgent",
        "Tags": "warning,rotating_light,snowflake",
        "Click": "https://coldguard-ai-aubh.onrender.com"
    }
    
    try:
        req = urllib.request.Request(url, data=body.encode("utf-8"), headers=headers)
        with urllib.request.urlopen(req, timeout=5) as response:
            res_text = response.read().decode("utf-8")
            print(f"[ntfy Push Alert] Delivered to topic '{topic}': {res_text}")
            return {"success": True, "topic": topic}
    except Exception as e:
        print(f"[ntfy Push Alert Error] Failed: {e}")
        return {"success": False, "error": str(e)}

class AlertPayload(BaseModel):
    milk_id: str = "MILK-0248"
    device_id: str = "ESP32-5659"
    temperature_c: float = 22.0
    status: str = "UNSAFE"
    force: bool = True

@notification_router.post("/api/notifications/test-push")
def test_push():
    """Manual test endpoint to verify mobile push notification."""
    result = send_ntfy_notification("ColdGuard AI Alert", "UNSAFE", 21.5, "ESP32-5659", "MILK-0248")
    return result

@notification_router.post("/api/notifications/send-alert")
def send_alert_endpoint(payload: AlertPayload):
    """
    Explicitly triggers an alert notification dispatch across all configured channels.
    """
    trigger_notifications(
        milk_id=payload.milk_id,
        device_id=payload.device_id,
        temp=payload.temperature_c,
        status=payload.status,
        force=payload.force
    )
    return {
        "success": True,
        "message": f"Alert dispatched for {payload.milk_id} ({payload.status}, {payload.temperature_c}°C)"
    }

def send_email_notification(title, status, temp, device_id, milk_id):
    host = os.environ.get("SMTP_HOST")
    port = os.environ.get("SMTP_PORT", "587")
    username = os.environ.get("SMTP_USERNAME")
    password = os.environ.get("SMTP_PASSWORD")
    email_from = os.environ.get("NOTIFICATION_EMAIL_FROM")
    email_to = os.environ.get("NOTIFICATION_EMAIL_TO")

    if not all([host, username, password, email_from, email_to]):
        print("Email credentials not fully configured.")
        return

    msg = MIMEMultipart()
    msg['From'] = email_from
    msg['To'] = email_to
    msg['Subject'] = f"🚨 {title}"

    body = f"""🚨 ColdGuard AI Alert

A safety condition has been detected.

Status: {status}
Current Temperature: {temp}°C
Date/Time: {datetime.now().strftime("%Y-%m-%d %H:%M:%S")}
Device ID: {device_id}
Product ID: {milk_id}

Please check the monitored product immediately.
Do not consume the product if the safety condition indicates that it is unsafe.
"""
    msg.attach(MIMEText(body, 'plain'))

    try:
        server = smtplib.SMTP(host, int(port))
        server.starttls()
        server.login(username, password)
        server.send_message(msg)
        server.quit()
        print("Email notification sent.")
    except Exception as e:
        print(f"Failed to send email: {e}")

def send_fcm_notification(title, status, temp, device_id, milk_id):
    server_key = os.environ.get("FCM_SERVER_KEY")
    if not server_key:
        print("FCM_SERVER_KEY not configured. Skipping FCM.")
        return

    conn = get_db_connection()
    tokens = []
    if conn:
        try:
            cursor = conn.cursor()
            cursor.execute("SELECT token FROM fcm_tokens")
            tokens = [row[0] for row in cursor.fetchall()]
        except Exception as e:
            print(f"Error fetching tokens: {e}")
        finally:
            conn.close()

    if not tokens:
        print("No FCM tokens registered.")
        return

    message = f"{status} condition detected. Please check the monitored product immediately. Temp: {temp}°C"

    url = "https://fcm.googleapis.com/fcm/send"
    headers = {
        "Authorization": f"key={server_key}",
        "Content-Type": "application/json"
    }
    
    for token in tokens:
        data = {
            "to": token,
            "notification": {
                "title": title,
                "body": message
            },
            "data": {
                "status": status,
                "temperature": str(temp),
                "device_id": str(device_id),
                "product_id": str(milk_id),
                "datetime": datetime.now().strftime("%Y-%m-%d %H:%M:%S")
            }
        }
        try:
            req = urllib.request.Request(url, data=json.dumps(data).encode('utf-8'), headers=headers)
            with urllib.request.urlopen(req) as response:
                print(f"FCM response: {response.read().decode('utf-8')}")
        except Exception as e:
            print(f"Failed to send FCM: {e}")

def trigger_notifications(milk_id, device_id, temp, status, force: bool = False):
    if not force and status != "UNSAFE":
        return

    # Check cooldown if DB available and not forced
    if not force:
        conn = get_db_connection()
        if conn:
            try:
                cursor = conn.cursor()
                cooldown_id = f"UNSAFE_{milk_id}"
                cursor.execute("SELECT last_sent FROM notification_cooldowns WHERE id = %s", (cooldown_id,))
                row = cursor.fetchone()
                now = datetime.now()
                
                if row:
                    last_sent = row[0]
                    if now - last_sent < timedelta(minutes=30):
                        print(f"Notification in cooldown for {milk_id}")
                        return
                        
                cursor.execute("REPLACE INTO notification_cooldowns (id, last_sent) VALUES (%s, %s)", (cooldown_id, now))
                conn.commit()
            except Exception as e:
                print(f"Error in cooldown check: {e}")
            finally:
                conn.close()

    title = "ColdGuard AI Alert"
    send_email_notification(title, status, temp, device_id, milk_id)
    send_fcm_notification(title, status, temp, device_id, milk_id)
    ntfy_result = send_ntfy_notification(title, status, temp, device_id, milk_id)

    # Twilio SMS Integration
    sms_result = {"success": False, "error_message": "Not attempted"}
    to_number = os.environ.get("TWILIO_TO_PHONE_NUMBER", "UNKNOWN")
    try:
        try:
            from backend.twilio_service import send_twilio_sms
        except ImportError:
            from twilio_service import send_twilio_sms
        sms_result = send_twilio_sms(status, temp, device_id, milk_id)
    except Exception as e:
        print(f"Twilio execution error: {e}")

    # Log Notification History (ntfy Push & Twilio SMS)
    conn = get_db_connection()
    if conn:
        try:
            cursor = conn.cursor()
            msg_text = f"Status: {status} Temp: {temp}°C Milk: {milk_id}"
            
            # 1. Log ntfy Push Notification
            if ntfy_result:
                ntfy_status = "SENT" if ntfy_result.get("success") else "FAILED"
                ntfy_topic = ntfy_result.get("topic", "ntfy")
                cursor.execute("""
                    INSERT INTO sms_history (notification_type, status, recipient, message, timestamp, error_message)
                    VALUES (%s, %s, %s, %s, %s, %s)
                """, ("PUSH_NTFY", ntfy_status, ntfy_topic, msg_text, datetime.now(), ntfy_result.get("error")))
            
            # 2. Log Twilio SMS
            sms_status = "SENT" if sms_result.get("success") else "FAILED"
            err_msg = sms_result.get("error_message")
            cursor.execute("""
                INSERT INTO sms_history (notification_type, status, recipient, message, timestamp, error_message)
                VALUES (%s, %s, %s, %s, %s, %s)
            """, ("SMS", sms_status, to_number, msg_text, datetime.now(), err_msg))
            conn.commit()
        except Exception as e:
            print(f"Error logging notification history: {e}")
        finally:
            conn.close()

def send_alert(milk_id: str, current_temp: float, unsafe_prob: float = 1.0, target_email: str = None, target_phone: str = None):
    """Compatibility adapter for legacy callers: triggers notification dispatch across channels."""
    trigger_notifications(milk_id, "ESP32-5659", current_temp, "UNSAFE", force=True)

