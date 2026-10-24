# 🛣️ RoadSense — Civic Road Quality & Pothole Monitoring System

RoadSense is a production-style civic road hazard monitoring platform that bridges real-time IoT hardware telemetry (**ESP32 + MPU6050 Accelerometer + NEO-6M GPS**) with crowdsourced citizen reports and municipal public works authority dispatch.

---

## 🌟 Key Architecture & Highlights

- **Real-Time Data Pipeline**: Directly synchronizes with **Cloud Firestore** via reactive `onSnapshot` streams. No polling, no fake demo toggles.
- **Two Separate Portals**:
  1. **Public Citizen Portal (`/`)**: Full-height interactive Leaflet map, marker clustering, telemetry heatmap, search geocoding, defect inspection drawers, and citizen report form with GPS pinpointing.
  2. **Municipal Authority Portal (`/authority`)**: Role-restricted dashboard (`role: "authority"` verified in Firestore), smart priority queue triage, contractor work order assignment, completion proof photo uploads, repair certification, and RFC4180 CSV report export.
- **Resilient Multi-Tier Storage**: Automatically tries Firebase Storage for before/after photos; seamlessly falls back to high-efficiency client-side WebP/JPEG base64 compression if operating on Firebase's free Spark plan (preventing Blaze plan hard locks).
- **Zero Mock UI**: No fake "simulate" buttons or mock toggles. Initial sample data is provided exclusively via a standalone terminal script (`seed.js`).

---

## 📁 Project Structure

```text
├── src/
│   ├── components/
│   │   ├── authority/
│   │   │   ├── AuthorityActionDrawer.jsx   # Triage, contractor dispatch, proof upload
│   │   │   └── AuthorityLayout.jsx         # Municipal sidebar & top bar
│   │   ├── common/
│   │   │   ├── Badges.jsx                  # Status & severity indicator badges
│   │   │   └── ProtectedRoute.jsx          # Role-based security guard
│   │   ├── map/
│   │   │   └── PotholeMap.jsx              # Leaflet map + clustering + heatmap + OSM geocoder
│   │   ├── potholes/
│   │   │   ├── PotholeDetailModal.jsx      # Citizen inspection drawer & timeline
│   │   │   └── ReportPotholeModal.jsx      # Citizen manual hazard report modal
│   │   └── public/
│   │       ├── PublicHeader.jsx            # Citizen navbar & live telemetry pulse
│   │       ├── PublicStatsCards.jsx        # Top aggregate civic KPIs
│   │       └── PublicTableView.jsx         # Sortable, paginated defect directory
│   ├── context/
│   │   └── AuthContext.jsx                 # Firebase Auth & Firestore role listener
│   ├── lib/
│   │   ├── dataMapper.js                   # ESP32 firmware key mapper & spatial dedupe
│   │   ├── firebase.js                     # Firebase app init & storage fallback
│   │   └── potholeService.js               # Firestore queries, mutations & Nominatim
│   ├── pages/
│   │   ├── authority/
│   │   │   ├── AuthorityCompletedPage.jsx  # Gallery of finished roadworks
│   │   │   ├── AuthorityLogin.jsx          # Official credentials login
│   │   │   ├── AuthorityMapPage.jsx        # Tactical command center map
│   │   │   ├── AuthorityOverview.jsx       # Recharts analytics & KPI dashboard
│   │   │   ├── AuthorityQueuePage.jsx      # Smart priority queue triage
│   │   │   └── AuthorityReportsPage.jsx    # CSV export & audit logs
│   │   └── PublicPortal.jsx                # Main public dashboard
│   ├── App.jsx                             # Router setup
│   ├── index.css                           # Tailwind CSS + Leaflet styles
│   └── main.jsx
├── .env.example                            # Firebase environment template
├── create-authority.js                     # CLI tool to create the first authority user
├── firebase.json                           # Firebase Hosting, Firestore & Storage config
├── firestore.indexes.json                  # Firestore composite queries
├── firestore.rules                         # Production Firestore security rules
├── seed.js                                 # One-time database seed script
├── storage.rules                           # Firebase Storage security rules
└── tailwind.config.js
```

---

## 📡 How ESP32 Data Flows Into RoadSense

### 1. Hardware Sensor Setup
- **Microcontroller**: ESP32 (Wi-Fi / 4G LTE modem / LoRaWAN gateway)
- **Accelerometer / Gyroscope**: MPU-6050 (measures 3-axis G-forces: $a_x, a_y, a_z$)
- **GPS Receiver**: NEO-6M (streams NMEA sentences: latitude, longitude, vehicle speed)

### 2. Firestore Document Schemas

#### A. Raw Readings (`readings/{readingId}`)
When the vehicle passes over a road surface defect, a vertical acceleration threshold spike ($\Delta G > 1.5\text{G}$) triggers a payload write:
```json
{
  "deviceId": "ESP32_PATROL_01",
  "lat": 37.77921,
  "lng": -122.41845,
  "accelX": 0.12,
  "accelY": 0.08,
  "accelZ": 4.65,
  "magnitude": 4.65,
  "speed": 42.5,
  "timestamp": "2026-10-23T02:00:00.000Z"
}
```

#### B. Defect Registry (`potholes/{potholeId}`)
```json
{
  "location": { "lat": 37.7792, "lng": -122.4184 },
  "geohash": "9q8yyk",
  "address": "845 Market St, Downtown Corridor",
  "severity": "high",
  "severityScore": 4.65,
  "status": "reported",
  "source": "device",
  "deviceIds": ["ESP32_BUS_04", "ESP32_PATROL_01"],
  "confirmationCount": 4,
  "firstDetectedAt": "2026-10-19T10:00:00.000Z",
  "lastDetectedAt": "2026-10-23T02:00:00.000Z",
  "assignedDepartment": "Division 4 Paving Team",
  "expectedCompletionDate": "2026-10-25",
  "completion": {
    "completedAt": "2026-10-24T15:30:00.000Z",
    "completedBy": {
      "uid": "officer_123",
      "name": "Inspector Davis",
      "department": "Public Works"
    },
    "remarks": "Hot mix asphalt leveled and rolled flush.",
    "cost": 420,
    "proofPhotoUrl": "https://..."
  },
  "isDeleted": false
}
```

### 3. Spatial Deduplication & Clustering
To prevent 50 different patrol cars from creating 50 separate duplicate pothole markers:
- When a device registers a hit, `src/lib/dataMapper.js` calculates the Haversine distance against active potholes.
- If an existing defect is located within **$\sim 15$ meters**, RoadSense increments `confirmationCount += 1`, appends the `deviceId`, updates `lastDetectedAt`, and elevates `severityScore` if the new impact is higher.
- If no defect is found within 15 meters, a new pothole document is registered.

### 4. ESP32 Firmware Key Mapping (`src/lib/dataMapper.js`)
If your C++ firmware uses different JSON keys (e.g. `latitude` instead of `lat`, `peak_g` instead of `magnitude`), modify the alias map in `src/lib/dataMapper.js`:
```javascript
export const FIRMWARE_KEY_MAP = {
  deviceId: ['deviceId', 'device_id', 'dev_id', 'mac'],
  lat: ['lat', 'latitude', 'gps_lat'],
  lng: ['lng', 'lon', 'longitude'],
  magnitude: ['magnitude', 'mag', 'impact', 'peak_g', 'g_force'],
  speed: ['speed', 'spd', 'gps_speed_kmh']
};
```

---

## 🛠️ ESP32 Firmware Code Example (C++ Arduino)

Here is a ready-to-flash C++ snippet for the ESP32 to push sensor readings directly to your **Firebase Realtime Database** endpoint:

```cpp
#include <Wire.h>
#include <WiFi.h>
#include <WiFiClientSecure.h>
#include <HTTPClient.h>
#include <TinyGPSPlus.h>

// ================= CONFIG =================
const char* WIFI_SSID = "moto edge 50 neo";       // <-- ADD THIS
const char* WIFI_PASS = "11111111";   // <-- ADD THIS
const char* DB_URL    = "firebase rtdb url";

#define TEST_MODE 1   // 1 = fake coordinates when GPS has no fix (indoor testing), 0 = real use only
const double TEST_LAT = 16.4971, TEST_LNG = 80.4997;

const float THRESH_G = 0.6;               // deviation from 1g that counts as a hit
const float MED_G    = 1.0;
const float HIGH_G   = 1.8;
const unsigned long COOLDOWN_MS = 3000;   // ignore repeat triggers
const unsigned long WINDOW_MS   = 150;    // peak capture window

#define MPU_ADDR 0x68
#define GPS_RX 16   // ESP32 RX2 <- NEO-6M TX
#define GPS_TX 17   // ESP32 TX2 -> NEO-6M RX
// ==========================================

TinyGPSPlus gps;

struct Event {
  double lat, lng;
  float peak;
  const char* sev;
  char ts[24];
};

Event queueBuf[20];
int qCount = 0;
unsigned long lastHit = 0, lastWifiTry = 0;

void mpuInit() {
  Wire.begin(21, 22);
  Wire.setClock(400000);
  Wire.beginTransmission(MPU_ADDR); Wire.write(0x6B); Wire.write(0x00); Wire.endTransmission(); // wake up
  Wire.beginTransmission(MPU_ADDR); Wire.write(0x1C); Wire.write(0x10); Wire.endTransmission(); // +-8g range
  Wire.beginTransmission(MPU_ADDR); Wire.write(0x1A); Wire.write(0x03); Wire.endTransmission(); // low-pass filter
}

float readAccelMagG() {
  Wire.beginTransmission(MPU_ADDR);
  Wire.write(0x3B);
  Wire.endTransmission(false);
  Wire.requestFrom(MPU_ADDR, 6);
  int16_t ax = Wire.read() << 8 | Wire.read();
  int16_t ay = Wire.read() << 8 | Wire.read();
  int16_t az = Wire.read() << 8 | Wire.read();
  float x = ax / 4096.0, y = ay / 4096.0, z = az / 4096.0;   // 4096 LSB/g at +-8g
  return sqrt(x * x + y * y + z * z);
}

void feedGPS() {
  while (Serial2.available()) gps.encode(Serial2.read());
}

bool sendEvent(const Event& e) {
  if (WiFi.status() != WL_CONNECTED) return false;

  WiFiClientSecure client;
  client.setInsecure();   // fine for a demo
  HTTPClient http;
  http.begin(client, String(DB_URL) + "/potholes.json");
  http.addHeader("Content-Type", "application/json");

  char body[200];
  snprintf(body, sizeof(body),
           "{\"lat\":%.6f,\"lng\":%.6f,\"severity\":\"%s\",\"peak_g\":%.2f,\"ts\":\"%s\"}",
           e.lat, e.lng, e.sev, e.peak, e.ts);

  int code = http.POST(body);
  http.end();
  Serial.printf("POST -> %d\n", code);
  return code == 200;
}

void flushQueue() {
  while (qCount > 0) {
    if (!sendEvent(queueBuf[0])) break;
    for (int i = 1; i < qCount; i++) queueBuf[i - 1] = queueBuf[i];
    qCount--;
  }
}

void handleHit(float peak) {
  Event e;
  e.peak = peak;
  e.sev = peak >= HIGH_G ? "high" : (peak >= MED_G ? "medium" : "low");

  if (gps.location.isValid() && gps.location.age() < 3000) {
    e.lat = gps.location.lat();
    e.lng = gps.location.lng();
  } else {
#if TEST_MODE
    e.lat = TEST_LAT + random(-50, 50) / 100000.0;
    e.lng = TEST_LNG + random(-50, 50) / 100000.0;
#else
    Serial.println("Hit ignored: no GPS fix");
    return;
#endif
  }

  if (gps.date.isValid() && gps.time.isValid() && gps.date.year() > 2020) {
    snprintf(e.ts, sizeof(e.ts), "%04d-%02d-%02dT%02d:%02d:%02dZ",
             gps.date.year(), gps.date.month(), gps.date.day(),
             gps.time.hour(), gps.time.minute(), gps.time.second());
  } else {
    snprintf(e.ts, sizeof(e.ts), "uptime-%lus", millis() / 1000);
  }

  Serial.printf("POTHOLE %s peak=%.2fg at %.6f,%.6f\n", e.sev, e.peak, e.lat, e.lng);

  if (qCount < 20) queueBuf[qCount++] = e;   // queue first, then try to send
  flushQueue();
}

void setup() {
  Serial.begin(115200);
  delay(500);

  Serial2.setRxBufferSize(1024);
  Serial2.begin(9600, SERIAL_8N1, GPS_RX, GPS_TX);
  mpuInit();

  WiFi.mode(WIFI_STA);
  WiFi.begin(WIFI_SSID, WIFI_PASS);
  Serial.print("Connecting WiFi");
  unsigned long t = millis();
  while (WiFi.status() != WL_CONNECTED && millis() - t < 15000) {
    delay(300);
    Serial.print(".");
  }
  Serial.println(WiFi.status() == WL_CONNECTED ? "\nWiFi OK" : "\nWiFi not connected (will keep retrying)");
}

void loop() {
  feedGPS();

  // keep WiFi alive
  if (WiFi.status() != WL_CONNECTED && millis() - lastWifiTry > 10000) {
    lastWifiTry = millis();
    WiFi.disconnect();
    WiFi.begin(WIFI_SSID, WIFI_PASS);
  }

  float dev = fabs(readAccelMagG() - 1.0);

  if (dev > THRESH_G && millis() - lastHit > COOLDOWN_MS) {
    float peak = dev;
    unsigned long start = millis();
    while (millis() - start < WINDOW_MS) {      // capture the peak of the impact
      feedGPS();
      float d = fabs(readAccelMagG() - 1.0);
      if (d > peak) peak = d;
      delay(2);
    }
    lastHit = millis();
    handleHit(peak);
  }

  // retry queued events every 15 s
  static unsigned long lastFlush = 0;
  if (qCount > 0 && millis() - lastFlush > 15000) {
    lastFlush = millis();
    flushQueue();
  }

  // status line every 5 s
  static unsigned long lastStat = 0;
  if (millis() - lastStat > 5000) {
    lastStat = millis();
    Serial.printf("sats=%d fix=%s wifi=%s queued=%d\n",
                  gps.satellites.value(),
                  gps.location.isValid() ? "yes" : "no",
                  WiFi.status() == WL_CONNECTED ? "yes" : "no",
                  qCount);
  }

  delay(5);   // ~200 Hz sampling
}
```

---

## 🚀 Step-by-Step Setup Guide

### Step 1: Create a Firebase Project
1. Open the [Firebase Console](https://console.firebase.google.com/).
2. Click **Add Project** and name it (e.g. `roadwatch-civic`).
3. Under **Project Settings > General > Your apps**, register a **Web app** (`</>`).
4. Copy the `firebaseConfig` keys.

### Step 2: Enable Firebase Services
- **Authentication**: Enable **Email/Password** sign-in provider in **Authentication > Sign-in method**.
- **Cloud Firestore**: Click **Create database**, choose your preferred region, and start in Production or Test mode.
- **Firebase Storage**: Click **Get Started** in Storage to create the default bucket.
- **Firebase Hosting**: Run `firebase init hosting` or use the included `firebase.json`.

### Step 3: Configure Environment Variables
Copy `.env.example` to `.env`:
```bash
cp .env.example .env
```
Open `.env` and fill in your actual credentials from the Firebase Console:
```env
VITE_FIREBASE_API_KEY=AIzaSy...
VITE_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=your-project
VITE_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=1:...
```

### Step 4: Deploy Security Rules & Indexes
Deploy the production rules included in this repo:
```bash
npm install -g firebase-tools
firebase login
firebase deploy --only firestore:rules,storage:rules,firestore:indexes
```

### Step 5: Seed Sample Potholes (One-Time CLI Script)
Populate realistic GPS potholes across different severity levels and status lifecycle states:
```bash
node seed.js
```

### Step 6: Create Your First Municipal Authority Account
Run the included provisioning script:
```bash
node create-authority.js authority@city.gov Municipal2026! "Chief Inspector Davis" "Roads & Infrastructure"
```

### Step 7: Run Locally
Start the development server:
```bash
npm run dev
```
- Open `http://localhost:5173` for the **Public Citizen Portal**.
- Open `http://localhost:5173/authority/login` to sign in as a **Municipal Officer**.

### Step 8: Deploy to Production
```bash
npm run build
firebase deploy --only hosting
```
Your application will be live on `https://your-project.web.app`!
