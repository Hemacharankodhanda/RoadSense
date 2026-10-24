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
#include <WiFi.h>
#include <HTTPClient.h>
#include <ArduinoJson.h>

const char* ssid = "YOUR_WIFI_SSID";
const char* password = "YOUR_WIFI_PASSWORD";

// Your Firebase Realtime Database REST endpoint
const char* rtdbUrl = "https://roadsense-2b385-default-rtdb.firebaseio.com/readings.json";

void sendPotholeTelemetry(float lat, float lng, float peakG, float speedKmH) {
  if (WiFi.status() != WL_CONNECTED) return;

  HTTPClient http;
  http.begin(rtdbUrl);
  http.addHeader("Content-Type", "application/json");

  // Format telemetry payload
  StaticJsonDocument<256> doc;
  doc["deviceId"] = "ESP32_NODE_01";
  doc["lat"] = lat;
  doc["lng"] = lng;
  doc["magnitude"] = peakG;
  doc["speed"] = speedKmH;
  doc["timestamp"] = "2026-10-23T03:30:00Z";

  String requestBody;
  serializeJson(doc, requestBody);

  int httpResponseCode = http.POST(requestBody);
  if (httpResponseCode > 0) {
    Serial.printf("[HTTP] Pothole telemetry sent successfully! Response code: %d\n", httpResponseCode);
  } else {
    Serial.printf("[HTTP] Error sending telemetry: %s\n", http.errorToString(httpResponseCode).c_str());
  }
  http.end();
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
