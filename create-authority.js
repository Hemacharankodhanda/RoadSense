/**
 * RoadSense - Municipal Authority User Provisioning Script
 * 
 * Usage:
 *   node create-authority.js [email] [password] [name] [department]
 * 
 * Examples:
 *   node create-authority.js
 *   node create-authority.js inspector@city.gov MySecretPass123! "Inspector Jane" "Road Division"
 */

import { createRequire } from 'module';
import { fileURLToPath } from 'url';
import { dirname, resolve } from 'path';

const require = createRequire(import.meta.url);
const { initializeApp } = require('firebase/app');
const { getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword } = require('firebase/auth');
const { getFirestore, doc, setDoc } = require('@firebase/firestore');
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
  console.error('\x1b[31m%s\x1b[0m', 'ERROR: Firebase configuration missing in .env!');
  console.log('Please copy .env.example to .env and configure your Firebase credentials.\n');
  process.exit(1);
}

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = getFirestore(app);

// Parse CLI arguments or fall back to sensible defaults
const args = process.argv.slice(2);
const email = args[0] || 'authority@city.gov';
const password = args[1] || 'Municipal2026!';
const name = args[2] || 'Chief Inspector Davis';
const department = args[3] || 'Municipal Public Works & Infrastructure';

async function createAuthority() {
  console.log('\x1b[36m%s\x1b[0m', `🔐 Provisioning Municipal Authority account for: ${email}...`);

  let user = null;
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    user = cred.user;
    console.log(`  ✓ Created new Firebase Auth user with UID: ${user.uid}`);
  } catch (err) {
    if (err.code === 'auth/email-already-in-use') {
      console.log(`  ℹ User already exists in Auth. Signing in to verify credentials and update Firestore role...`);
      const cred = await signInWithEmailAndPassword(auth, email, password);
      user = cred.user;
      console.log(`  ✓ Authenticated as existing user UID: ${user.uid}`);
    } else {
      throw err;
    }
  }

  // Write/Update Firestore users/{uid} document with role: 'authority'
  const userDocRef = doc(db, 'users', user.uid);
  await setDoc(userDocRef, {
    uid: user.uid,
    email: email,
    name: name,
    department: department,
    role: 'authority', // STRICT ROLE REQUIREMENT
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  }, { merge: true });

  console.log(`  ✓ Updated Firestore document users/${user.uid} with role: "authority"`);

  console.log('\n\x1b[32m%s\x1b[0m', '=============================================================');
  console.log('\x1b[32m%s\x1b[0m', '✅ Authority Account Successfully Provisioned!');
  console.log('\x1b[32m%s\x1b[0m', '=============================================================');
  console.log(`Email:      \x1b[33m${email}\x1b[0m`);
  console.log(`Password:   \x1b[33m${password}\x1b[0m`);
  console.log(`Name:       ${name}`);
  console.log(`Department: ${department}`);
  console.log(`Role:       \x1b[32mauthority\x1b[0m`);
  console.log('\nYou can now log into the Authority Portal at:');
  console.log('\x1b[36mhttp://localhost:5173/authority/login\x1b[0m\n');

  process.exit(0);
}

createAuthority().catch((err) => {
  console.error('\x1b[31m%s\x1b[0m', '❌ Provisioning error:', err.message);
  process.exit(1);
});
