import 'dotenv/config';
import assert from 'node:assert/strict';
import { firestore } from '../src/config/firestore.js';

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('Leitura isolada permitida apenas com emulador local.');
}

const [testeId, cenarioId] = process.argv.slice(2);
const snapshot = await firestore.collection('testes').doc(testeId).collection('cenarios').doc(cenarioId)
  .collection('execucoes').where('status', '==', 'finalizada').get();
assert.equal(snapshot.size, 3);
assert.deepEqual(snapshot.docs.map((doc) => doc.data().resultado).sort(), ['aprovado', 'bloqueado', 'reprovado']);
console.log('HISTORY_RESTART_OK');
