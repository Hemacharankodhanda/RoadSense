/**
 * RoadSense - Data Mapping & Hardware Telemetry Normalization Layer
 * 
 * This file serves as the single source of truth for translating raw ESP32/IoT
 * sensor payloads into the standardized RoadSense Firestore schema.
 * 
 * If your ESP32 firmware uses different JSON keys (e.g., 'lat' vs 'latitude', 
 * 'impact' vs 'magnitude'), simply update FIRMWARE_KEY_MAP below.
 */

// ============================================================================
// 1. HARDWARE KEY MAPPING
// ============================================================================
export const FIRMWARE_KEY_MAP = {
  // Device Identifier
  deviceId: ['deviceId', 'device_id', 'dev_id', 'devId', 'mac', 'node_id'],

  // Coordinates
  lat: ['lat', 'latitude', 'gps_lat', 'latitude_deg'],
  lng: ['lng', 'lon', 'longitude', 'gps_lng', 'longitude_deg'],

  // MPU6050 Accelerometer / Gyro readings
  accelX: ['accelX', 'acc_x', 'ax', 'x'],
  accelY: ['accelY', 'acc_y', 'ay', 'y'],
  accelZ: ['accelZ', 'acc_z', 'az', 'z'],

  // Calculated Impact / Severity
  magnitude: ['magnitude', 'mag', 'impact', 'peak_g', 'g_force', 'accel_mag'],

  // Vehicle Telemetry
  speed: ['speed', 'spd', 'velocity', 'gps_speed_kmh'],

  // Hardware Metadata
  battery: ['battery', 'batt', 'vbat', 'battery_pct'],
  firmwareVersion: ['firmwareVersion', 'fw', 'version'],

  // Telemetry Timestamp
  timestamp: ['timestamp', 'ts', 'time', 'epoch']
};

/**
 * Extracts a normalized value from an incoming raw hardware JSON payload
 * using the key mapping alias list.
 */
function extractField(rawPayload, fieldName, defaultValue = null) {
  const aliases = FIRMWARE_KEY_MAP[fieldName] || [fieldName];
  for (const alias of aliases) {
    if (rawPayload && rawPayload[alias] !== undefined && rawPayload[alias] !== null) {
      return rawPayload[alias];
    }
  }
  return defaultValue;
}

// ============================================================================
// 2. SEVERITY THRESHOLDS & SCORING (MPU-6050 Impact Magnitude in Gs)
// ============================================================================
// Default baseline gravity is ~1.0G. Any sudden vertical spike delta above 1.5G
// indicates road surface distress.
export const SEVERITY_CONFIG = {
  LOW_THRESHOLD: 2.2,    // 1.5G to 2.2G: Minor bump / surface crack
  MEDIUM_THRESHOLD: 3.8, // 2.2G to 3.8G: Moderate pothole / depression
  // Above 3.8G: Severe wheel impact / hazardous crater
};

/**
 * Computes severity category ('low', 'medium', 'high') from MPU6050 magnitude
 */
export function calculateSeverity(magnitude) {
  const mag = Number(magnitude) || 0;
  if (mag >= SEVERITY_CONFIG.MEDIUM_THRESHOLD) {
    return 'high';
  } else if (mag >= SEVERITY_CONFIG.LOW_THRESHOLD) {
    return 'medium';
  }
  return 'low';
}

/**
 * Computes resultant 3-axis magnitude if raw ax, ay, az are provided
 * Result is in G's: sqrt(ax^2 + ay^2 + az^2)
 */
export function computeImpactMagnitude(ax = 0, ay = 0, az = 0) {
  return Math.sqrt(ax * ax + ay * ay + az * az);
}

// ============================================================================
// 3. GEO-CALCULATIONS & GEOHASH (Proximity Clustering)
// ============================================================================
const BASE32 = '0123456789bcdefghjkmnpqrstuvwxyz';

/**
 * Generates standard base32 geohash for Firestore spatial filtering
 */
export function encodeGeohash(lat, lng, precision = 9) {
  let latMin = -90.0, latMax = 90.0;
  let lngMin = -180.0, lngMax = 180.0;
  let hash = '';
  let bits = 0;
  let hashVal = 0;
  let isEven = true;

  while (hash.length < precision) {
    if (isEven) {
      const mid = (lngMin + lngMax) / 2;
      if (lng > mid) {
        hashVal = (hashVal << 1) + 1;
        lngMin = mid;
      } else {
        hashVal = (hashVal << 1);
        lngMax = mid;
      }
    } else {
      const mid = (latMin + latMax) / 2;
      if (lat > mid) {
        hashVal = (hashVal << 1) + 1;
        latMin = mid;
      } else {
        hashVal = (hashVal << 1);
        latMax = mid;
      }
    }
    isEven = !isEven;
    bits++;

    if (bits === 5) {
      hash += BASE32[hashVal];
      bits = 0;
      hashVal = 0;
    }
  }

  return hash;
}

/**
 * Computes accurate Haversine distance in meters between two GPS coordinates
 */
export function getDistanceMeters(lat1, lon1, lat2, lon2) {
  const R = 6371000; // Earth radius in meters
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLon = (lon2 - lon1) * Math.PI / 180;
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Distance threshold for IoT readings deduplication / clustering (in meters)
export const POTHOLE_CLUSTER_RADIUS_METERS = 15;

// ============================================================================
// 4. NORMALIZATION & CONVERSION PIPELINE
// ============================================================================

/**
 * Normalizes an incoming raw device payload to standard Firestore reading schema
 */
export function normalizeDeviceReading(raw) {
  const lat = Number(extractField(raw, 'lat', 0));
  const lng = Number(extractField(raw, 'lng', 0));

  const accelX = Number(extractField(raw, 'accelX', 0));
  const accelY = Number(extractField(raw, 'accelY', 0));
  const accelZ = Number(extractField(raw, 'accelZ', 1.0)); // Default gravity 1G

  let magnitude = Number(extractField(raw, 'magnitude', 0));
  if (!magnitude && (accelX || accelY || accelZ)) {
    magnitude = computeImpactMagnitude(accelX, accelY, accelZ);
  }

  const deviceId = String(extractField(raw, 'deviceId', 'ESP32_UNKNOWN'));
  const speed = Number(extractField(raw, 'speed', 0));
  
  let timestamp = extractField(raw, 'timestamp');
  if (!timestamp) {
    timestamp = new Date().toISOString();
  } else if (typeof timestamp === 'number') {
    // If epoch timestamp
    timestamp = new Date(timestamp > 1e11 ? timestamp : timestamp * 1000).toISOString();
  }

  return {
    deviceId,
    lat,
    lng,
    accelX: parseFloat(accelX.toFixed(3)),
    accelY: parseFloat(accelY.toFixed(3)),
    accelZ: parseFloat(accelZ.toFixed(3)),
    magnitude: parseFloat(magnitude.toFixed(2)),
    speed: parseFloat(speed.toFixed(1)),
    geohash: encodeGeohash(lat, lng, 8),
    timestamp
  };
}

/**
 * Helper to build a new Pothole Document from a device reading or citizen submission
 */
export function createPotholeDocument({
  lat,
  lng,
  source = 'device', // 'device' | 'citizen'
  severityScore = 2.5,
  deviceId = null,
  description = '',
  citizenEmail = null,
  imageUrl = null,
  address = null
}) {
  const numericLat = Number(lat);
  const numericLng = Number(lng);
  const score = Number(severityScore);
  const severity = calculateSeverity(score);
  const now = new Date().toISOString();

  return {
    location: {
      lat: numericLat,
      lng: numericLng
    },
    geohash: encodeGeohash(numericLat, numericLng, 7),
    address: address || `${numericLat.toFixed(5)}, ${numericLng.toFixed(5)}`,
    severity,
    severityScore: parseFloat(score.toFixed(2)),
    status: 'reported', // 'reported' | 'verified' | 'in_progress' | 'repaired' | 'rejected'
    source,
    deviceIds: deviceId ? [deviceId] : [],
    confirmationCount: 1,
    description: description || (source === 'device' ? 'Automated IoT accelerometer spike detected' : 'Citizen submitted report'),
    citizenEmail: citizenEmail || null,
    imageUrl: imageUrl || null,
    firstDetectedAt: now,
    lastDetectedAt: now,
    assignedTo: null,
    assignedDepartment: null,
    expectedCompletionDate: null,
    completion: null, // { completedAt, completedBy, remarks, cost, proofPhotoUrl }
    isDeleted: false
  };
}

/**
 * Client-Side or Edge Deduplication Helper:
 * Checks whether an incoming reading is within ~15m of an existing active pothole.
 * Returns { match: existingDoc, distance } or null if it's a new unique defect.
 */
export function findNearbyPothole(reading, existingPotholes, thresholdMeters = POTHOLE_CLUSTER_RADIUS_METERS) {
  if (!existingPotholes || !existingPotholes.length) return null;

  let closest = null;
  let minDistance = Infinity;

  for (const pothole of existingPotholes) {
    if (pothole.isDeleted || pothole.status === 'repaired' || pothole.status === 'rejected') {
      continue;
    }

    const dist = getDistanceMeters(
      reading.lat,
      reading.lng,
      pothole.location.lat,
      pothole.location.lng
    );

    if (dist <= thresholdMeters && dist < minDistance) {
      minDistance = dist;
      closest = pothole;
    }
  }

  if (closest) {
    return {
      match: closest,
      distance: Math.round(minDistance)
    };
  }

  return null;
}
