import { initializeApp } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';

// Your Firebase config - get the actual values from Firebase Console
const firebaseConfig = {
  apiKey: "AIzaSyCXn-qhPV3AiJA8qd-TshIPQmpz8b08ym8",
  authDomain: "tabletop-army-manager.firebaseapp.com",
  projectId: "tabletop-army-manager",
  storageBucket: "tabletop-army-manager.firebasestorage.app",
  messagingSenderId: "405556152521",
  appId: "1:405556152521:web:fd4ad28c90fb678baca518"
};

// Initialize Firebase
const app = initializeApp(firebaseConfig);

// Initialize Firebase services
export const auth = getAuth(app);
export const db = getFirestore(app);

// Connect to emulators in development
if (process.env.NODE_ENV === 'development') {
  try {
    connectAuthEmulator(auth, 'http://localhost:9099');
  } catch (error) {
    // Already connected or error connecting
    console.log('Auth emulator already connected or failed to connect');
  }
  
  try {
    connectFirestoreEmulator(db, 'localhost', 8080);
  } catch (error) {
    // Already connected or error connecting
    console.log('Firestore emulator already connected or failed to connect');
  }
  
}

export default app;
