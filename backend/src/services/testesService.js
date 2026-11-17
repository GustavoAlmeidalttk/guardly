import { randomUUID } from 'node:crypto';
import { firestore } from '../config/firestore.js';
import { HttpError } from '../middlewares/errors.js';
import { validId, validateTeste } from './validation.js';

const testes = firestore.collection('testes');

function toTeste(snapshot) {
  const { scenarioCount = 0, ...data } = snapshot.data();
  return { id: snapshot.id, ...data, _count: { cenarios: scenarioCount } };
}

export async function listarTestes() {
  const snapshot = await testes.orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(toTeste);
}

export async function obterTeste(id) {
  validId(id);
  const snapshot = await testes.doc(id).get();
  if (!snapshot.exists) throw new HttpError(404, 'TEST_NOT_FOUND', 'Teste não encontrado.');
  return toTeste(snapshot);
}

export async function criarTeste(body) {
  const data = validateTeste(body);
  const id = randomUUID();
  const timestamp = new Date().toISOString();
  const teste = { ...data, suiteId: null, scenarioCount: 0, createdAt: timestamp, updatedAt: timestamp };
  await testes.doc(id).set(teste);
  return { id, ...data, suiteId: null, createdAt: timestamp, updatedAt: timestamp };
}
