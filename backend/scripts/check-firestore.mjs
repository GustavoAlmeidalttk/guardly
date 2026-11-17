import 'dotenv/config';
import { firestore } from '../src/config/firestore.js';

const snapshot = await firestore.collection('testes').limit(1).get();
console.log(`FIRESTORE_READ_OK source=${process.env.FIRESTORE_EMULATOR_HOST ? 'emulator' : 'cloud'} documentsSampled=${snapshot.size}`);
