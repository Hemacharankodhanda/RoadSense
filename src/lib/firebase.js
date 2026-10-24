/**
 * RoadSense - Firebase Initialization & Multi-Tier Storage Module
 * 
 * Configures:
 * 1. Firebase Authentication (Email / Password)
 * 2. Cloud Firestore (Real-time telemetry and defect state)
 * 3. Firebase Storage with automatic Client-Side Base64 compression fallback
 *    (seamlessly works whether Firebase project is on Free Spark or Blaze plan)
 */
import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import {
  initializeFirestore,
  persistentLocalCache,
  persistentMultipleTabManager,
  getFirestore
} from 'firebase/firestore';
import { getStorage, ref, uploadBytes, getDownloadURL } from 'firebase/storage';
import { getDatabase } from 'firebase/database';

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyAql-5qr3jrqCnXgHAENTalahKM3ofH0GY",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "roadsense-2b385.firebaseapp.com",
  databaseURL: import.meta.env.VITE_FIREBASE_DATABASE_URL || "https://roadsense-2b385-default-rtdb.firebaseio.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "roadsense-2b385",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "roadsense-2b385.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "141083975376",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:141083975376:web:295c7e5157b4006f03c8d5",
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID || "G-CHFRBSJEWC"
};

// Check if actual configuration keys have been provided in .env
export function isFirebaseConfigured() {
  const key = import.meta.env.VITE_FIREBASE_API_KEY;
  return Boolean(
    key &&
    !key.includes('ExampleKey') &&
    !key.includes('MOCK_ENV_KEY') &&
    key.length > 10
  );
}

// Initialize Firebase singleton
const app = !getApps().length ? initializeApp(firebaseConfig) : getApp();

export const auth = getAuth(app);

// Initialize Firestore with persistent IndexedDB caching & multi-tab coordination for instantaneous queries
let dbInstance;
try {
  dbInstance = initializeFirestore(app, {
    localCache: persistentLocalCache({
      tabManager: persistentMultipleTabManager()
    })
  });
} catch (e) {
  // If already initialized or persistent cache unsupported in browser mode
  dbInstance = getFirestore(app);
}

export const db = dbInstance;
export const storage = getStorage(app);
export const rtdb = getDatabase(app);
export default app;

// ============================================================================
// CLIENT-SIDE IMAGE COMPRESSION (Resilient Spark Free Plan Fallback)
// ============================================================================
/**
 * Compresses an image client-side to WebP/JPEG dataURL (~30KB-80KB)
 * for direct, blazing-fast Firestore persistence without requiring Blaze plan.
 */
export async function compressImage(file, maxWidth = 800, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.readAsDataURL(file);
    reader.onload = (event) => {
      const img = new Image();
      img.src = event.target.result;
      img.onload = () => {
        const canvas = document.createElement('canvas');
        let width = img.width;
        let height = img.height;

        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }

        canvas.width = width;
        canvas.height = height;
        const ctx = canvas.getContext('2d');
        ctx.drawImage(img, 0, 0, width, height);

        // Convert to webp or jpeg
        const base64Uri = canvas.toDataURL('image/jpeg', quality);
        resolve(base64Uri);
      };
      img.onerror = (err) => reject(err);
    };
    reader.onerror = (err) => reject(err);
  });
}

/**
 * Uploads an image with automatic graceful fallback:
 * 1. Tries Firebase Storage upload.
 * 2. If Storage fails (e.g. quota, Blaze required, CORS, permissions),
 *    falls back to high-efficiency client-side base64 compression.
 */
export async function uploadImageWithFallback(file, storagePath) {
  if (!file) return null;

  try {
    // Attempt Firebase Storage upload
    const storageRef = ref(storage, storagePath);
    const snapshot = await uploadBytes(storageRef, file);
    const downloadUrl = await getDownloadURL(snapshot.ref);
    return {
      url: downloadUrl,
      storageType: 'firebase_storage'
    };
  } catch (storageError) {
    console.warn(
      '[RoadSense Storage] Firebase Storage upload skipped or unavailable (e.g. Spark Free plan). Falling back to client-side compressed base64 in Firestore.',
      storageError.message
    );

    // Fall back to client compressed Base64
    const base64Url = await compressImage(file);
    return {
      url: base64Url,
      storageType: 'firestore_base64_fallback'
    };
  }
}
