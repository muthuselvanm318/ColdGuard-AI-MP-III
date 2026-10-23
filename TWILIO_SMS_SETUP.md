# Twilio SMS Setup Guide for ColdGuard AI

This guide explains how to set up Twilio SMS notifications for the UNSAFE temperature alert system.

### Step 1
Create an account or login to the [Twilio Console](https://console.twilio.com/).

### Step 2
On your dashboard homepage, find the following credentials under **Account Info**:
- **Account SID**
- **Auth Token**

*(Keep the Auth Token completely secret! Do not share it or commit it to GitHub).*

### Step 3
Obtain a Twilio phone number capable of sending SMS. You can usually get a trial number directly from the console by clicking **"Get a trial phone number"**.

### Step 4
Ensure your Twilio sender number is properly configured and active for SMS.

### Step 5
Determine the destination mobile number you want to receive alerts on.
**Important:** If you are using a Twilio Trial account, you *must* verify this destination number in the Twilio Console under **Verified Caller IDs** before you can send messages to it.

### Step 6
Add the credentials to your backend `.env` file (create this file if it doesn't exist by copying `.env.example`).
The format should be E.164 (e.g., `+919876543210`).

```env
TWILIO_ACCOUNT_SID=ACxxxxxxxxxxxxxxxxxxxxxxxxxxxxx
TWILIO_AUTH_TOKEN=your_auth_token_here
TWILIO_PHONE_NUMBER=+1234567890
TWILIO_TO_PHONE_NUMBER=+919876543210
```

### Step 7
Install the required Twilio Python SDK by navigating to the backend folder and running:
```bash
cd backend
pip install -r requirements.txt
```
*(Or manually run `pip install twilio`)*

### Step 8
Start the ColdGuard AI backend:
```bash
uvicorn backend.main:app --port 8000 --reload
```

### Step 9
Call the test SMS endpoint to ensure everything is working correctly without needing an actual UNSAFE product.
Using curl or Postman:
```bash
curl -X POST http://localhost:8000/api/notifications/test-sms
```

### Step 10
Verify that the test SMS message was received on the destination mobile phone.

### Step 11
Trigger an actual UNSAFE result in the system (e.g., by logging a high temperature for a product for an extended period, or using the force prediction endpoint).

### Step 12
Verify that the automatic SMS is received, containing the Product ID, Device ID, and Temperature. You can also view the SMS history in your MySQL database in the `sms_history` table.

---

## Troubleshooting Twilio Errors

The backend logs Twilio errors gracefully without crashing. If you aren't receiving messages, check the console output of your backend server:

- **Missing Twilio configuration:** Ensure your `.env` is in the `backend` folder and contains all four `TWILIO_` variables.
- **Unverified Number (Trial Accounts):** Twilio error `21608`. You can only send SMS to verified numbers during the trial. Verify the number in the Twilio Console.
- **Invalid Number Format:** Ensure `TWILIO_PHONE_NUMBER` and `TWILIO_TO_PHONE_NUMBER` include the country code and `+` (e.g., `+919876543210`).
- **Authentication Error:** Twilio error `20003`. Your SID or Auth Token is incorrect. Double-check your Twilio Console.
- **No SMS received but logs say SENT:** Check the Twilio Console **Monitor > Logs > Messages** tab to see if carriers blocked or filtered the message.
