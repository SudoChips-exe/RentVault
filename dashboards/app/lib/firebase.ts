import { initializeApp, getApps } from 'firebase/app';
import { getAuth, connectAuthEmulator } from 'firebase/auth';
import { getFirestore, connectFirestoreEmulator } from 'firebase/firestore';
import { getStorage, connectStorageEmulator } from 'firebase/storage';
import { getFunctions, connectFunctionsEmulator } from 'firebase/functions';

const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY || 'demo-api-key',
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN || 'demo-rent-split-escrow.firebaseapp.com',
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID || 'demo-rent-split-escrow',
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET || 'demo-rent-split-escrow.appspot.com',
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID || '1234567890',
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID || '1:1234567890:web:1234567890abcdef',
};

// Avoid re-initializing during Next.js hot reload
const app = getApps().length === 0 ? initializeApp(firebaseConfig) : getApps()[0];

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export const functions = getFunctions(app);

// Connect to emulators in development
if (
  typeof window !== 'undefined' &&
  (process.env.NEXT_PUBLIC_USE_EMULATOR === 'true' || process.env.NODE_ENV === 'development')
) {
  // Only connect once
  if (!(auth as any)._canInitEmulator) {
    try {
      connectAuthEmulator(auth, 'http://localhost:9099', { disableWarnings: true });
      connectFirestoreEmulator(db, 'localhost', 8080);
      connectStorageEmulator(storage, 'localhost', 9199);
      connectFunctionsEmulator(functions, 'localhost', 5001);
      console.log('[FIREBASE] Dashboards connected to local emulators');
    } catch {
      // Already connected
    }
  }
}
