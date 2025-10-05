import { initializeApp } from "firebase/app";
import {
  initializeAuth,
  connectAuthEmulator,
  indexedDBLocalPersistence,
  browserLocalPersistence,
  inMemoryPersistence,
} from "firebase/auth";
import {
  initializeFirestore,
  connectFirestoreEmulator,
  enableIndexedDbPersistence,
  disableNetwork,
  enableNetwork,
} from "firebase/firestore";

// Read from environment variables only (do not expose config in source).
const requiredKeys = [
  "REACT_APP_FIREBASE_API_KEY",
  "REACT_APP_FIREBASE_AUTH_DOMAIN",
  "REACT_APP_FIREBASE_PROJECT_ID",
  "REACT_APP_FIREBASE_STORAGE_BUCKET",
  "REACT_APP_FIREBASE_MESSAGING_SENDER_ID",
  "REACT_APP_FIREBASE_APP_ID",
];
const missing = requiredKeys.filter((k) => !process.env[k]);
if (missing.length) {
  const hint = `Missing Firebase config in environment. Create .env.local with REACT_APP_FIREBASE_* vars. Missing: ${missing.join(", ")}`;
  throw new Error(hint);
}

const firebaseConfig = {
  apiKey: process.env.REACT_APP_FIREBASE_API_KEY,
  authDomain: process.env.REACT_APP_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.REACT_APP_FIREBASE_PROJECT_ID,
  storageBucket: process.env.REACT_APP_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.REACT_APP_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.REACT_APP_FIREBASE_APP_ID,
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase Auth with robust multi-persistence
export const auth = initializeAuth(app, {
  persistence: [
    indexedDBLocalPersistence,
    browserLocalPersistence,
    inMemoryPersistence,
  ],
});
try { auth?.useDeviceLanguage?.(); } catch (_) {}
// Use auto-detected long polling to avoid WebChannel issues in some networks/browsers
// Transport strategy: prefer Fetch Streams (no cleardot.gif / WebChannel)
// Override via env flags if needed
const forceLongPolling =
  String(
    process.env.REACT_APP_FIRESTORE_FORCE_LONG_POLLING || "",
  ).toLowerCase() === "true";
const useFetchStreams =
  String(
    process.env.REACT_APP_FIRESTORE_USE_FETCH_STREAMS || "true",
  ).toLowerCase() !== "false";

export const db = initializeFirestore(app, {
  experimentalForceLongPolling: forceLongPolling,
  useFetchStreams,
});

// Connect to emulators only when explicitly enabled
const useAuthEmu =
  String(
    process.env.REACT_APP_USE_AUTH_EMULATOR ||
      process.env.REACT_APP_USE_FIREBASE_EMULATOR ||
      "",
  ).toLowerCase() === "true";
const useFirestoreEmu =
  String(
    process.env.REACT_APP_USE_FIRESTORE_EMULATOR ||
      process.env.REACT_APP_USE_FIREBASE_EMULATOR ||
      "",
  ).toLowerCase() === "true";

if (useAuthEmu) {
  try {
    connectAuthEmulator(auth, "http://localhost:9099");
  } catch (error) {
    console.log("Auth emulator already connected or failed to connect");
  }
}

if (useFirestoreEmu) {
  try {
    connectFirestoreEmulator(db, "localhost", 8080);
  } catch (error) {
    console.log("Firestore emulator already connected or failed to connect");
  }
}

// Long-term offline: enable IndexedDB persistence so reads/writes work offline and sync later
try {
  enableIndexedDbPersistence(db).catch(() => {
    // Ignore if already enabled or unsupported
  });
} catch (_) {}

export default app;

// Network control helpers
export const goOffline = () => disableNetwork(db).catch(() => {});
export const goOnline = () => enableNetwork(db).catch(() => {});
