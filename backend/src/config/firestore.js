import 'dotenv/config';
import { applicationDefault, getApp, getApps, initializeApp } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';

const projectId = process.env.FIREBASE_PROJECT_ID || (process.env.FIRESTORE_EMULATOR_HOST ? 'demo-guardly' : undefined);
if (!projectId) throw new Error('Configure FIREBASE_PROJECT_ID no backend/.env.');

const app = getApps().length
  ? getApp()
  : initializeApp(process.env.FIRESTORE_EMULATOR_HOST
    ? { projectId }
    : { credential: applicationDefault(), projectId });

export const firestore = getFirestore(app);
