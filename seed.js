/**
 * RoadSense - One-Time Database Seeding Script (seed.js)
 * 
 * Usage:
 *   1. Ensure your .env file has valid VITE_FIREBASE_* credentials
 *   2. Run: node seed.js
 * 
 * This script will populate:
 *   - Realistic potholes with varied severities, coordinates, and statuses
 *   - Subcollection statusHistory audit logs
 *   - IoT devices in the `devices` collection
 * 
 * NOTE: As per project requirements, NO mock data or seed buttons exist in the UI.
 * This terminal script is the only method to populate sample telemetry.
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const { initializeApp } = require('firebase/app');
const { getFirestore, collection, doc, setDoc, addDoc } = require('@firebase/firestore');
const dotenv = require('dotenv');

// Load .env
const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);
dotenv.config({ path: resolve(__dirname, '.env') });

const firebaseConfig = {
  apiKey: process.env.VITE_FIREBASE_API_KEY,
  authDomain: process.env.VITE_FIREBASE_AUTH_DOMAIN,
  databaseURL: process.env.VITE_FIREBASE_DATABASE_URL || "https://roadsense-2b385-default-rtdb.firebaseio.com",
  projectId: process.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: process.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.VITE_FIREBASE_APP_ID
};

if (!firebaseConfig.apiKey || firebaseConfig.apiKey.includes('ExampleKey')) {
  console.error('\x1b[31m%s\x1b[0m', '=============================================================');
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: Missing or placeholder Firebase configuration in .env!');
  console.error('\x1b[31m%s\x1b[0m', '=============================================================');
  console.log('Please copy .env.example to .env and fill in your actual Firebase Project credentials.');
  console.log('Then re-run: node seed.js\n');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

// Realistic sample coordinates around VIT-AP University & Amaravati Corridors
const SAMPLE_POTHOLES = [
  {
    id: 'pothole_crater_001',
    location: { lat: 16.4958, lng: 80.4985 },
    geohash: 'tf344f',
    address: 'VIT-AP Main Campus Entrance, Inavolu Road, Amaravati',
    severity: 'high',
    severityScore: 4.65,
    depth_cm: 8.4,
    status: 'reported',
    source: 'device',
    deviceIds: ['ESP32_SHUTTLE_04', 'ESP32_PATROL_01'],
    confirmationCount: 4,
    description: 'Severe impact recorded by campus shuttle vehicles. Deep asphalt depression near main entrance gate.',
    firstDetectedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    lastDetectedAt: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
    assignedDepartment: null,
    expectedCompletionDate: null,
    completion: null,
    isDeleted: false,
    history: [
      {
        fromStatus: null,
        toStatus: 'reported',
        action: 'IOT_IMPACT_DETECTED',
        note: 'High acceleration spike detected (4.65G) by node ESP32_SHUTTLE_04 at 35 km/h.',
        timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        performedBy: { role: 'device', name: 'ESP32_SHUTTLE_04' }
      },
      {
        fromStatus: 'reported',
        toStatus: 'reported',
        action: 'CROWD_CONFIRMATION',
        note: 'Secondary hit recorded by node ESP32_PATROL_01. Confirmation count increased to 4.',
        timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        performedBy: { role: 'device', name: 'ESP32_PATROL_01' }
      }
    ]
  },
  {
    id: 'pothole_crater_002',
    location: { lat: 16.4925, lng: 80.4960 },
    geohash: 'tf344c',
    address: 'Inavolu - Sakhamuru Approach Road, Near MH Blocks',
    severity: 'medium',
    severityScore: 3.10,
    depth_cm: 4.5,
    status: 'verified',
    source: 'citizen',
    deviceIds: ['ESP32_PATROL_02'],
    confirmationCount: 2,
    description: 'Subsurface trench settlement along crosswalk. Wheel jolt reported by university staff.',
    firstDetectedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    lastDetectedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    assignedDepartment: 'Amaravati Infrastructure Works Unit #2',
    expectedCompletionDate: new Date(Date.now() + 2 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    completion: null,
    isDeleted: false,
    history: [
      {
        fromStatus: null,
        toStatus: 'reported',
        action: 'CITIZEN_REPORTED',
        note: 'Citizen report submitted with coordinates.',
        timestamp: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
        performedBy: { role: 'citizen', name: 'Campus Resident' }
      },
      {
        fromStatus: 'reported',
        toStatus: 'verified',
        action: 'REPORT_VERIFIED',
        note: 'Municipal dispatch verified defect against campus road inspection rover.',
        timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        performedBy: { role: 'authority', name: 'Inspector J. Rao' }
      }
    ]
  },
  {
    id: 'pothole_crater_003',
    location: { lat: 16.4992, lng: 80.5035 },
    geohash: 'tf344s',
    address: 'Seed Access Road - AP Secretariat Corridor Junction',
    severity: 'high',
    severityScore: 4.82,
    depth_cm: 7.2,
    status: 'in_progress',
    source: 'device',
    deviceIds: ['ESP32_PATROL_01'],
    confirmationCount: 5,
    description: 'Manhole rim failure with surrounding asphalt breakage. High-priority traffic hazard.',
    firstDetectedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
    lastDetectedAt: new Date(Date.now() - 3 * 24 * 3600 * 1000).toISOString(),
    assignedDepartment: 'Capital Region Development Authority (CRDA) Road Division',
    expectedCompletionDate: new Date(Date.now() + 1 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    completion: null,
    isDeleted: false,
    history: [
      {
        fromStatus: null,
        toStatus: 'reported',
        action: 'IOT_IMPACT_DETECTED',
        note: 'Severe impact (4.82G) recorded.',
        timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        performedBy: { role: 'device', name: 'ESP32_PATROL_01' }
      },
      {
        fromStatus: 'reported',
        toStatus: 'in_progress',
        action: 'ASSIGNED_TO_CONTRACTOR',
        note: 'Crew dispatched on site for emergency hot-mix asphalt filling.',
        timestamp: new Date(Date.now() - 1 * 24 * 3600 * 1000).toISOString(),
        performedBy: { role: 'authority', name: 'CRDA Dispatch' }
      }
    ]
  },
  {
    id: 'pothole_crater_004',
    location: { lat: 16.4885, lng: 80.4910 },
    geohash: 'tf3449',
    address: 'Thullur - Amaravati Arterial Road, Near Sakhamuru Park',
    severity: 'low',
    severityScore: 1.95,
    depth_cm: 2.3,
    status: 'repaired',
    source: 'device',
    deviceIds: ['ESP32_PATROL_02'],
    confirmationCount: 3,
    description: 'Surface weathering and shallow crater patch.',
    firstDetectedAt: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
    lastDetectedAt: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
    assignedDepartment: 'Amaravati Highway Rapid Patch Team',
    expectedCompletionDate: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    completion: {
      completedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
      completedBy: {
        uid: 'auth_seed_officer_01',
        name: 'Officer K. Murthy',
        department: 'Highway Maintenance'
      },
      remarks: 'Hot mix asphalt compacted flush to pavement grade. Sealed with rubberized tack coat.',
      cost: 450,
      proofPhotoUrl: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?auto=format&fit=crop&w=600&q=80'
    },
    isDeleted: false,
    history: [
      {
        fromStatus: null,
        toStatus: 'reported',
        action: 'IOT_IMPACT_DETECTED',
        note: 'Surface irregularity detected.',
        timestamp: new Date(Date.now() - 8 * 24 * 3600 * 1000).toISOString(),
        performedBy: { role: 'device', name: 'ESP32_PATROL_02' }
      },
      {
        fromStatus: 'reported',
        toStatus: 'in_progress',
        action: 'ASSIGNED',
        note: 'Assigned to Highway Rapid Patch Team.',
        timestamp: new Date(Date.now() - 4 * 24 * 3600 * 1000).toISOString(),
        performedBy: { role: 'authority', name: 'Officer K. Murthy' }
      },
      {
        fromStatus: 'in_progress',
        toStatus: 'repaired',
        action: 'WORK_COMPLETED',
        note: 'Repair completed. Proof photo submitted. Total cost: $450.',
        timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        performedBy: { role: 'authority', name: 'Officer K. Murthy' }
      }
    ]
  },
  {
    id: 'pothole_crater_005',
    location: { lat: 16.4940, lng: 80.5015 },
    geohash: 'tf344e',
    address: 'Near Student Activity Centre (SAC) Gate 2, Campus Road',
    severity: 'high',
    severityScore: 4.40,
    status: 'reported',
    source: 'device',
    deviceIds: ['ESP32_SHUTTLE_04', 'ESP32_PATROL_01'],
    confirmationCount: 6,
    description: 'Rapidly deteriorating transverse crack turned into multi-depression crater.',
    firstDetectedAt: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
    lastDetectedAt: new Date(Date.now() - 6 * 3600 * 1000).toISOString(),
    assignedDepartment: null,
    expectedCompletionDate: null,
    completion: null,
    isDeleted: false,
    history: [
      {
        fromStatus: null,
        toStatus: 'reported',
        action: 'IOT_IMPACT_DETECTED',
        note: 'Initial accelerometer trip (4.40G) on north-bound lane.',
        timestamp: new Date(Date.now() - 2 * 24 * 3600 * 1000).toISOString(),
        performedBy: { role: 'device', name: 'ESP32_SHUTTLE_04' }
      }
    ]
  },
  {
    id: 'pothole_crater_006',
    location: { lat: 16.5025, lng: 80.5070 },
    geohash: 'tf344w',
    address: 'Neerukonda - Mandadam Link Road, Amaravati',
    severity: 'medium',
    severityScore: 2.85,
    status: 'repaired',
    source: 'citizen',
    deviceIds: [],
    confirmationCount: 1,
    description: 'Pothole on pedestrian crosswalk apron.',
    firstDetectedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    lastDetectedAt: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
    assignedDepartment: 'Amaravati Urban Infrastructure',
    expectedCompletionDate: new Date(Date.now() - 6 * 24 * 3600 * 1000).toISOString().slice(0, 10),
    completion: {
      completedAt: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
      completedBy: {
        uid: 'auth_seed_officer_02',
        name: 'Chief Inspector P. Reddy',
        department: 'Urban Works'
      },
      remarks: 'Filled with high-early strength polymer concrete. Inspected and approved for heavy traffic.',
      cost: 580,
      proofPhotoUrl: 'https://images.unsplash.com/photo-1578575437130-527eed3abbec?auto=format&fit=crop&w=600&q=80'
    },
    isDeleted: false,
    history: [
      {
        fromStatus: null,
        toStatus: 'reported',
        action: 'CITIZEN_REPORTED',
        note: 'Reported by local pedestrian.',
        timestamp: new Date(Date.now() - 10 * 24 * 3600 * 1000).toISOString(),
        performedBy: { role: 'citizen', name: 'Anonymous' }
      },
      {
        fromStatus: 'reported',
        toStatus: 'repaired',
        action: 'WORK_COMPLETED',
        note: 'Pavement restored. Cost: $580.',
        timestamp: new Date(Date.now() - 5 * 24 * 3600 * 1000).toISOString(),
        performedBy: { role: 'authority', name: 'Chief Inspector P. Reddy' }
      }
    ]
  }
];

// Sample IoT Device Nodes
const SAMPLE_DEVICES = [
  {
    id: 'ESP32_PATROL_01',
    name: 'Municipal Patrol Cruiser #12',
    model: 'ESP32-WROOM-32 + MPU6050 + NEO-6M',
    status: 'active',
    battery: 98,
    firmware: 'v1.4.2-prod',
    lastSeen: new Date().toISOString()
  },
  {
    id: 'ESP32_BUS_04',
    name: 'Transit Bus Line 38 Route Node',
    model: 'ESP32-S3 + MPU6050 + NEO-6M',
    status: 'active',
    battery: 100,
    firmware: 'v1.4.2-prod',
    lastSeen: new Date().toISOString()
  },
  {
    id: 'ESP32_PATROL_02',
    name: 'Public Works Utility Truck #07',
    model: 'ESP32-WROOM-32 + MPU6050 + NEO-6M',
    status: 'active',
    battery: 84,
    firmware: 'v1.4.0',
    lastSeen: new Date(Date.now() - 15 * 60 * 1000).toISOString()
  }
];

async function seedDatabase() {
  console.log('\x1b[36m%s\x1b[0m', '🌱 RoadSense - Starting one-time Firestore database seed...');

  // 1. Seed Potholes & Status History
  for (const item of SAMPLE_POTHOLES) {
    const { history, id, ...potholeDoc } = item;
    const docRef = doc(db, 'potholes', id);
    await setDoc(docRef, potholeDoc);
    console.log(`  ✓ Written pothole: ${id} (${potholeDoc.address})`);

    // Seed subcollection statusHistory
    if (history && history.length) {
      for (const entry of history) {
        const historyCol = collection(db, 'potholes', id, 'statusHistory');
        await addDoc(historyCol, entry);
      }
      console.log(`    ↳ Inserted ${history.length} audit history logs`);
    }
  }

  // 2. Seed IoT Device Nodes
  for (const dev of SAMPLE_DEVICES) {
    const { id, ...data } = dev;
    await setDoc(doc(db, 'devices', id), data);
    console.log(`  ✓ Registered IoT Patrol Node: ${id}`);
  }

  console.log('\n\x1b[32m%s\x1b[0m', '✅ Database successfully seeded!');
  console.log('\x1b[33m%s\x1b[0m', '-------------------------------------------------------------');
  console.log('You can now run: npm run dev');
  console.log('Open http://localhost:5173 to view real-time data on the map.');
  console.log('To create an authority officer account, run: node create-authority.js\n');
  process.exit(0);
}

seedDatabase().catch((err) => {
  console.error('\x1b[31m%s\x1b[0m', '❌ Seed error:', err.message);
  process.exit(1);
});
