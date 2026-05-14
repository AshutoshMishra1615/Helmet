// helmet_firmware.ino  —  MQTT version
#include <WiFi.h>
#include <PubSubClient.h>
#include <ArduinoJson.h>
#include <Wire.h>
#include <Adafruit_MPU6050.h>
#include <Adafruit_Sensor.h>
#include <TinyGPSPlus.h>
#include <HardwareSerial.h>

// ─── Configuration ───────────────────────────────────────────────────────────
const char* WIFI_SSID      = "pyro";
const char* WIFI_PASS      = "pyro1234";
const char* MQTT_BROKER    = "10.42.0.1";  
const int   MQTT_PORT      = 1883;
const char* WORKER_ID      = "W101";  // Change per helmet

// ─── Pin Definitions ─────────────────────────────────────────────────────────
#define MQ2_PIN        34
#define BUZZER_PIN      4
#define LED_SAFE       25
#define LED_WARNING    26
#define LED_CRITICAL   27
#define LED_FALL       14
#define GPS_RX_PIN     16
#define GPS_TX_PIN     17

// ─── Thresholds ──────────────────────────────────────────────────────────────
#define GAS_WARNING    200
#define GAS_CRITICAL   300
#define FALL_THRESHOLD  25.0f   
#define FALL_CONFIRM    2       // Require 2 consecutive high-g readings to confirm fall
#define SEND_INTERVAL  2000    // ms

// ─── MQTT Topic ──────────────────────────────────────────────────────────────
char MQTT_TOPIC[64];

// ─── Globals ─────────────────────────────────────────────────────────────────
Adafruit_MPU6050 mpu;
TinyGPSPlus      gps;
HardwareSerial   gpsSerial(2);
WiFiClient       wifiClient;
PubSubClient     mqtt(wifiClient);

bool     fallDetected  = false;
int      fallCounter   = 0;      // consecutive high-g spike counter
uint32_t lastSendTime  = 0;

// ─── WiFi ────────────────────────────────────────────────────────────────────
void connectWiFi() {
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting to WiFi");
  while (WiFi.status() != WL_CONNECTED) {
    delay(500); Serial.print(".");
  }
  Serial.println("\nConnected! IP: " + WiFi.localIP().toString());
}

// ─── MQTT ────────────────────────────────────────────────────────────────────
void connectMQTT() {
  String clientId = String("helmet-") + WORKER_ID;
  while (!mqtt.connected()) {
    Serial.printf("Connecting to MQTT broker %s:%d ...\n", MQTT_BROKER, MQTT_PORT);
    if (mqtt.connect(clientId.c_str())) {
      Serial.println("MQTT connected!");
    } else {
      Serial.printf("MQTT failed, rc=%d — retrying in 3s\n", mqtt.state());
      delay(3000);
    }
  }
}

// ─── Setup ───────────────────────────────────────────────────────────────────
void setup() {
  Serial.begin(115200);
  delay(60000); // ignore first 60 seconds

  // Build topic string: helmet/sensor/W101
  snprintf(MQTT_TOPIC, sizeof(MQTT_TOPIC), "helmet/sensor/%s", WORKER_ID);

  // GPIO
  pinMode(BUZZER_PIN,  OUTPUT);
  pinMode(LED_SAFE,    OUTPUT);
  pinMode(LED_WARNING, OUTPUT);
  pinMode(LED_CRITICAL,OUTPUT);
  pinMode(LED_FALL,    OUTPUT);

  // GPS
  gpsSerial.begin(9600, SERIAL_8N1, GPS_RX_PIN, GPS_TX_PIN);

  // MPU-6050
  if (!mpu.begin()) {
    Serial.println("MPU-6050 not found! Check wiring.");
    while (true) delay(10);
  }
  mpu.setAccelerometerRange(MPU6050_RANGE_8_G);
  mpu.setGyroRange(MPU6050_RANGE_500_DEG);
  mpu.setFilterBandwidth(MPU6050_BAND_21_HZ);

  // WiFi + MQTT
  connectWiFi();
  mqtt.setServer(MQTT_BROKER, MQTT_PORT);
  connectMQTT();

  // Startup blink
  for (int i = 0; i < 3; i++) {
    digitalWrite(LED_SAFE, HIGH); delay(200);
    digitalWrite(LED_SAFE, LOW);  delay(200);
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────
float readGasLevel() {
  long sum = 0;
  for (int i = 0; i < 10; i++) { sum += analogRead(MQ2_PIN); delay(5); }
  return map(sum / 10, 0, 4095, 0, 1000);
}

float readTemperature() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  return temp.temperature;
}

bool checkFall() {
  sensors_event_t a, g, temp;
  mpu.getEvent(&a, &g, &temp);
  float accelMag = sqrt(
    a.acceleration.x * a.acceleration.x +
    a.acceleration.y * a.acceleration.y +
    a.acceleration.z * a.acceleration.z
  );

  if (accelMag > FALL_THRESHOLD) {
    fallCounter++;
    Serial.printf("Fall spike #%d — Accel: %.2f m/s²\n", fallCounter, accelMag);
    if (fallCounter >= FALL_CONFIRM) {
      Serial.printf("FALL CONFIRMED! (%d consecutive spikes > %.1f)\n", fallCounter, FALL_THRESHOLD);
      fallCounter = 0;
      return true;
    }
  } else {
    // Normal reading — reset the counter (it was just a transient bump)
    if (fallCounter > 0) {
      Serial.printf("Fall counter reset (accel back to normal: %.2f m/s²)\n", accelMag);
    }
    fallCounter = 0;
  }
  return false;
}

void updateLEDs(int gasLevel, bool fall) {
  digitalWrite(LED_SAFE,     LOW);
  digitalWrite(LED_WARNING,  LOW);
  digitalWrite(LED_CRITICAL, LOW);
  digitalWrite(LED_FALL,     LOW);

  if (fall)                         digitalWrite(LED_FALL,     HIGH);
  else if (gasLevel > GAS_CRITICAL) digitalWrite(LED_CRITICAL, HIGH);
  else if (gasLevel > GAS_WARNING)  digitalWrite(LED_WARNING,  HIGH);
  else                              digitalWrite(LED_SAFE,     HIGH);
}

void triggerBuzzer(int gasLevel, bool fall) {
  if (fall || gasLevel > GAS_CRITICAL) {
    for (int i = 0; i < 5; i++) {
      digitalWrite(BUZZER_PIN, HIGH); delay(100);
      digitalWrite(BUZZER_PIN, LOW);  delay(100);
    }
  } else if (gasLevel > GAS_WARNING) {
    digitalWrite(BUZZER_PIN, HIGH); delay(500);
    digitalWrite(BUZZER_PIN, LOW);
  }
}

void publishReading(int gasLevel, bool fall, float temperature) {
  StaticJsonDocument<512> doc;
  
  doc["worker_id"]     = WORKER_ID;
  doc["gas_level"]     = gasLevel;
  doc["fall_detected"] = fall;
  doc["temperature"]   = temperature;
  sensors_event_t a, g, temp_mpu;
  mpu.getEvent(&a, &g, &temp_mpu);
  doc["accel_x"] = a.acceleration.x;
  doc["accel_y"] = a.acceleration.y;
  doc["accel_z"] = a.acceleration.z;

  // Check if we have a valid GPS fix
  if (gps.location.isValid()) {
    doc["gps_valid"] = true;
    doc["latitude"]  = gps.location.lat();
    doc["longitude"] = gps.location.lng();
  } else {
    doc["gps_valid"] = false;
    doc["latitude"]  = nullptr;
    doc["longitude"] = nullptr;
  }

  char payload[512];
  serializeJson(doc, payload, sizeof(payload));

  bool ok = mqtt.publish(MQTT_TOPIC, payload, /*retain=*/false);
  
  if (gps.location.isValid()) {
    Serial.printf("%s [%s] gas:%d fall:%d accel:(%.2f,%.2f,%.2f) temp:%.1f GPS: %.4f, %.4f\n",
                  ok ? "✓ MQTT" : "✗ MQTT FAIL",
                  MQTT_TOPIC, gasLevel, fall,
                  a.acceleration.x, a.acceleration.y, a.acceleration.z,
                  temperature, gps.location.lat(), gps.location.lng());
  } else {
    Serial.printf("%s [%s] gas:%d fall:%d accel:(%.2f,%.2f,%.2f) temp:%.1f GPS: No Fix\n",
                  ok ? "✓ MQTT" : "✗ MQTT FAIL",
                  MQTT_TOPIC, gasLevel, fall,
                  a.acceleration.x, a.acceleration.y, a.acceleration.z,
                  temperature);
  }
}

// ─── Main Loop ───────────────────────────────────────────────────────────────
void loop() {
  // Keep WiFi alive
  if (WiFi.status() != WL_CONNECTED) connectWiFi();

  // Keep MQTT alive
  if (!mqtt.connected()) connectMQTT();
  mqtt.loop();  // process keep-alive

  // Feed GPS parser constantly so it doesn't lose data
  while (gpsSerial.available()) {
    gps.encode(gpsSerial.read());
  }

  // Poll fall detection
  if (checkFall()) fallDetected = true;

  // Publish at fixed interval
  uint32_t now = millis();
  if (now - lastSendTime >= SEND_INTERVAL) {
    lastSendTime = now;

    int   gasLevel    = readGasLevel();
    float temperature = readTemperature();

    updateLEDs(gasLevel, fallDetected);
    triggerBuzzer(gasLevel, fallDetected);
    publishReading(gasLevel, fallDetected, temperature);

    fallDetected = false;  // reset after reporting
  }
}
