// ═══════════════════════════════════════════════════════════════════
//  HONEY CHAIN — ESP32 + DHT11/DHT22 Firmware
// ═══════════════════════════════════════════════════════════════════
// 
//  Wiring (DHT11/DHT22 → ESP32):
//    DHT VCC  → ESP32 3.3V
//    DHT GND  → ESP32 GND
//    DHT DATA → ESP32 GPIO 4
//
//  MQTT publishes to: hive/{hive_id}/telemetry
// ═══════════════════════════════════════════════════════════════════

#include <WiFi.h>
#include <PubSubClient.h>
#include <DHT.h>

// ── ✏️  CONFIGURE THESE ──────────────────────────────────────────

// WiFi credentials (connect ESP32 to same network as backend)
const char* WIFI_SSID = "YOUR_WIFI_SSID";          // ← Change this
const char* WIFI_PASSWORD = "YOUR_WIFI_PASSWORD";   // ← Change this

// MQTT Broker (use your computer's local IP if running Mosquitto locally)
const char* MQTT_BROKER = "192.168.1.100";          // ← Change to your PC's IP
const int MQTT_PORT = 1883;
const char* MQTT_USER = "";
const char* MQTT_PASS = "";

// Hive ID — must match a hive in the database (H001-H030 exist in seed data)
const char* HIVE_ID = "H001";
const char* TOPIC_TEMPLATE = "hive/%s/telemetry";

// ── Pin Configuration ────────────────────────────────────────────
#define DHT_PIN 4             // GPIO 4
#define DHT_TYPE DHT22        // Use DHT11 if you have DHT11 sensor

// ── Timing ────────────────────────────────────────────────────────
const long PUBLISH_INTERVAL = 10000;  // 10 seconds

// ═══════════════════════════════════════════════════════════════════
//  DO NOT CHANGE BELOW THIS LINE
// ═══════════════════════════════════════════════════════════════════

WiFiClient espClient;
PubSubClient mqttClient(espClient);
DHT dht(DHT_PIN, DHT_TYPE);

char topic[64];
char payload[256];
unsigned long lastPublish = 0;


void setupWiFi() {
  Serial.print("Connecting to WiFi");
  WiFi.begin(WIFI_SSID, WIFI_PASSWORD);
  
  while (WiFi.status() != WL_CONNECTED) {
    delay(500);
    Serial.print(".");
  }
  
  Serial.println("\nWiFi connected");
  Serial.print("IP address: ");
  Serial.println(WiFi.localIP());
}


void setupMQTT() {
  mqttClient.setServer(MQTT_BROKER, MQTT_PORT);
  snprintf(topic, sizeof(topic), TOPIC_TEMPLATE, HIVE_ID);
}


bool reconnectMQTT() {
  if (!mqttClient.connected()) {
    Serial.print("Connecting to MQTT...");
    if (mqttClient.connect(HIVE_ID, MQTT_USER, MQTT_PASS)) {
      Serial.println("connected");
      mqttClient.subscribe("hive/+/command");
    } else {
      Serial.print("failed, rc=");
      Serial.print(mqttClient.state());
      Serial.println(" retrying in 5s");
    }
  }
  return mqttClient.connected();
}


void publishReading() {
  float temperature = dht.readTemperature();
  float humidity = dht.readHumidity();
  
  if (isnan(temperature) || isnan(humidity)) {
    Serial.println("Failed to read from DHT sensor");
    return;
  }
  
  // For prototype: weight and sound are placeholders
  // In production, read from HX711 load cell and sound sensor
  float weight = 25.0;    // Placeholder — replace with load cell reading
  float soundLevel = 55.0; // Placeholder — replace with sound sensor
  
  snprintf(payload, sizeof(payload),
    "{\"hive_id\":\"%s\",\"temperature\":%.1f,\"humidity\":%.1f,"
    "\"weight\":%.1f,\"sound_level\":%.0f,\"timestamp\":\"%s\"}",
    HIVE_ID, temperature, humidity, weight, soundLevel,
    getISO8601Time().c_str());
  
  if (mqttClient.publish(topic, payload)) {
    Serial.print("Published: ");
    Serial.println(payload);
  } else {
    Serial.println("Publish failed");
  }
}


String getISO8601Time() {
  // Simplified — in production use NTP-based time
  struct tm timeinfo;
  if (!getLocalTime(&timeinfo)) {
    return "2026-01-01T00:00:00Z";
  }
  char buf[30];
  strftime(buf, sizeof(buf), "%Y-%m-%dT%H:%M:%SZ", &timeinfo);
  return String(buf);
}


void setup() {
  Serial.begin(115200);
  Serial.println("\n--- Honey Chain ESP32 ---");
  
  dht.begin();
  setupWiFi();
  setupMQTT();
  
  // Initialize NTP
  configTime(0, 0, "pool.ntp.org", "time.google.com");
}


void loop() {
  if (!mqttClient.connected()) {
    reconnectMQTT();
  }
  mqttClient.loop();
  
  if (millis() - lastPublish > PUBLISH_INTERVAL) {
    publishReading();
    lastPublish = millis();
  }
}