
import { getApp, getApps, initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY?.trim(),
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN?.trim(),
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID?.trim(),
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET?.trim(),
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID?.trim(),
  appId: import.meta.env.VITE_FIREBASE_APP_ID?.trim(),
};

export const missingFirebaseVariables = [
  !firebaseConfig.apiKey && "VITE_FIREBASE_API_KEY",
  !firebaseConfig.authDomain && "VITE_FIREBASE_AUTH_DOMAIN",
  !firebaseConfig.projectId && "VITE_FIREBASE_PROJECT_ID",
  !firebaseConfig.messagingSenderId && "VITE_FIREBASE_MESSAGING_SENDER_ID",
  !firebaseConfig.appId && "VITE_FIREBASE_APP_ID",
].filter(Boolean) as string[];

export const isFirebaseConfigured = missingFirebaseVariables.length === 0;

export function getFirebaseConfigurationMessage() {
  if (isFirebaseConfigured) {
    return "";
  }

  return "Firebase is not configured correctly. Please contact the system administrator.";
}

export const app = isFirebaseConfigured
  ? getApps().length
    ? getApp()
    : initializeApp(firebaseConfig)
  : null;
export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
// Files will be uploaded to Cloudflare R2 through a secure Cloudflare Worker.
