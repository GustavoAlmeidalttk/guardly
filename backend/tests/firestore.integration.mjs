import 'dotenv/config';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import request from 'supertest';

if (!/^(127\.0\.0\.1|localhost):\d+$/.test(process.env.FIRESTORE_EMULATOR_HOST || '')) {
  throw new Error('Este teste exige FIRESTORE_EMULATOR_HOST apontando para um emulador local.');
}

const { app } = await import('../src/app.js');
// This integration exercises Firestore writes using a fixed, controlled snippet.
process.env.ANALYZER_MODE = 'process-dev';
const unique = Date.now().toString();

const teste = await request(app).post('/api/tests').send({ nome: `Integração Firestore ${unique}` });
assert.equal(teste.status, 201);
const testId = teste.body.id;

const scenarioUrl = `/api/tests/${testId}/scenarios`;
const first = await request(app).post(scenarioUrl).send({
  nome: 'Senha incorreta',
  preCondicoes: 'Usuário ativo',
  passos: 'Informar senha inválida',
  resultadoEsperado: 'Acesso negado'
});
assert.equal(first.status, 201);
assert.equal(first.body.testeId, testId);

const analysis = await request(app).post('/api/security/analyze').send({ code: 'eval(userInput);', generatedByAI: true, aiTool: 'Teste de integração' });
assert.equal(analysis.status, 200);
assert.equal(analysis.body.generatedByAI, true);
assert.equal(analysis.body.risks[0].severity, 'critica');
const linked = await request(app).put(`/api/tests/${testId}/scenarios/${first.body.id}/risks`).send({
  analysisId: analysis.body.analysisId,
  riskIds: [analysis.body.risks[0].id]
});
assert.equal(linked.status, 200);

const duplicate = await request(app).post(scenarioUrl).send({ nome: '  SENHA INCORRETA  ' });
assert.equal(duplicate.status, 409);
assert.equal(duplicate.body.code, 'DUPLICATE_SCENARIO');
assert.equal((await request(app).get(scenarioUrl)).body.length, 1);

const confirmed = await request(app).post(scenarioUrl).send({ nome: 'Senha incorreta', confirmarDuplicidade: true });
assert.equal(confirmed.status, 201);
assert.equal((await request(app).get(scenarioUrl)).body.length, 2);
assert.equal((await request(app).get(`/api/tests/${testId}`)).body._count.cenarios, 2);

const listed = await request(app).get('/api/tests');
assert.ok(listed.body.some((item) => item.id === testId));

const executionUrl = `/api/tests/${testId}/scenarios/${first.body.id}/executions`;
const wrongScenarioUrl = `/api/tests/${testId}/scenarios/${confirmed.body.id}/executions`;
assert.equal((await request(app).get(wrongScenarioUrl)).body.length, 0);

const results = ['aprovado', 'reprovado', 'bloqueado'];
for (const resultado of results) {
  const started = await request(app).post(executionUrl).send({});
  assert.equal(started.status, 201);
  assert.equal(started.body.cenarioId, first.body.id);
  assert.equal(started.body.cenario.passos, 'Informar senha inválida');

  const payload = { resultado, responsavel: 'Teste automatizado', evidencias: `Evidência ${resultado}` };
  const finishUrl = `${executionUrl}/${started.body.id}`;
  const finished = await request(app).patch(finishUrl).send(payload);
  assert.equal(finished.status, 200);
  assert.equal(finished.body.resultado, resultado);
  assert.ok(finished.body.finalizadoEm);
  const retry = await request(app).patch(finishUrl).send(payload);
  assert.equal(retry.status, 200);
  assert.equal(retry.body.finalizadoEm, finished.body.finalizadoEm);
  assert.equal((await request(app).patch(finishUrl).send({ ...payload, resultado: 'invalido' })).status, 400);
  await new Promise((resolve) => setTimeout(resolve, 5));
}

const history = await request(app).get(executionUrl);
assert.equal(history.status, 200);
assert.deepEqual(history.body.map((item) => item.resultado), ['bloqueado', 'reprovado', 'aprovado']);
assert.ok(history.body.every((item) => item.cenarioId === first.body.id && item.responsavel === 'Teste automatizado'));
assert.equal((await request(app).get(wrongScenarioUrl)).body.length, 0);
const scenarioList = await request(app).get(`/api/tests/${testId}/scenarios`);
assert.equal(scenarioList.body.find((item) => item.id === first.body.id).ultimoResultado, 'bloqueado');
assert.equal(scenarioList.body.find((item) => item.id === first.body.id).riskAssessment.analysisId, analysis.body.analysisId);
assert.equal(scenarioList.body.find((item) => item.id === confirmed.body.id).ultimoResultado, undefined);

const suggestionsPath = `/api/tests/${testId}/security-suggestions`;
const generatedSuggestions = await request(app).post(suggestionsPath).send({ analysisId: analysis.body.analysisId });
assert.equal(generatedSuggestions.status, 201);
assert.equal(generatedSuggestions.body.length, 1);
const acceptedSuggestion = await request(app).patch(`${suggestionsPath}/${generatedSuggestions.body[0].id}`).send({ status: 'aceita' });
assert.equal(acceptedSuggestion.status, 200);
const savedSuggestions = await request(app).get(suggestionsPath);
assert.equal(savedSuggestions.body[0].status, 'aceita');
const acceptedScenario = (await request(app).get(`/api/tests/${testId}/scenarios`)).body.find((item) => item.id === acceptedSuggestion.body.scenarioId);
assert.equal(acceptedScenario.origemCriacao, 'sugestao_automatica');
assert.equal(acceptedScenario.riskAssessment.risks[0].id, analysis.body.risks[0].id);
const separateProcess = spawnSync(process.execPath, ['tests/read-history.mjs', testId, first.body.id], {
  cwd: process.cwd(), env: process.env, encoding: 'utf8', timeout: 30000
});
assert.equal(separateProcess.status, 0, separateProcess.stderr || separateProcess.stdout);
assert.match(separateProcess.stdout, /HISTORY_RESTART_OK/);
console.log(`FIRESTORE_INTEGRATION_OK testId=${testId} executions=${history.body.length}`);
