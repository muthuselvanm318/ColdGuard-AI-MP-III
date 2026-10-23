#define BLYNK_TEMPLATE_ID "TMPL3oZOG6zPE"
#define BLYNK_TEMPLATE_NAME "Cold Guard AI"
#define BLYNK_AUTH_TOKEN "966vu-6Q-NkEec00tYG-qY6jH8SG9XiI"

#include <WiFi.h>
#include <BlynkSimpleEsp32.h>
#include <OneWire.h>
#include <DallasTemperature.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>

// ---------------------------------------------------------------------------
// Network & Cloud Configuration
// ---------------------------------------------------------------------------
char ssid[] = "Unknown";
char pass[] = "04072007";

#define ONE_WIRE_BUS 4

// ---------------------------------------------------------------------------
// CLOUD / VERCEL API CONFIGURATION
// ---------------------------------------------------------------------------
// ⚠️ REPLACE THIS with your actual Vercel or cloud backend domain:
// Example: "https://coldguard-ai.vercel.app/api/temperature"
// Or if hosted on Render/Railway: "https://coldguard-backend.onrender.com/api/temperature"
const char* cloudApiUrl = "https://YOUR-VERCEL-DOMAIN.vercel.app/api/temperature";

// Tracking IDs (Must match registered products in your cloud database)
const char* DEVICE_ID = "ESP32_01";
const char* MILK_ID   = "MILK_0001";

// Interval to send data to the Cloud API (in milliseconds)
// 10000L = 10 seconds, 30000L = 30 seconds
const unsigned long CLOUD_POST_INTERVAL_MS = 10000L;

// ---------------------------------------------------------------------------
// Global Objects & State
// ---------------------------------------------------------------------------
OneWire oneWire(ONE_WIRE_BUS);
DallasTemperature sensors(&oneWire);

BlynkTimer timer;

float currentTemperature = 0.0;
String safetyStatus = "UNKNOWN";

// ---------------------------------------------------------------------------
// Secure HTTPS Cloud Transmission Function (Vercel / AWS / Render Compatible)
// ---------------------------------------------------------------------------
void sendDataToCloud(float tempC)
{
  if (WiFi.status() != WL_CONNECTED)
  {
    Serial.println("[Cloud API] WiFi disconnected. Skipping upload.");
    return;
  }

  // Use WiFiClientSecure for HTTPS/SSL connections (Vercel enforces HTTPS)
  WiFiClientSecure client;
  
  // setInsecure() allows ESP32 to connect securely over TLS without needing
  // to hardcode root SSL certificates that expire.
  client.setInsecure();

  HTTPClient http;
  
  Serial.print("[Cloud API] Connecting to: ");
  Serial.println(cloudApiUrl);

  if (http.begin(client, cloudApiUrl))
  {
    http.addHeader("Content-Type", "application/json");
    http.addHeader("User-Agent", "ColdGuard-ESP32/1.0"); // Prevents Cloudflare/Vercel bot blocking
    
    // Auto-follow HTTP 301/308 redirects from Vercel
    http.setFollowRedirects(HTTPC_STRICT_FOLLOW_REDIRECTS);
    http.setTimeout(10000); // 10 second timeout

    // Build the JSON payload matching the backend schema
    String jsonPayload = "{";
    jsonPayload += "\"device_id\":\"" + String(DEVICE_ID) + "\",";
    jsonPayload += "\"milk_id\":\"" + String(MILK_ID) + "\",";
    jsonPayload += "\"temperature_c\":" + String(tempC, 2);
    jsonPayload += "}";

    Serial.print("[Cloud API] Sending payload: ");
    Serial.println(jsonPayload);

    int httpResponseCode = http.POST(jsonPayload);

    if (httpResponseCode > 0)
    {
      String response = http.getString();
      Serial.print("[Cloud API] HTTP Code: ");
      Serial.print(httpResponseCode);
      Serial.print(" | Response: ");
      Serial.println(response);
    }
    else
    {
      Serial.print("[Cloud API] Error posting data. Code: ");
      Serial.print(httpResponseCode);
      Serial.print(" (");
      Serial.print(http.errorToString(httpResponseCode));
      Serial.println(")");
    }

    http.end();
  }
  else
  {
    Serial.println("[Cloud API] Unable to connect to HTTPS endpoint.");
  }
}

// ---------------------------------------------------------------------------
// Sensor Reading Function
// ---------------------------------------------------------------------------
void readTemperature()
{
  sensors.requestTemperatures();
  float temperature = sensors.getTempCByIndex(0);

  if (temperature == DEVICE_DISCONNECTED_C)
  {
    Serial.println("ERROR: DS18B20 not detected on GPIO 4!");
    safetyStatus = "SENSOR ERROR";
    if (Blynk.connected())
    {
      Blynk.virtualWrite(V1, safetyStatus);
    }
    return;
  }

  currentTemperature = temperature;

  // Local temperature check
  if (temperature <= 5.0)
  {
    safetyStatus = "SAFE";
  }
  else if (temperature <= 8.0)
  {
    safetyStatus = "CAUTION";
  }
  else
  {
    safetyStatus = "UNSAFE";
  }

  Serial.print("Temp: ");
  Serial.print(currentTemperature, 2);
  Serial.print(" °C | Local Status: ");
  Serial.println(safetyStatus);

  // Update Blynk
  if (Blynk.connected())
  {
    Blynk.virtualWrite(V0, currentTemperature);
    Blynk.virtualWrite(V1, safetyStatus);
  }
}

// ---------------------------------------------------------------------------
// Periodic Cloud Sync Trigger
// ---------------------------------------------------------------------------
void triggerCloudSync()
{
  if (currentTemperature != 0.0 && safetyStatus != "SENSOR ERROR")
  {
    sendDataToCloud(currentTemperature);
  }
}

// ---------------------------------------------------------------------------
// Serial Console Menu
// ---------------------------------------------------------------------------
void processSerialCommand()
{
  if (Serial.available())
  {
    String command = Serial.readStringUntil('\n');
    command.trim();
    command.toUpperCase();

    if (command == "TEMP")
    {
      Serial.print("Current Temp: ");
      Serial.print(currentTemperature, 2);
      Serial.println(" °C");
    }
    else if (command == "STATUS")
    {
      Serial.print("Safety Status: ");
      Serial.println(safetyStatus);
    }
    else if (command == "READ")
    {
      readTemperature();
    }
    else if (command == "SEND")
    {
      Serial.println("Manual trigger: Reading sensor and posting to Cloud...");
      readTemperature();
      sendDataToCloud(currentTemperature);
    }
    else if (command == "WIFI")
    {
      if (WiFi.status() == WL_CONNECTED)
      {
        Serial.println("WiFi: CONNECTED");
        Serial.print("IP: ");
        Serial.println(WiFi.localIP());
        Serial.print("Signal (RSSI): ");
        Serial.print(WiFi.RSSI());
        Serial.println(" dBm");
      }
      else
      {
        Serial.println("WiFi: DISCONNECTED");
      }
    }
    else if (command == "BLYNK")
    {
      Serial.println(Blynk.connected() ? "Blynk: CONNECTED" : "Blynk: DISCONNECTED");
    }
    else if (command == "HELP")
    {
      Serial.println("--- Available Commands ---");
      Serial.println("TEMP   - Show current temperature");
      Serial.println("STATUS - Show safety status");
      Serial.println("READ   - Read sensor immediately");
      Serial.println("SEND   - Read and immediately upload to Vercel/Cloud");
      Serial.println("WIFI   - Show WiFi connection info");
      Serial.println("BLYNK  - Show Blynk status");
      Serial.println("HELP   - Show this command list");
    }
    else if (command.length() > 0)
    {
      Serial.print("Unknown command: ");
      Serial.println(command);
      Serial.println("Type HELP for available commands.");
    }
  }
}

// ---------------------------------------------------------------------------
// Setup
// ---------------------------------------------------------------------------
void setup()
{
  Serial.begin(115200);
  delay(1000);

  Serial.println();
  Serial.println("=========================================");
  Serial.println("    COLDGUARD AI — ESP32 CLOUD NODE      ");
  Serial.println("=========================================");

  sensors.begin();
  Serial.println("DS18B20 sensor initialized on GPIO 4");

  Serial.print("Connecting to WiFi: ");
  Serial.println(ssid);
  WiFi.begin(ssid, pass);

  int attempts = 0;
  while (WiFi.status() != WL_CONNECTED && attempts < 30)
  {
    delay(500);
    Serial.print(".");
    attempts++;
  }
  Serial.println();

  if (WiFi.status() == WL_CONNECTED)
  {
    Serial.println("WiFi Connected!");
    Serial.print("ESP32 IP: ");
    Serial.println(WiFi.localIP());
  }
  else
  {
    Serial.println("WiFi Failed! Check SSID / Password.");
  }

  // Connect to Blynk
  Serial.println("Connecting to Blynk Cloud...");
  Blynk.config(BLYNK_AUTH_TOKEN);
  if (WiFi.status() == WL_CONNECTED)
  {
    Blynk.connect();
  }

  // Timer 1: Read temperature every 2 seconds for Blynk & Serial
  timer.setInterval(2000L, readTemperature);

  // Timer 2: Upload reading to Cloud API every CLOUD_POST_INTERVAL_MS (e.g. 10s)
  timer.setInterval(CLOUD_POST_INTERVAL_MS, triggerCloudSync);

  // Initial read
  readTemperature();

  Serial.println();
  Serial.println("System Initialized!");
  Serial.print("  • Target Cloud API: ");
  Serial.println(cloudApiUrl);
  Serial.println("Type HELP in Serial Monitor for commands.");
  Serial.println("=========================================");
}

// ---------------------------------------------------------------------------
// Main Loop
// ---------------------------------------------------------------------------
void loop()
{
  if (Blynk.connected())
  {
    Blynk.run();
  }

  timer.run();
  processSerialCommand();
}
