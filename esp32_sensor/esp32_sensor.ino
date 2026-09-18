#include <ArduinoJson.h> // Ensure you have ArduinoJson library installed
#include <DallasTemperature.h>
#include <HTTPClient.h>
#include <OneWire.h>
#include <WiFi.h>
#include <time.h>

// -----------------------------------------
// Configuration Details
// -----------------------------------------
const char *ssid = "Unknown";
const char *password = "04072007";

// Backend API URL (Update with actual IP of the backend server)
const char *serverName =
    "https://coldguard-ai-aubh.onrender.com/api/temperature";

// Device & Product Identifiers
const String DEVICE_ID = "ESP32_01";
const String MILK_ID =
    "MILK_0001"; // The batch of milk currently being monitored

// GPIO where the DS18B20 is connected to
const int oneWireBus = 4;

// NTP Server for timestamp
const char *ntpServer = "pool.ntp.org";
const long gmtOffset_sec = 0;
const int daylightOffset_sec = 3600;

// Setup a oneWire instance
OneWire oneWire(oneWireBus);

// Pass our oneWire reference to Dallas Temperature sensor
DallasTemperature sensors(&oneWire);

void setup() {
  Serial.begin(115200);

  // Start the DS18B20 sensor
  sensors.begin();

  // Connect to Wi-Fi
  WiFi.begin(ssid, password);
  Serial.println("Connecting to WiFi...");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  Serial.println("");
  Serial.print("Connected to WiFi network with IP Address: ");
  Serial.println(WiFi.localIP());

  // Initialize NTP
  configTime(gmtOffset_sec, daylightOffset_sec, ntpServer);
  Serial.println("Waiting for NTP time sync...");
  struct tm timeinfo;
  while (!getLocalTime(&timeinfo)) {
    Serial.print(".");
    delay(1000);
  }
  Serial.println("\nTime synchronized.");
}

void loop() {
  // Check WiFi connection status
  if (WiFi.status() == WL_CONNECTED) {

    // 1. Read Temperature
    sensors.requestTemperatures();
    float temperatureC = sensors.getTempCByIndex(0);

    // 2. Get Timestamp
    struct tm timeinfo;
    if (!getLocalTime(&timeinfo)) {
      Serial.println("Failed to obtain time");
      return;
    }

    char timeStringBuff[50]; // Example: 2026-09-08T19:15:00
    strftime(timeStringBuff, sizeof(timeStringBuff), "%Y-%m-%dT%H:%M:%S",
             &timeinfo);

    // 3. Prepare JSON Payload
    StaticJsonDocument<200> doc;
    doc["device_id"] = DEVICE_ID;
    doc["milk_id"] = MILK_ID;
    doc["temperature_c"] = temperatureC;
    doc["timestamp"] = String(timeStringBuff);

    String jsonOutput;
    serializeJson(doc, jsonOutput);

    // 4. Send HTTP POST Request
    HTTPClient http;
    http.begin(serverName);
    http.addHeader("Content-Type", "application/json");

    int httpResponseCode = http.POST(jsonOutput);

    if (httpResponseCode > 0) {
      Serial.print("HTTP Response code: ");
      Serial.println(httpResponseCode);
      String payload = http.getString();
      Serial.println(payload);
    } else {
      Serial.print("Error code: ");
      Serial.println(httpResponseCode);
    }

    http.end();
  } else {
    Serial.println("WiFi Disconnected");
  }

  // Send reading every 5 minutes (300,000 ms)
  delay(300000);
}
