import { fileURLToPath } from 'node:url';
import { beforeAll, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { analysisStore } = vi.hoisted(() => ({ analysisStore: new Map() }));
vi.mock('../src/config/firestore.js', () => ({ firestore: { collection: (name) => ({ doc: (id) => ({ set: async (data) => analysisStore.set(`${name}/${id}`, data), get: async () => ({ exists: analysisStore.has(`${name}/${id}`), data: () => analysisStore.get(`${name}/${id}`) }) }) }) } }));

import { app } from '../src/app.js';
import { runStaticAnalyzer } from '../src/analyzers/analyzerAdapter.js';
import { normalizeFindings } from '../src/analyzers/resultNormalizer.js';

beforeAll(() => { process.env.ANALYZER_MODE = 'process-dev'; });

describe('TES-70/67/6: análise estática de JavaScript', () => {
  it('recebe código válido e retorna risco conhecido com localização', async () => {
    const response = await request(app).post('/api/security/analyze').send({
      code: 'const value = userInput;\neval(value);', language: 'javascript', generatedByAI: true, aiTool: 'Ferramenta de IA'
    });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'risks_found', language: 'javascript', generatedByAI: true, aiTool: 'Ferramenta de IA' });
    expect(response.body.risks).toEqual(expect.arrayContaining([expect.objectContaining({
      ruleId: 'no-eval', severity: 'critica', location: expect.objectContaining({ line: 2 }), description: expect.any(String), recommendation: expect.stringContaining('Remova eval')
    })]));
    expect(response.body.analyzedAt).toBeTruthy();
  });

  it('retorna explicitamente ausência de ocorrências para código válido', async () => {
    const response = await request(app).post('/api/security/analyze').send({ code: 'const answer = 2 + 2;' });
    expect(response.status).toBe(200);
    expect(response.body).toMatchObject({ status: 'no_findings', message: 'Nenhum risco identificado pelas regras configuradas.', risks: [] });
  });

  it('trata o trecho como dados e não executa instruções enviadas', async () => {
    const response = await request(app).post('/api/security/analyze').send({ code: 'process.exit(99); while (true) {}' });
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('no_findings');
  });

  it('detecta funcionalidades sensíveis com referência de linha verificável', async () => {
    const response = await request(app).post('/api/security/analyze').send({ code: 'const token = process.env.API_KEY;\nawait fetch(url);\nuploadFile(file);\nstripe.checkout(session);\nconst titular = dadosPessoais.cpf;\nchecarAutorização();' });
    expect(response.status).toBe(200);
    expect(response.body.sensitiveFeatures).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'credenciais' }), expect.objectContaining({ id: 'servicos_externos', location: expect.objectContaining({ line: 2 }) })
    ]));
    expect(response.body.sensitiveFeatures).toEqual(expect.arrayContaining([
      expect.objectContaining({ id: 'upload', location: expect.objectContaining({ line: 3 }) }),
      expect.objectContaining({ id: 'pagamento', location: expect.objectContaining({ line: 4 }) }),
      expect.objectContaining({ id: 'dados_sensiveis', location: expect.objectContaining({ line: 5 }) }),
      expect.objectContaining({ id: 'autenticacao', location: expect.objectContaining({ line: 6 }) })
    ]));
  });

  it('classifica riscos nos quatro níveis por regra e severidade do analisador', () => {
    expect(normalizeFindings([
      { ruleId: 'no-eval', severity: 2, message: 'eval' },
      { ruleId: 'security/detect-child-process', severity: 2, message: 'processo' },
      { ruleId: 'security/detect-bidi-characters', severity: 2, message: 'bidi' },
      { ruleId: 'security/detect-bidi-characters', severity: 1, message: 'bidi warn' }
    ]).map((risk) => risk.severity)).toEqual(['critica', 'alta', 'media', 'baixa']);
  });

  it('rejeita código vazio, grande demais, linguagem inválida e metadados inválidos', async () => {
    expect((await request(app).post('/api/security/analyze').send({ code: '   ' })).status).toBe(400);
    expect((await request(app).post('/api/security/analyze').send({ code: 'a'.repeat(50_001) })).status).toBe(413);
    expect((await request(app).post('/api/security/analyze').send({ code: 'print(1)', language: 'python' })).status).toBe(422);
    expect((await request(app).post('/api/security/analyze').send({ code: 'const x=1;', generatedByAI: 'yes' })).status).toBe(400);
  });

  it('trata erro de sintaxe como falha de análise, sem declarar ausência de riscos', async () => {
    const response = await request(app).post('/api/security/analyze').send({ code: 'const = ;' });
    expect(response.status).toBe(422);
    expect(response.body.code).toBe('ANALYSIS_PARSE_ERROR');
    expect(response.body.message).not.toMatch(/Nenhum risco encontrado/);
  });

  it('trata falha do worker como erro da ferramenta', async () => {
    await expect(runStaticAnalyzer('const x = 1;', { workerPath: fileURLToPath(new URL('./fixtures/missing.mjs', import.meta.url)) }))
      .rejects.toMatchObject({ status: 502, code: 'ANALYZER_FAILED' });
  });

  it('interrompe o worker ao exceder o tempo máximo', async () => {
    await expect(runStaticAnalyzer('const x = 1;', {
      workerPath: fileURLToPath(new URL('./fixtures/neverEnds.mjs', import.meta.url)), timeoutMs: 100
    })).rejects.toMatchObject({ status: 504, code: 'ANALYSIS_TIMEOUT' });
  });
});
