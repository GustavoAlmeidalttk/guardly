import { createHash, randomUUID } from 'node:crypto';
import { firestore } from '../config/firestore.js';
import { HttpError } from '../middlewares/errors.js';
import { validId, validateCenario } from './validation.js';

const testes = firestore.collection('testes');

function toCenario(snapshot) {
  const { nomeNormalizado, ...data } = snapshot.data();
  return { id: snapshot.id, ...data };
}

export async function listarCenarios(testeId) {
  validId(testeId);
  const testeRef = testes.doc(testeId);
  const teste = await testeRef.get();
  if (!teste.exists) throw new HttpError(404, 'TEST_NOT_FOUND', 'Teste não encontrado.');
  const snapshot = await testeRef.collection('cenarios').orderBy('createdAt', 'desc').get();
  return snapshot.docs.map(toCenario);
}

export async function criarCenario(testeId, body) {
  validId(testeId);
  const { confirmarDuplicidade, ...data } = validateCenario(body);
  const testeRef = testes.doc(testeId);
  const id = randomUUID();
  const nomeId = createHash('sha256').update(data.nomeNormalizado).digest('hex');
  const nomeRef = testeRef.collection('nomesDeCenarios').doc(nomeId);
  const cenarioRef = testeRef.collection('cenarios').doc(id);
  const timestamp = new Date().toISOString();
  const cenario = { ...data, testeId, createdAt: timestamp, updatedAt: timestamp };

  // A shared name document makes duplicate detection atomic for concurrent requests.
  await firestore.runTransaction(async (transaction) => {
    const teste = await transaction.get(testeRef);
    if (!teste.exists) throw new HttpError(404, 'TEST_NOT_FOUND', 'Teste não encontrado.');
    const nome = await transaction.get(nomeRef);
    if (nome.exists && !confirmarDuplicidade) {
      throw new HttpError(409, 'DUPLICATE_SCENARIO', 'Já existe um cenário com esse nome neste teste.', {
        existente: { id: nome.data().id, nome: nome.data().nome }
      });
    }
    transaction.set(cenarioRef, cenario);
    if (!nome.exists) transaction.set(nomeRef, { id, nome: data.nome });
    transaction.update(testeRef, {
      scenarioCount: (teste.data().scenarioCount ?? 0) + 1,
      updatedAt: timestamp
    });
  });

  const { nomeNormalizado, ...publico } = cenario;
  return { id, ...publico };
}
