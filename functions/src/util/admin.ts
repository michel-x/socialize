import * as firebaseAdmin from 'firebase-admin';
firebaseAdmin.initializeApp();

export const admin = firebaseAdmin;
export const db = firebaseAdmin.firestore();
