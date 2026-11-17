import { randomUUID } from 'node:crypto';
import { firestore } from '../config/firestore.js';
import { HttpError } from '../middlewares/errors.js';
import { validId, validateFinalizacao } from './validation.js';

const testes = firestore.collection('testes');

function refs(testeId, cenarioId) {
  validId(testeId);
  validId(cenarioId);
  const teste = testes.doc(testeId);
  const cenario = teste.collection('cenarios').doc(cenarioId);
  return { teste, cenario };
}

async function checkScenario(teste, cenario) {
  const [testSnapshot, scenarioSnapshot] = await Promise.all([teste.get(), cenario.get()]);
  if (!testSnapshot.exists) throw new HttpError(404, 'TEST_NOT_FOUND', 'Teste não encontrado.');
  if (!scenarioSnapshot.exists) throw new HttpError(404, 'SCENARIO_NOT_FOUND', 'Cenário não encontrado neste teste.');
  return scenarioSnapshot;
}

export async function iniciarExecucao(testeId, cenarioId) {
  const { teste, cenario } = refs(testeId, cenarioId);
  const id = randomUUID();
  const executionRef = cenario.collection('execucoes').doc(id);
  const registro = {
    testeId,
    cenarioId,
    status: 'em_andamento',
    resultado: null,
    responsavel: '',
    evidencias: '',
    iniciadoEm: new Date().toISOString(),
    finalizadoEm: null
  };
  let cenarioData;
  await firestore.runTransaction(async (transaction) => {
    const testSnapshot = await transaction.get(teste);
    const scenarioSnapshot = await transaction.get(cenario);
    if (!testSnapshot.exists) throw new HttpError(404, 'TEST_NOT_FOUND', 'Teste não encontrado.');
    if (!scenarioSnapshot.exists) throw new HttpError(404, 'SCENARIO_NOT_FOUND', 'Cenário não encontrado neste teste.');
    cenarioData = scenarioSnapshot.data();
    transaction.set(executionRef, registro);
  });
  const { nomeNormalizado, ...publico } = cenarioData;
  return { id, ...registro, cenario: { id: cenarioId, ...publico } };
}

export async function finalizarExecucao(testeId, cenarioId, executionId, body) {
  const { teste, cenario } = refs(testeId, cenarioId);
  validId(executionId);
  const data = validateFinalizacao(body);
  const executionRef = cenario.collection('execucoes').doc(executionId);
  let finalizado;
  await firestore.runTransaction(async (transaction) => {
    const testSnapshot = await transaction.get(teste);
    const scenarioSnapshot = await transaction.get(cenario);
    const executionSnapshot = await transaction.get(executionRef);
    if (!testSnapshot.exists) throw new HttpError(404, 'TEST_NOT_FOUND', 'Teste não encontrado.');
    if (!scenarioSnapshot.exists) throw new HttpError(404, 'SCENARIO_NOT_FOUND', 'Cenário não encontrado neste teste.');
    if (!executionSnapshot.exists) throw new HttpError(404, 'EXECUTION_NOT_FOUND', 'Execução não encontrada neste cenário.');
    const current = executionSnapshot.data();
    if (current.status === 'finalizada') {
      if (current.resultado !== data.resultado || current.responsavel !== data.responsavel || current.evidencias !== data.evidencias) {
        throw new HttpError(409, 'EXECUTION_ALREADY_FINISHED', 'Esta execução já foi finalizada com outros dados.');
      }
      finalizado = { id: executionId, ...current };
      return;
    }
    const finalizadoEm = new Date().toISOString();
    const completion = { ...data, status: 'finalizada', finalizadoEm };
    transaction.update(executionRef, completion);
    transaction.update(cenario, { ultimoResultado: data.resultado, ultimaExecucaoEm: finalizadoEm, updatedAt: finalizadoEm });
    finalizado = { id: executionId, ...current, ...completion };
  });
  return finalizado;
}

export async function listarHistorico(testeId, cenarioId) {
  const { teste, cenario } = refs(testeId, cenarioId);
  await checkScenario(teste, cenario);
  const snapshot = await cenario.collection('execucoes').where('status', '==', 'finalizada').get();
  return snapshot.docs
    .map((doc) => ({ id: doc.id, ...doc.data() }))
    .sort((a, b) => b.finalizadoEm.localeCompare(a.finalizadoEm) || b.id.localeCompare(a.id));
}
