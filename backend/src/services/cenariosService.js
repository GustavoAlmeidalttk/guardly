import { createHash, randomUUID } from 'node:crypto';
import { firestore } from '../config/firestore.js';
import { HttpError } from '../middlewares/errors.js';
import { validId, validateCenario } from './validation.js';
import { detectSensitiveFeatures } from '../analyzers/resultNormalizer.js';

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
  return snapshot.docs.map(toCenario).map((cenario) => {
    const risks = cenario.riskAssessment?.risks || [];
    const scenarioText = [cenario.nome, cenario.descricao, cenario.passos, cenario.preCondicoes].join('\n');
    const sensitiveScenario = detectSensitiveFeatures(scenarioText).length > 0;
    const weights = { critica: 4, alta: 3, media: 2, baixa: 1 };
    const score = risks.reduce((total, risk) => total + (weights[risk.severity] || 0), 0);
    const highest = risks.reduce((max, risk) => Math.max(max, weights[risk.severity] || 0), 0);
    const severity = risks.reduce((max, risk) => Math.max(max, weights[risk.severity] || 0), 0);
    const severityName = Object.entries(weights).find(([, weight]) => weight === highest)?.[0] || null;
    return { ...cenario, sensitiveScenario, riskSeverityWeight: severity, riskPriority: risks.length ? severityName : 'sem_avaliacao', riskScore: score, priorityReason: risks.length ? `${risks.length} risco(s) associado(s); severidade máxima ${severityName}.` : 'Sem avaliação de risco vinculada.' };
  }).sort((a, b) => (b.riskSeverityWeight - a.riskSeverityWeight) || (b.riskScore - a.riskScore) || a.nome.localeCompare(b.nome, 'pt-BR') || String(a.createdAt).localeCompare(String(b.createdAt)));
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

export async function associarRiscosCenario(testeId, cenarioId, body) {
  validId(testeId); validId(cenarioId);
  if (!body || typeof body.analysisId !== 'string' || !Array.isArray(body.riskIds) || body.riskIds.some((id) => typeof id !== 'string')) {
    throw new HttpError(400, 'INVALID_RISK_LINK', 'Informe analysisId e uma lista riskIds válida.');
  }
  const analysisSnap = await firestore.collection('analisesSeguranca').doc(body.analysisId).get();
  if (!analysisSnap.exists) throw new HttpError(404, 'ANALYSIS_NOT_FOUND', 'Análise não encontrada.');
  const analysis = analysisSnap.data();
  const risks = analysis.risks.filter((risk) => body.riskIds.includes(risk.id));
  if (risks.length !== new Set(body.riskIds).size) throw new HttpError(400, 'RISK_NOT_FOUND', 'Um ou mais riscos não pertencem à análise informada.');
  const ref = testes.doc(testeId).collection('cenarios').doc(cenarioId);
  const scenario = await ref.get();
  if (!scenario.exists) throw new HttpError(404, 'SCENARIO_NOT_FOUND', 'Cenário não encontrado.');
  if (scenario.data().testeId !== testeId) throw new HttpError(404, 'SCENARIO_NOT_FOUND', 'Cenário não encontrado.');
  const linked = { analysisId: body.analysisId, analisadoEm: analysis.analyzedAt, risks, sensitiveFeatures: analysis.sensitiveFeatures || [] };
  await ref.set({ ...scenario.data(), riskAssessment: linked, updatedAt: new Date().toISOString() });
  return linked;
}
