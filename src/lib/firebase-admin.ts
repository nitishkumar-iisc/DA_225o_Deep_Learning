import { initializeApp, getApps, cert, App } from "firebase-admin/app";
import { getAuth, Auth } from "firebase-admin/auth";
import { getFirestore, Firestore } from "firebase-admin/firestore";

function getAdminApp(): App {
  if (getApps().length > 0) {
    return getApps()[0];
  }

  // When FIREBASE_AUTH_EMULATOR_HOST is set, Admin SDK skips token verification
  // and accepts the fake service account without validating the private key.
  const isEmulator = !!process.env.FIREBASE_AUTH_EMULATOR_HOST;

  if (isEmulator) {
    return initializeApp({ projectId: "besthire-local" });
  }

  const serviceAccountKey = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
  if (!serviceAccountKey) {
    throw new Error("FIREBASE_SERVICE_ACCOUNT_KEY env var is not set");
  }

  return initializeApp({
    credential: cert(JSON.parse(serviceAccountKey)),
    storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  });
}

const adminApp: App = getAdminApp();

export const adminAuth: Auth = getAuth(adminApp);
export const adminDb: Firestore = getFirestore(adminApp);
export default adminApp;
