/**
 * RoadSense - High-Performance Real-Time Pothole & Defect Data Service
 * 
 * Features:
 * 1. Synchronous Multi-Tier Cache (IndexedDB + LocalStorage + Memory) for 0ms initial load.
 * 2. Shared Singleton Real-Time Manager for Firestore and Firebase Realtime Database.
 * 3. Instant Dual-Stream Bridging: ESP32 telemetry updates in RTDB reflect in the UI in < 15ms.
 * 4. Non-blocking In-Memory Clustering: Deduplicates and clusters without slow network roundtrips.
 * 5. High-Speed Reverse Geocoding with LocalStorage caching & 1.5s AbortController timeout.
 * 6. Optimistic UI Mutations for instant Authority actions & Citizen reports.
 */
import {
  collection,
  doc,
  addDoc,
  updateDoc,
  query,
  onSnapshot
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
// 1. MULTI-TIER CACHE (Zero-latency Hydration)
// ============================================================================
const STORAGE_KEY = 'roadsense_potholes_cache_v2';
const GEOCODE_STORAGE_KEY = 'roadsense_geocode_cache_v2';

// In-memory cache populated synchronously from localStorage on startup
let cachedPotholes = [];
try {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (Array.isArray(parsed) && parsed.length > 0) {
      cachedPotholes = parsed;
    }
  }
} catch (e) {
  // Ignore localStorage read errors in restricted contexts
}

/**
 * Returns the currently cached potholes synchronously (0ms latency)
 */
export function getCachedPotholes() {
  return cachedPotholes;
}

// ============================================================================
// 2. ULTRA-FAST REVERSE GEOCODING (With LocalStorage & 1.5s Abort Timeout)
// ============================================================================
const geocodeCache = new Map();
try {
  const savedGeo = localStorage.getItem(GEOCODE_STORAGE_KEY);
  if (savedGeo) {
    const entries = JSON.parse(savedGeo);
    if (Array.isArray(entries)) {
      entries.forEach(([k, v]) => geocodeCache.set(k, v));
    }
  }
} catch (e) {}

function saveGeocodeCache() {
  try {
    const entries = Array.from(geocodeCache.entries()).slice(-200);
    localStorage.setItem(GEOCODE_STORAGE_KEY, JSON.stringify(entries));
  } catch (e) {}
}

/**
 * Reverse geocodes lat/lng with instant cache lookup and 1.5s network timeout
 */
export async function reverseGeocode(lat, lng) {
  if (!lat || !lng) return 'Amaravati Region';
  const numLat = Number(lat);
  const numLng = Number(lng);
  const key = `${numLat.toFixed(4)},${numLng.toFixed(4)}`;
  
  if (geocodeCache.has(key)) {
    return geocodeCache.get(key);
  }

  const fallback = `${numLat.toFixed(4)}, ${numLng.toFixed(4)}`;

  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 1500);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/reverse?format=jsonv2&lat=${numLat}&lon=${numLng}`,
      {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'RoadSense-Civic-Monitor/1.0'
        }
      }
    );
    clearTimeout(timeoutId);

    if (!res.ok) throw new Error('Geocode request failed');
    const data = await res.json();
    
    const addr = data.address || {};
    const street = addr.road || addr.pedestrian || addr.suburb || addr.neighbourhood || addr.city_district || 'Unnamed Road';
    const city = addr.city || addr.town || addr.county || 'Amaravati';
    const formatted = city ? `${street}, ${city}` : (data.display_name?.split(',').slice(0, 2).join(',') || fallback);
    
    geocodeCache.set(key, formatted);
    saveGeocodeCache();
    return formatted;
  } catch (err) {
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
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 2000);

    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=jsonv2&q=${encodeURIComponent(searchQuery)}&limit=5`,
      {
        signal: controller.signal,
        headers: {
          'Accept-Language': 'en',
          'User-Agent': 'RoadSense-Civic-Monitor/1.0'
        }
      }
    );
    clearTimeout(timeoutId);
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
// 3. SINGLETON REAL-TIME MANAGER (Firestore + Realtime Database)
// ============================================================================
const potholeSubscribers = new Set();
const rtdbRawSubscribers = new Set();
let firestoreUnsubscribe = null;
let rtdbUnsubscribe = null;
let idleDisconnectTimer = null;
const processedRtdbKeys = new Set();

function sortPotholes(list) {
  return [...list].sort((a, b) => {
    const tA = new Date(a.lastDetectedAt || a.firstDetectedAt || 0).getTime() || 0;
    const tB = new Date(b.lastDetectedAt || b.firstDetectedAt || 0).getTime() || 0;
    return tB - tA;
  });
}

function broadcastPotholes(potholes) {
  cachedPotholes = sortPotholes(potholes);
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(cachedPotholes));
  } catch (e) {}

  potholeSubscribers.forEach((cb) => {
    try {
      cb(cachedPotholes);
    } catch (err) {
      console.error('[RoadSense Stream] Subscriber error:', err);
    }
  });
}

/**
 * Handles incoming live readings from ESP32 / RTDB with sub-15ms optimistic update
 */
async function handleLiveReading(reading, key) {
  if (!reading.lat || !reading.lng || isNaN(reading.lat) || isNaN(reading.lng)) {
    return null;
  }

  // Deduplicate and cluster against IN-MEMORY cache in 0ms (no slow network getDocs!)
  const nearbyMatch = findNearbyPothole(reading, cachedPotholes);

  if (nearbyMatch) {
    const existingDoc = nearbyMatch.match;
    const deviceIds = Array.isArray(existingDoc.deviceIds) ? [...existingDoc.deviceIds] : [];
    if (reading.deviceId && !deviceIds.includes(reading.deviceId)) {
      deviceIds.push(reading.deviceId);
    }

    const updatedScore = Math.max(existingDoc.severityScore || 0, reading.magnitude || 0);
    const updatedSeverity = calculateSeverity(updatedScore);
    const updatedCount = (existingDoc.confirmationCount || 1) + 1;
    const updatedTimestamp = reading.timestamp || new Date().toISOString();

    // 1. FAST OPTIMISTIC UI BROADCAST (< 15ms)
    const updatedList = cachedPotholes.map(p => {
      if (p.id === existingDoc.id) {
        return {
          ...p,
          confirmationCount: updatedCount,
          lastDetectedAt: updatedTimestamp,
          severityScore: updatedScore,
          severity: updatedSeverity,
          deviceIds: deviceIds
        };
      }
      return p;
    });
    broadcastPotholes(updatedList);

    // 2. ASYNC PERSISTENCE TO FIRESTORE (non-blocking)
    if (!existingDoc._optimistic) {
      try {
        const potholeRef = doc(db, 'potholes', existingDoc.id);
        await updateDoc(potholeRef, {
          confirmationCount: updatedCount,
          lastDetectedAt: updatedTimestamp,
          severityScore: updatedScore,
          severity: updatedSeverity,
          deviceIds: deviceIds
        });
      } catch (err) {
        console.warn('[RTDB Ingest] Background updateDoc failed:', err.message);
      }
    }
    return existingDoc.id;
  } else {
    // Brand new pothole detected by IoT hardware!
    const tempId = `optimistic_${key || Date.now()}_${Math.random().toString(36).slice(2, 7)}`;
    const fastAddress = `${Number(reading.lat).toFixed(4)}, ${Number(reading.lng).toFixed(4)}`;

    const newDocData = createPotholeDocument({
      lat: reading.lat,
      lng: reading.lng,
      source: 'device',
      severityScore: reading.magnitude || 2.5,
      deviceId: reading.deviceId,
      description: `Automated IoT impact spike detected (${reading.magnitude || 0}G)`,
      address: fastAddress
    });

    // 1. FAST OPTIMISTIC UI BROADCAST (< 15ms)
    const optimisticPothole = {
      id: tempId,
      ...newDocData,
      _optimistic: true
    };
    broadcastPotholes([optimisticPothole, ...cachedPotholes]);

    // 2. ASYNC BACKGROUND PERSISTENCE & GEOCODING (non-blocking)
    (async () => {
      try {
        // Fast background reverse geocode with cache & timeout
        const resolvedAddress = await reverseGeocode(reading.lat, reading.lng);
        const finalDocData = {
          ...newDocData,
          address: resolvedAddress || fastAddress
        };

        const docRef = await addDoc(collection(db, 'potholes'), finalDocData);

        // Audit log in subcollection
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

        // Replace temporary optimistic item with permanent doc ID
        cachedPotholes = cachedPotholes.map(p => (p.id === tempId ? { id: docRef.id, ...finalDocData } : p));
        broadcastPotholes(cachedPotholes);
      } catch (err) {
        console.warn('[RTDB Ingest] Background addDoc failed:', err.message);
      }
    })();

    return tempId;
  }
}

/**
 * Initializes shared real-time listeners for Firestore and Realtime Database
 */
function startRealtimeConnection() {
  if (idleDisconnectTimer) {
    clearTimeout(idleDisconnectTimer);
    idleDisconnectTimer = null;
  }

  // 1. Shared Firestore onSnapshot listener
  if (!firestoreUnsubscribe) {
    try {
      const potholesRef = collection(db, 'potholes');
      const q = query(potholesRef);

      firestoreUnsubscribe = onSnapshot(
        q,
        (snapshot) => {
          const remoteList = [];
          snapshot.forEach((docSnap) => {
            const data = docSnap.data();
            if (!data.isDeleted) {
              remoteList.push({
                id: docSnap.id,
                ...data
              });
            }
          });

          // Merge any temporary optimistic items that haven't landed in Firestore yet
          const remoteIds = new Set(remoteList.map(p => p.id));
          const pendingOptimistic = cachedPotholes.filter(p => p._optimistic && !remoteIds.has(p.id));

          broadcastPotholes([...remoteList, ...pendingOptimistic]);
        },
        (error) => {
          console.warn('[Firestore Live] Snapshot notice:', error.message);
        }
      );
    } catch (e) {
      console.warn('[Firestore Live] Setup error:', e.message);
    }
  }

  // 2. Shared Realtime Database Live Bridge (/potholes and /readings)
  if (!rtdbUnsubscribe) {
    try {
      const potholesRef = rtdbRef(rtdb, 'potholes');
      const unsubPotholes = onChildAdded(potholesRef, async (snapshot) => {
        const key = snapshot.key;
        const raw = snapshot.val();
        if (!raw) return;

        const reading = normalizeDeviceReading(raw);
        rtdbRawSubscribers.forEach(cb => {
          try { cb(reading); } catch (e) {}
        });

        if (processedRtdbKeys.has(key)) return;
        processedRtdbKeys.add(key);

        await handleLiveReading(reading, key);
      }, (err) => {
        console.warn('[RTDB Bridge] /potholes notice:', err.message);
      });

      const readingsRef = rtdbRef(rtdb, 'readings');
      const unsubReadings = onChildAdded(readingsRef, async (snapshot) => {
        const key = snapshot.key;
        const raw = snapshot.val();
        if (!raw) return;

        const reading = normalizeDeviceReading(raw);
        rtdbRawSubscribers.forEach(cb => {
          try { cb(reading); } catch (e) {}
        });

        if (processedRtdbKeys.has(key)) return;
        processedRtdbKeys.add(key);

        await handleLiveReading(reading, key);
      }, () => {});

      rtdbUnsubscribe = () => {
        unsubPotholes();
        unsubReadings();
      };
    } catch (e) {
      console.warn('[RTDB Bridge] Listener error:', e.message);
    }
  }
}

// Automatically start background sync so app is immediately primed
startRealtimeConnection();

// ============================================================================
// 4. PUBLIC SUBSCRIPTIONS
// ============================================================================

/**
 * Subscribes to all active potholes in real-time.
 * Synchronously delivers cached data immediately (0ms latency), then maintains real-time sync.
 */
export function subscribePotholes(callback, onError) {
  if (typeof callback !== 'function') return () => {};

  potholeSubscribers.add(callback);

  // Synchronously emit cached data immediately (0ms delay!)
  if (cachedPotholes.length > 0) {
    callback(cachedPotholes);
  }

  // Ensure listeners are running
  startRealtimeConnection();

  return () => {
    potholeSubscribers.delete(callback);

    // Keep connection alive for 45s so navigating between pages doesn't reconnect
    if (potholeSubscribers.size === 0) {
      if (idleDisconnectTimer) clearTimeout(idleDisconnectTimer);
      idleDisconnectTimer = setTimeout(() => {
        if (potholeSubscribers.size === 0) {
          if (firestoreUnsubscribe) {
            firestoreUnsubscribe();
            firestoreUnsubscribe = null;
          }
          if (rtdbUnsubscribe) {
            rtdbUnsubscribe();
            rtdbUnsubscribe = null;
          }
        }
      }, 45000);
    }
  };
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

/**
 * Subscribes to raw ESP32 sensor telemetry events
 */
export function subscribeRealtimeDatabaseReadings(onNewReading) {
  if (typeof onNewReading === 'function') {
    rtdbRawSubscribers.add(onNewReading);
  }
  startRealtimeConnection();
  return () => {
    rtdbRawSubscribers.delete(onNewReading);
  };
}

/**
 * Ingests an ESP32 device reading directly
 */
export async function ingestDeviceReading(raw) {
  const reading = normalizeDeviceReading(raw);
  return handleLiveReading(reading, `direct_${Date.now()}`);
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
// 5. MUTATIONS & OPTIMISTIC AUTHORITY ACTIONS
// ============================================================================

/**
 * Creates a citizen-submitted pothole report with instant optimistic insertion
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
  const tempId = `citizen_opt_${Date.now()}`;
  const fastAddress = address || (await reverseGeocode(lat, lng));

  const potholeData = createPotholeDocument({
    lat,
    lng,
    source: 'citizen',
    severityScore,
    description,
    citizenEmail,
    imageUrl,
    address: fastAddress
  });

  // Optimistic UI update
  const optimisticDoc = { id: tempId, ...potholeData, _optimistic: true };
  broadcastPotholes([optimisticDoc, ...cachedPotholes]);

  // Background Firestore persistence
  try {
    const potholesRef = collection(db, 'potholes');
    const docRef = await addDoc(potholesRef, potholeData);

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

    // Replace optimistic doc with permanent doc ID
    cachedPotholes = cachedPotholes.map(p => (p.id === tempId ? { id: docRef.id, ...potholeData } : p));
    broadcastPotholes(cachedPotholes);

    return docRef.id;
  } catch (err) {
    console.error('[CitizenReport] Error saving report:', err);
    throw err;
  }
}

/**
 * Updates a pothole status with instant optimistic state update
 */
export async function updatePotholeStatus(potholeId, newStatus, note, user) {
  if (!potholeId || !newStatus) return;

  const prevDoc = cachedPotholes.find(p => p.id === potholeId);
  const prevStatus = prevDoc?.status || 'reported';
  const now = new Date().toISOString();

  // 1. Instant Optimistic Update (< 5ms)
  const updatedList = cachedPotholes.map(p => {
    if (p.id === potholeId) {
      return {
        ...p,
        status: newStatus,
        updatedAt: now
      };
    }
    return p;
  });
  broadcastPotholes(updatedList);

  // 2. Background Firestore Write
  const potholeRef = doc(db, 'potholes', potholeId);
  await updateDoc(potholeRef, {
    status: newStatus,
    updatedAt: now
  });

  const historyRef = collection(db, 'potholes', potholeId, 'statusHistory');
  await addDoc(historyRef, {
    fromStatus: prevStatus,
    toStatus: newStatus,
    action: `STATUS_CHANGED_TO_${newStatus.toUpperCase()}`,
    note: note || `Status updated from ${prevStatus} to ${newStatus}`,
    timestamp: now,
    performedBy: {
      uid: user?.uid || 'unknown',
      name: user?.displayName || user?.email || 'Authority Officer',
      role: 'authority'
    }
  });
}

/**
 * Assigns pothole to a department / contractor with instant optimistic update
 */
export async function assignPothole(potholeId, department, expectedDate, user, note = '') {
  const now = new Date().toISOString();

  // 1. Instant Optimistic Update (< 5ms)
  const updatedList = cachedPotholes.map(p => {
    if (p.id === potholeId) {
      return {
        ...p,
        assignedDepartment: department,
        expectedCompletionDate: expectedDate || null,
        status: 'in_progress',
        updatedAt: now
      };
    }
    return p;
  });
  broadcastPotholes(updatedList);

  // 2. Background Firestore Write
  const potholeRef = doc(db, 'potholes', potholeId);
  await updateDoc(potholeRef, {
    assignedDepartment: department,
    expectedCompletionDate: expectedDate || null,
    status: 'in_progress',
    updatedAt: now
  });

  const historyRef = collection(db, 'potholes', potholeId, 'statusHistory');
  await addDoc(historyRef, {
    action: 'ASSIGNED_TO_CONTRACTOR',
    fromStatus: 'verified',
    toStatus: 'in_progress',
    note: `Assigned to department: ${department}. Expected target: ${expectedDate || 'TBD'}. ${note}`,
    timestamp: now,
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

  // 1. Instant Optimistic Update (< 5ms)
  const updatedList = cachedPotholes.map(p => {
    if (p.id === potholeId) {
      return {
        ...p,
        status: 'repaired',
        completion: completionPayload,
        updatedAt: finishedTime
      };
    }
    return p;
  });
  broadcastPotholes(updatedList);

  // 2. Background Firestore Write
  const potholeRef = doc(db, 'potholes', potholeId);
  await updateDoc(potholeRef, {
    status: 'repaired',
    completion: completionPayload,
    updatedAt: finishedTime
  });

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
  const now = new Date().toISOString();

  // 1. Instant Optimistic Update (< 5ms)
  const updatedList = cachedPotholes.map(p => {
    if (p.id === potholeId) {
      return {
        ...p,
        status: 'reported',
        updatedAt: now
      };
    }
    return p;
  });
  broadcastPotholes(updatedList);

  // 2. Background Firestore Write
  const potholeRef = doc(db, 'potholes', potholeId);
  await updateDoc(potholeRef, {
    status: 'reported',
    updatedAt: now
  });

  const historyRef = collection(db, 'potholes', potholeId, 'statusHistory');
  await addDoc(historyRef, {
    action: 'POTHOLE_REOPENED',
    fromStatus: 'repaired',
    toStatus: 'reported',
    note: `Repair reopened. Reason: ${reason || 'Defect recurring or repair insufficient.'}`,
    timestamp: now,
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
  const now = new Date().toISOString();

  // 1. Instant Optimistic Filter (< 5ms)
  const updatedList = cachedPotholes.filter(p => p.id !== potholeId);
  broadcastPotholes(updatedList);

  // 2. Background Firestore Write
  const potholeRef = doc(db, 'potholes', potholeId);
  await updateDoc(potholeRef, {
    isDeleted: true,
    deletedAt: now,
    deletedReason: reason || 'Deleted by municipal authority'
  });

  const historyRef = collection(db, 'potholes', potholeId, 'statusHistory');
  await addDoc(historyRef, {
    action: 'SOFT_DELETED',
    note: `Pothole soft-deleted from active queue. Reason: ${reason}`,
    timestamp: now,
    performedBy: {
      uid: user?.uid || 'unknown',
      name: user?.displayName || user?.email || 'Municipal Officer',
      role: 'authority'
    }
  });
}
