import os
import smtplib
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from twilio.rest import Client
from datetime import datetime

# Configure from .env
SMTP_SERVER = os.getenv("SMTP_SERVER", "smtp.gmail.com")
SMTP_PORT = int(os.getenv("SMTP_PORT", "587"))
SMTP_USER = os.getenv("SMTP_USER", "")  # e.g., your-email@gmail.com
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")

TWILIO_SID = os.getenv("TWILIO_ACCOUNT_SID", "")
TWILIO_TOKEN = os.getenv("TWILIO_AUTH_TOKEN", "")
TWILIO_PHONE_NUMBER = os.getenv("TWILIO_PHONE_NUMBER", "")

def send_alert(milk_id: str, current_temp: float, unsafe_prob: float, 
               target_email: str = "muthuselvanb.24cse@kongu.edu", 
               target_phone: str = "+918610231943"):
    """
    Sends an Email and SMS alert when a product is predicted to be unsafe.
    """
    probability_pct = round(unsafe_prob * 100, 1)
    timestamp = datetime.now().strftime("%Y-%m-%d %H:%M:%S")

    subject = f"🚨 URGENT: Spoilage Alert for {milk_id}"
    body = (
        f"ColdGuard AI Alert\n"
        f"------------------\n"
        f"Product ID: {milk_id}\n"
        f"Status: UNSAFE (Probability: {probability_pct}%)\n"
        f"Current Temp: {current_temp}°C\n"
        f"Time: {timestamp}\n\n"
        f"Action Required: Please inspect product {milk_id} immediately. It has exceeded the safety threshold."
    )

    print(f"\n[ALERT DISPATCH] Triggering alerts for {milk_id} (UNSAFE: {probability_pct}%)")

    # 1. Send Email
    try:
        if SMTP_USER and SMTP_PASSWORD:
            msg = MIMEMultipart()
            msg['From'] = SMTP_USER
            msg['To'] = target_email
            msg['Subject'] = subject
            msg.attach(MIMEText(body, 'plain'))

            server = smtplib.SMTP(SMTP_SERVER, SMTP_PORT)
            server.starttls()
            server.login(SMTP_USER, SMTP_PASSWORD)
            server.send_message(msg)
            server.quit()
            print(f"  --> ✅ Email successfully sent to {target_email}")
        else:
            print(f"  --> ⚠️  Email skipped (SMTP credentials not configured in .env). Would have sent to {target_email}:")
            print(f"      Subject: {subject}")
    except Exception as e:
        print(f"  --> ❌ Failed to send email: {e}")

    # 2. Send SMS
    try:
        if TWILIO_SID and TWILIO_TOKEN and TWILIO_PHONE_NUMBER:
            client = Client(TWILIO_SID, TWILIO_TOKEN)
            message = client.messages.create(
                body=f"ColdGuard AI Alert: Product {milk_id} is {probability_pct}% UNSAFE at {current_temp}°C. Inspect immediately.",
                from_=TWILIO_PHONE_NUMBER,
                to=target_phone
            )
            print(f"  --> ✅ SMS successfully sent to {target_phone} (Twilio SID: {message.sid})")
        else:
            print(f"  --> ⚠️  SMS skipped (Twilio credentials not configured in .env). Would have sent to {target_phone}.")
    except Exception as e:
        print(f"  --> ❌ Failed to send SMS: {e}")
