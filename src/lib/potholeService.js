/**
 * RoadSense - Pothole & Defect Firestore Service
 * 
 * Provides real-time subscriptions, transactional mutations, status transitions,
 * audit history logging, and geospatial reverse-geocoding.
 */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  where,
  orderBy,
  onSnapshot,
  serverTimestamp,
  getDocs,
  getDoc
} from 'firebase/firestore';
import { ref as rtdbRef, onChildAdded, push as rtdbPush, set as rtdbSet } from 'firebase/database';
import { db, rtdb } from './firebase';
import {
  createPotholeDocument,
  encodeGeohash,
  normalizeDeviceReading,
  findNearbyPothole,
  calculateSeverity
} from './dataMapper';

// ============================================================================
// REVERSE GEOCODING WITH IN-MEMORY LRU CACHE
// ============================================================================
const geocodeCache = new Map();

/**
 * Reverse geocodes a lat/lng to a human-readable street address via OpenStreetMap Nominatim
 */
export async function reverseGeocode(lat, lng) {
  if (!lat || !lng) return 'Unknown Location';
  const key = `${lat.toFixed(4)},${lng.toFixed(4)}`;
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key);
  }

  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${lat}&lon=${lng}`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'RoadSense-Civic-Monitor/1.0'
        }
      }
    );
    if (!res.ok) throw new Error('Geocode request failed');
    const data = await res.json();
    
    // Extract concise street & suburb
    const addr = data.address || {};
    const street = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || addr.city_district || 'Unnamed Road';
    const city = addr.city || addr.town || addr.county || '';
    const formatted = city ? `${street}, ${city}` : (data.display_name?.split(',').slice(0, 2).join(',') || `${lat.toFixed(5)}, ${lng.toFixed(5)}`);
    
    geocodeCache.set(key, formatted);
    return formatted;
  } catch (err) {
    console.warn('[Geocoding] Nominatim lookup skipped:', err.message);
    const fallback = `${Number(lat).toFixed(5)}, ${Number(lng).toFixed(5)}`;
    geocodeCache.set(key, fallback);
    return fallback;
  }
}

/**
 * Forward geocodes an address or neighborhood query using OpenStreetMap Nominatim
 */
export async function forwardGeocode(searchQuery) {
  if (!searchQuery || searchQuery.trim().length < 2) return [];
  try {
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(searchQuery)}&limit=5`,
      {
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'RoadSense-Civic-Monitor/1.0'
        }
      }
    );
    if (!res.ok) return [];
    const data = await res.json();
    return data.map(item => ({
      name: item.display_name,
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      type: item.type
    }));
  } catch (err) {
    console.warn('[Geocoding] Search query failed:', err.message);
    return [];
  }
}

// ============================================================================
// REAL-TIME FIRESTORE SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribes to all active potholes (isDeleted != true) in real-time
 */
export function subscribePotholes(callback, onError) {
  try {
    const potholesRef = collection(db, 'potholes');
    // Simple query to avoid index errors before composite index is deployed
    const q = query(potholesRef);

    const unsubscribe = onSnapshot(
      q,
      (snapshot) => {
        const potholes = [];
        snapshot.forEach((docSnap) => {
          const data = docSnap.data();
          if (!data.isDeleted) {
            potholes.push({
              id: docSnap.id,
              ...data
            });
          }
        });

        // Client-side sort by lastDetectedAt descending
        potholes.sort((a, b) => {
          const tA = new Date(a.lastDetectedAt || a.firstDetectedAt || 0).getTime();
          const tB = new Date(b.lastDetectedAt || b.firstDetectedAt || 0).getTime();
          return tB - tA;
        });

        callback(potholes);
      },
      (error) => {
        console.error('[Firestore] subscribePotholes error:', error);
        if (onError) onError(error);
      }
    );

    return unsubscribe;
  } catch (error) {
    console.error('[Firestore] Initialization error in subscribePotholes:', error);
    if (onError) onError(error);
    return () => {};
  }
}

/**
 * Subscribes to the audit history of a specific pothole
 */
export function subscribeStatusHistory(potholeId, callback) {
  if (!potholeId) return () => {};
  try {
    const historyRef = collection(db, 'potholes', potholeId, 'statusHistory');
    const unsubscribe = onSnapshot(
      historyRef,
      (snapshot) => {
        const history = [];
        snapshot.forEach((docSnap) => {
          history.push({
            id: docSnap.id,
            ...docSnap.data()
          });
        });
        // Sort newest first
        history.sort((a, b) => new Date(b.timestamp || 0).getTime() - new Date(a.timestamp || 0).getTime());
        callback(history);
      },
      (err) => console.warn('[Firestore] Error reading statusHistory:', err)
    );
    return unsubscribe;
  } catch (err) {
    console.warn('[Firestore] Status history failed:', err);
    return () => {};
  }
}

/**
 * Subscribes to connected IoT devices
 */
export function subscribeDevices(callback) {
  try {
    const devRef = collection(db, 'devices');
    return onSnapshot(devRef, (snapshot) => {
      const devices = [];
      snapshot.forEach(docSnap => {
        devices.push({ id: docSnap.id, ...docSnap.data() });
      });
      callback(devices);
    }, (err) => {
      console.warn('[Firestore] Devices subscription error:', err);
    });
  } catch (e) {
    return () => {};
  }
}

// ============================================================================
// REALTIME DATABASE LIVE INGESTION BRIDGE (ESP32 -> RTDB /potholes -> Firestore)
// ============================================================================

/**
 * Listens to incoming ESP32 sensor telemetry from Realtime Database:
 * Endpoint: https://roadsense-2b385-default-rtdb.firebaseio.com/potholes
 */
export function subscribeRealtimeDatabaseReadings(onNewReading) {
  try {
    // Primary path: /potholes (as pushed by ESP32 firmware)
    const potholesRef = rtdbRef(rtdb, 'potholes');
    const unsubPotholes = onChildAdded(potholesRef, async (snapshot) => {
      const raw = snapshot.val();
      if (!raw) return;
      const reading = normalizeDeviceReading(raw);
      if (onNewReading) onNewReading(reading);
      // Auto-ingest into Firestore with ~15m proximity clustering
      await ingestDeviceReading(reading);
    }, (err) => {
      console.warn('[RTDB Bridge /potholes] Listener notice:', err.message);
    });

    // Also support fallback on /readings if telemetry is posted there
    const readingsRef = rtdbRef(rtdb, 'readings');
    const unsubReadings = onChildAdded(readingsRef, async (snapshot) => {
      const raw = snapshot.val();
      if (!raw) return;
      const reading = normalizeDeviceReading(raw);
      if (onNewReading) onNewReading(reading);
      await ingestDeviceReading(reading);
    }, () => {});

    return () => {
      unsubPotholes();
      unsubReadings();
    };
  } catch (err) {
    console.warn('[RTDB Bridge] Realtime Database stream unavailable:', err.message);
    return () => {};
  }
}

/**
 * Ingests an ESP32 device reading:
 * - Checks spatial proximity against active defects (~15m).
 * - If nearby -> increments confirmationCount and upgrades severity if higher.
 * - If new -> creates a new pothole document in Firestore with geocoded address.
 */
export async function ingestDeviceReading(raw) {
  try {
    const reading = normalizeDeviceReading(raw);
    if (!reading.lat || !reading.lng || isNaN(reading.lat) || isNaN(reading.lng)) {
      return null;
    }

    const potholesRef = collection(db, 'potholes');
    const q = query(potholesRef, where('isDeleted', '==', false));
    const snapshot = await getDocs(q);
    const existingList = [];
    snapshot.forEach(docSnap => {
      existingList.push({ id: docSnap.id, ...docSnap.data() });
    });

    const nearbyMatch = findNearbyPothole(reading, existingList);

    if (nearbyMatch) {
      const existingDoc = nearbyMatch.match;
      const potholeRef = doc(db, 'potholes', existingDoc.id);

      const deviceIds = Array.isArray(existingDoc.deviceIds) ? [...existingDoc.deviceIds] : [];
      if (reading.deviceId && !deviceIds.includes(reading.deviceId)) {
        deviceIds.push(reading.deviceId);
      }

      const updatedScore = Math.max(existingDoc.severityScore || 0, reading.magnitude || 0);
      const updatedSeverity = calculateSeverity(updatedScore);

      await updateDoc(potholeRef, {
        confirmationCount: (existingDoc.confirmationCount || 1) + 1,
        lastDetectedAt: reading.timestamp || new Date().toISOString(),
        severityScore: updatedScore,
        severity: updatedSeverity,
        deviceIds: deviceIds
      });

      console.log(`[RTDB Ingestion] Clustered reading into defect #${existingDoc.id} (hits: ${(existingDoc.confirmationCount || 1) + 1})`);
      return existingDoc.id;
    } else {
      const address = await reverseGeocode(reading.lat, reading.lng);
      const newDocData = createPotholeDocument({
        lat: reading.lat,
        lng: reading.lng,
        source: 'device',
        severityScore: reading.magnitude || 2.5,
        deviceId: reading.deviceId,
        description: `Automated IoT impact spike detected (${reading.magnitude || 0}G)`,
        address: address
      });

      const docRef = await addDoc(potholesRef, newDocData);

      const historyRef = collection(db, 'potholes', docRef.id, 'statusHistory');
      await addDoc(historyRef, {
        fromStatus: null,
        toStatus: 'reported',
        action: 'IOT_SENSOR_RTDB_SPIKE',
        note: `Impact spike detected (${reading.magnitude}G) by ${reading.deviceId} at ${reading.speed || 0} km/h.`,
        timestamp: reading.timestamp || new Date().toISOString(),
        performedBy: {
          role: 'device',
          name: reading.deviceId || 'ESP32 Node'
        }
      });

      console.log(`[RTDB Ingestion] Registered new defect from ESP32 reading: ${docRef.id}`);
      return docRef.id;
    }
  } catch (err) {
    console.warn('[RTDB Ingestion] Could not synchronize reading into Firestore:', err.message);
  }
}

/**
 * Pushes raw reading to Realtime Database endpoint at /potholes
 */
export async function pushReadingToRTDB(readingData) {
  try {
    const potholesRef = rtdbRef(rtdb, 'potholes');
    const newEntryRef = rtdbPush(potholesRef);
    await rtdbSet(newEntryRef, {
      ...readingData,
      timestamp: new Date().toISOString()
    });
    return newEntryRef.key;
  } catch (err) {
    console.warn('[RTDB] Push reading failed:', err.message);
  }
}

// ============================================================================
// MUTATIONS & AUTHORITY ACTIONS
// ============================================================================

/**
 * Creates a citizen-submitted pothole report
 */
export async function createCitizenReport({
  lat,
  lng,
  description,
  severityScore = 2.5,
  citizenEmail = null,
  imageUrl = null,
  address = null
}) {
  const potholeData = createPotholeDocument({
    lat,
    lng,
    source: 'citizen',
    severityScore,
    description,
    citizenEmail,
    imageUrl,
    address
  });

  const potholesRef = collection(db, 'potholes');
  const docRef = await addDoc(potholesRef, potholeData);

  // Add initial statusHistory
  const historyRef = collection(db, 'potholes', docRef.id, 'statusHistory');
  await addDoc(historyRef, {
    fromStatus: null,
    toStatus: 'reported',
    action: 'CITIZEN_REPORTED',
    note: description || 'Citizen manual report submitted via public portal.',
    timestamp: new Date().toISOString(),
    performedBy: {
      role: 'citizen',
      email: citizenEmail || 'Anonymous Citizen'
    }
  });

  return docRef.id;
}

/**
 * Updates a pothole status (e.g. Reported -> Verified -> In Progress) with audit logging
 */
export async function updatePotholeStatus(potholeId, newStatus, note, user) {
  if (!potholeId || !newStatus) return;

  const potholeRef = doc(db, 'potholes', potholeId);
  const snap = await getDoc(potholeRef);
  const currentData = snap.exists() ? snap.data() : {};
  const prevStatus = currentData.status || 'reported';

  await updateDoc(potholeRef, {
    status: newStatus,
    updatedAt: new Date().toISOString()
  });

  // Log in subcollection
  const historyRef = collection(db, 'potholes', potholeId, 'statusHistory');
  await addDoc(historyRef, {
    fromStatus: prevStatus,
    toStatus: newStatus,
    action: `STATUS_CHANGED_TO_${newStatus.toUpperCase()}`,
    note: note || `Status updated from ${prevStatus} to ${newStatus}`,
    timestamp: new Date().toISOString(),
    performedBy: {
      uid: user?.uid || 'unknown',
      name: user?.displayName || user?.email || 'Authority Officer',
      role: 'authority'
    }
  });
}

/**
 * Assigns pothole to a department / contractor
 */
export async function assignPothole(potholeId, department, expectedDate, user, note = '') {
  const potholeRef = doc(db, 'potholes', potholeId);
  await updateDoc(potholeRef, {
    assignedDepartment: department,
    expectedCompletionDate: expectedDate || null,
    status: 'in_progress', // auto advance to in_progress upon assignment
    updatedAt: new Date().toISOString()
  });

  const historyRef = collection(db, 'potholes', potholeId, 'statusHistory');
  await addDoc(historyRef, {
    action: 'ASSIGNED_TO_CONTRACTOR',
    fromStatus: 'verified',
    toStatus: 'in_progress',
    note: `Assigned to department: ${department}. Expected target: ${expectedDate || 'TBD'}. ${note}`,
    timestamp: new Date().toISOString(),
    performedBy: {
      uid: user?.uid || 'unknown',
      name: user?.displayName || user?.email || 'Authority Officer',
      role: 'authority'
    }
  });
}

/**
 * Marks work completed with proof photo, remarks, cost, and officer attribution
 */
export async function markPotholeCompleted(potholeId, {
  proofPhotoUrl,
  remarks,
  cost,
  completedAt
}, user) {
  const potholeRef = doc(db, 'potholes', potholeId);
  const finishedTime = completedAt || new Date().toISOString();

  const completionPayload = {
    completedAt: finishedTime,
    completedBy: {
      uid: user?.uid || 'unknown',
      name: user?.displayName || user?.email || 'Municipal Public Works Official',
      department: user?.department || 'Roads & Infrastructure'
    },
    remarks: remarks || 'Road patch completed according to municipal standards.',
    cost: Number(cost) || 0,
    proofPhotoUrl: proofPhotoUrl || null
  };

  await updateDoc(potholeRef, {
    status: 'repaired',
    completion: completionPayload,
    updatedAt: finishedTime
  });

  // Write audit trail
  const historyRef = collection(db, 'potholes', potholeId, 'statusHistory');
  await addDoc(historyRef, {
    action: 'WORK_COMPLETED',
    fromStatus: 'in_progress',
    toStatus: 'repaired',
    note: `Repair completed. Remarks: ${remarks}. Cost: $${cost || 0}`,
    timestamp: finishedTime,
    performedBy: {
      uid: user?.uid || 'unknown',
      name: user?.displayName || user?.email || 'Municipal Officer',
      role: 'authority'
    }
  });
}

/**
 * Reopens a pothole if the repair fails or defect recurs
 */
export async function reopenPothole(potholeId, reason, user) {
  const potholeRef = doc(db, 'potholes', potholeId);
  await updateDoc(potholeRef, {
    status: 'reported',
    updatedAt: new Date().toISOString()
  });

  const historyRef = collection(db, 'potholes', potholeId, 'statusHistory');
  await addDoc(historyRef, {
    action: 'POTHOLE_REOPENED',
    fromStatus: 'repaired',
    toStatus: 'reported',
    note: `Repair reopened. Reason: ${reason || 'Defect recurring or repair insufficient.'}`,
    timestamp: new Date().toISOString(),
    performedBy: {
      uid: user?.uid || 'unknown',
      name: user?.displayName || user?.email || 'Municipal Officer',
      role: 'authority'
    }
  });
}

/**
 * Soft deletes a pothole (Audit trail preservation - no hard deletion)
 */
export async function softDeletePothole(potholeId, reason, user) {
  const potholeRef = doc(db, 'potholes', potholeId);
  await updateDoc(potholeRef, {
    isDeleted: true,
    deletedAt: new Date().toISOString(),
    deletedReason: reason || 'Deleted by municipal authority'
  });

  const historyRef = collection(db, 'potholes', potholeId, 'statusHistory');
  await addDoc(historyRef, {
    action: 'SOFT_DELETED',
    note: `Pothole soft-deleted from active queue. Reason: ${reason}`,
    timestamp: new Date().toISOString(),
    performedBy: {
      uid: user?.uid || 'unknown',
      name: user?.displayName || user?.email || 'Municipal Officer',
      role: 'authority'
    }
  });
}
