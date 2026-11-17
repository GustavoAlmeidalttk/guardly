import { createHash } from 'node:crypto';
import { firestore } from '../config/firestore.js';
import { HttpError } from '../middlewares/errors.js';
import { validId } from './validation.js';
import { associarRiscosCenario, criarCenario } from './cenariosService.js';

const tests = firestore.collection('testes');
const suggestions = (testId) => tests.doc(testId).collection('sugestoesSeguranca');

function scenarioDraft(risk) {
  const type = `${risk.type || ''} ${risk.ruleId || ''}`;
  const drafts = [
    [/credencial|password|secret|token/i, 'Rejeitar credencial inválida', 'Enviar credencial incorreta e verificar que o acesso é negado sem revelar se usuário ou senha falhou.'],
    [/autentica|auth/i, 'Bloquear acesso não autorizado', 'Acessar a funcionalidade sem sessão válida e confirmar resposta de acesso negado.'],
    [/execução dinâmica|no-eval|implied-eval/i, 'Rejeitar execução dinâmica de entrada', 'Enviar uma expressão como entrada e confirmar que ela é tratada como dado, sem executar comandos ou código fornecido pelo usuário.'],
    [/unsafe-regex|expressão regular/i, 'Limitar expressões regulares custosas', 'Enviar uma entrada longa que provoque retrocesso na expressão e verificar que a requisição termina dentro do limite definido.'],
    [/comando|child.process/i, 'Validar entrada em comando do sistema', 'Enviar caracteres de shell no campo de entrada e confirmar que não são interpretados como comando.'],
    [/banco|query|sql/i, 'Validar parâmetros da consulta', 'Enviar caracteres de injeção nos campos usados na consulta e confirmar que dados não autorizados não são retornados.'],
    [/arquivo|file|upload/i, 'Validar upload e acesso a arquivos', 'Enviar arquivo com extensão/conteúdo não permitido e caminho de traversal; confirmar rejeição e ausência de gravação fora do diretório permitido.'],
    [/pagamento|payment|checkout|charge|stripe/i, 'Validar autorização de pagamento', 'Alterar valor e identificador da transação e repetir a solicitação; confirmar autorização, integridade do valor e idempotência.'],
    [/serviço externo|servico externo|external|fetch/i, 'Validar destino de serviço externo', 'Enviar destino externo não autorizado e confirmar que a aplicação bloqueia a solicitação.']
  ];
  const [, nome, passos] = drafts.find(([pattern]) => pattern.test(type)) || [null, `Revisar risco: ${risk.type}`, `Executar uma verificação direcionada para: ${risk.description}`];
  return { nome, descricao: `Cenário sugerido a partir do risco ${risk.id}.`, preCondicoes: 'Ambiente de teste autorizado e dados não produtivos.', passos, resultadoEsperado: 'A aplicação aplica os controles de segurança esperados e não expõe dados ou operações não autorizadas.' };
}

export async function gerarSugestoes(testId, { analysisId }) {
  validId(testId);
  if (typeof analysisId !== 'string' || !analysisId) throw new HttpError(400, 'INVALID_ANALYSIS_ID', 'Informe analysisId.');
  const test = await tests.doc(testId).get();
  if (!test.exists) throw new HttpError(404, 'TEST_NOT_FOUND', 'Teste não encontrado.');
  const analysisSnap = await firestore.collection('analisesSeguranca').doc(analysisId).get();
  if (!analysisSnap.exists) throw new HttpError(404, 'ANALYSIS_NOT_FOUND', 'Análise não encontrada.');
  const created = [];
  for (const risk of analysisSnap.data().risks || []) {
    const id = createHash('sha256').update(`${analysisId}:${risk.id}`).digest('hex').slice(0, 32);
    const ref = suggestions(testId).doc(id);
    const existing = await ref.get();
    if (existing.exists) { created.push({ id, ...existing.data() }); continue; }
    const now = new Date().toISOString();
    const item = { testId, analysisId, riskId: risk.id, risk, scenarioDraft: scenarioDraft(risk), status: 'pendente', createdAt: now, updatedAt: now };
    await ref.set(item); created.push({ id, ...item });
  }
  return created;
}

export async function listarSugestoes(testId) {
  validId(testId);
  if (!(await tests.doc(testId).get()).exists) throw new HttpError(404, 'TEST_NOT_FOUND', 'Teste não encontrado.');
  const snapshot = await suggestions(testId).orderBy('createdAt', 'desc').get();
  return snapshot.docs.map((item) => ({ id: item.id, ...item.data() }));
}

export async function atualizarSugestao(testId, suggestionId, body) {
  validId(testId);
  if (!['aceita', 'descartada'].includes(body?.status)) throw new HttpError(400, 'INVALID_SUGGESTION_STATUS', 'status deve ser aceita ou descartada.');
  const ref = suggestions(testId).doc(suggestionId);
  const snapshot = await ref.get();
  if (!snapshot.exists) throw new HttpError(404, 'SUGGESTION_NOT_FOUND', 'Sugestão não encontrada.');
  const current = snapshot.data();
  if (current.status !== 'pendente') throw new HttpError(409, 'SUGGESTION_ALREADY_REVIEWED', 'A sugestão já foi revisada.');
  let scenarioId = null;
  if (body.status === 'aceita') {
    const draft = body.scenario && typeof body.scenario === 'object' ? body.scenario : current.scenarioDraft;
    const scenarios = tests.doc(testId).collection('cenarios');
    const existing = await scenarios.where('sugestaoSegurancaId', '==', suggestionId).get();
    if (existing.docs.length) {
      scenarioId = existing.docs[0].id;
    } else {
      const scenario = await criarCenario(testId, draft);
      scenarioId = scenario.id;
      const scenarioRef = scenarios.doc(scenarioId);
      const savedScenario = await scenarioRef.get();
      await scenarioRef.set({ ...savedScenario.data(), origemCriacao: 'sugestao_automatica', sugestaoSegurancaId: suggestionId, analiseOrigemId: current.analysisId });
    }
    await associarRiscosCenario(testId, scenarioId, { analysisId: current.analysisId, riskIds: [current.riskId] });
  }
  const updated = { ...current, status: body.status, scenarioId, reviewedAt: new Date().toISOString(), updatedAt: new Date().toISOString() };
  await ref.set(updated);
  return { id: suggestionId, ...updated };
}
