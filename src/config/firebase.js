import admin from 'firebase-admin';
import { readFileSync } from 'fs';

const serviceAccount = JSON.parse(
    readFileSync(new URL('../../xceedordersbackup-firebase-adminsdk-fbsvc-cb774ade13.json', import.meta.url))
);

admin.initializeApp({
    credential: admin.credential.cert(serviceAccount),
});

const db = admin.firestore();
export default db;
