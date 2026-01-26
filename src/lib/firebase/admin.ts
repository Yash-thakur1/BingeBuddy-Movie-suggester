/**
 * Firebase Admin Configuration
 * 
 * This module initializes the Firebase Admin SDK for server-side operations.
 * Used for secure Firestore operations and user verification in API routes.
 */

import { initializeApp, getApps, cert, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let adminApp: App;
let adminDb: Firestore;
let adminAuth: Auth;

function getAdminApp(): App {
  if (getApps().length === 0) {
    // Check if we have the service account credentials
    const serviceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    
    if (serviceAccount) {
      try {
        const credentials = JSON.parse(serviceAccount);
        adminApp = initializeApp({
          credential: cert(credentials),
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        });
      } catch (error) {
        console.error('[Firebase Admin] Failed to parse service account:', error);
        // Fallback to default credentials (for Google Cloud environments)
        adminApp = initializeApp({
          projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
        });
      }
    } else {
      // Use default credentials (works on Google Cloud / Vercel with proper setup)
      adminApp = initializeApp({
        projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID
      });
    }
  } else {
    adminApp = getApps()[0];
  }
  return adminApp;
}

export function getAdminDb(): Firestore {
  if (!adminDb) {
    adminDb = getFirestore(getAdminApp());
  }
  return adminDb;
}

export function getAdminAuth(): Auth {
  if (!adminAuth) {
    adminAuth = getAuth(getAdminApp());
  }
  return adminAuth;
}

export { adminApp };
