import { randomUUID } from 'node:crypto';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import request from 'supertest';

const { state, firestore } = vi.hoisted(() => {
  const state = { docs: new Map() };
  const snapshot = (path) => ({
    id: path.split('/').at(-1),
    exists: state.docs.has(path),
    data: () => state.docs.get(path)
  });
  const doc = (path) => ({
    path,
    id: path.split('/').at(-1),
    get: async () => snapshot(path),
    set: async (data) => { state.docs.set(path, structuredClone(data)); },
    collection: (name) => collection(`${path}/${name}`)
  });
  const collectionDocs = (path) => [...state.docs.keys()]
    .filter((key) => key.startsWith(`${path}/`) && !key.slice(path.length + 1).includes('/'))
    .map(snapshot);
  const collection = (path) => ({
    doc: (id) => doc(`${path}/${id}`),
    where: (field, operator, value) => ({
      get: async () => ({ docs: collectionDocs(path).filter((item) => operator === '==' && item.data()[field] === value) })
    }),
    orderBy: (field, direction) => ({
      get: async () => ({ docs: collectionDocs(path)
        .sort((a, b) => String(a.data()[field]).localeCompare(String(b.data()[field])) * (direction === 'desc' ? -1 : 1)) })
    })
  });
  const firestore = {
    collection: vi.fn((path) => collection(path)),
    runTransaction: vi.fn(async (callback) => {
      const writes = [];
      const transaction = {
        get: async (reference) => snapshot(reference.path),
        set: (reference, data) => writes.push(() => state.docs.set(reference.path, structuredClone(data))),
        update: (reference, data) => writes.push(() => state.docs.set(reference.path, { ...state.docs.get(reference.path), ...structuredClone(data) }))
      };
      const result = await callback(transaction);
      writes.forEach((write) => write());
      return result;
    })
  };
  return { state, firestore };
});
vi.mock('../src/config/firestore.js', () => ({ firestore }));

import { app } from '../src/app.js';

beforeEach(() => { state.docs.clear(); vi.clearAllMocks(); });

const scenarioCount = () => [...state.docs.keys()].filter((key) => key.includes('/cenarios/')).length;

describe('TES-32/34: cadastro de testes', () => {
  it('salva teste válido e o apresenta na listagem e nos detalhes', async () => {
    const created = await request(app).post('/api/tests').send({ nome: 'Login seguro', descricao: 'Autenticação', passos: 'Abrir tela' });
    expect(created.status).toBe(201);
    expect(created.body).toMatchObject({ nome: 'Login seguro', descricao: 'Autenticação', passos: 'Abrir tela' });
    const list = await request(app).get('/api/tests');
    expect(list.body).toHaveLength(1);
    expect(list.body[0].id).toBe(created.body.id);
    expect(list.body[0]._count.cenarios).toBe(0);
    const detail = await request(app).get(`/api/tests/${created.body.id}`);
    expect(detail.status).toBe(200);
    expect(detail.body.nome).toBe('Login seguro');
  });

  it('rejeita nome vazio ou só com espaços sem persistir', async () => {
    for (const nome of ['', '   ']) {
      const response = await request(app).post('/api/tests').send({ nome });
      expect(response.status).toBe(400);
      expect(response.body.code).toBe('REQUIRED_FIELD');
    }
    expect(state.docs.size).toBe(0);
  });

  it('rejeita tipos inválidos e IDs malformados', async () => {
    expect((await request(app).post('/api/tests').send({ nome: 123 })).status).toBe(400);
    expect((await request(app).get('/api/tests/not-an-id')).status).toBe(400);
  });
});

describe('TES-35/37: cenários e duplicidade', () => {
  it('vincula e lista o cenário somente no teste correspondente', async () => {
    const first = await request(app).post('/api/tests').send({ nome: 'Teste A' });
    const second = await request(app).post('/api/tests').send({ nome: 'Teste B' });
    const response = await request(app).post(`/api/tests/${first.body.id}/scenarios`).send({
      nome: 'Senha inválida', preCondicoes: 'Usuário ativo', passos: 'Digitar senha errada', resultadoEsperado: 'Acesso negado'
    });
    expect(response.status).toBe(201);
    expect(response.body).toMatchObject({ testeId: first.body.id, preCondicoes: 'Usuário ativo', resultadoEsperado: 'Acesso negado' });
    expect((await request(app).get(`/api/tests/${first.body.id}/scenarios`)).body).toHaveLength(1);
    expect((await request(app).get(`/api/tests/${second.body.id}/scenarios`)).body).toHaveLength(0);
    expect((await request(app).post(`/api/tests/${second.body.id}/scenarios`).send({ nome: 'Senha inválida' })).status).toBe(201);
    expect((await request(app).get(`/api/tests/${second.body.id}/scenarios`)).body).toHaveLength(1);
    expect((await request(app).get('/api/tests')).body.find((item) => item.id === first.body.id)._count.cenarios).toBe(1);
  });

  it('avisa sobre duplicidade sem salvar, permite cancelar e aceita confirmação explícita', async () => {
    const teste = await request(app).post('/api/tests').send({ nome: 'Teste A' });
    const url = `/api/tests/${teste.body.id}/scenarios`;
    expect((await request(app).post(url).send({ nome: 'Acesso negado' })).status).toBe(201);
    const duplicate = await request(app).post(url).send({ nome: '  ACESSO NEGADO  ' });
    expect(duplicate.status).toBe(409);
    expect(duplicate.body.code).toBe('DUPLICATE_SCENARIO');
    expect(scenarioCount()).toBe(1);
    // Cancelling in the client means no second POST is sent.
    expect((await request(app).get(url)).body).toHaveLength(1);
    const confirmed = await request(app).post(url).send({ nome: 'Acesso negado', confirmarDuplicidade: true });
    expect(confirmed.status).toBe(201);
    expect((await request(app).get(url)).body).toHaveLength(2);
    expect((await request(app).get('/api/tests')).body[0]._count.cenarios).toBe(2);
  });

  it('valida teste existente e nome do cenário', async () => {
    const teste = await request(app).post('/api/tests').send({ nome: 'Teste A' });
    expect((await request(app).post(`/api/tests/${teste.body.id}/scenarios`).send({ nome: '   ' })).status).toBe(400);
    expect((await request(app).post(`/api/tests/${randomUUID()}/scenarios`).send({ nome: 'Caso' })).status).toBe(404);
    expect(scenarioCount()).toBe(0);
  });
});

describe('TES-54/56/60/62: execução e histórico', () => {
  async function fixture() {
    const teste = await request(app).post('/api/tests').send({ nome: 'Login' });
    const cenario = await request(app).post(`/api/tests/${teste.body.id}/scenarios`).send({
      nome: 'Senha incorreta', preCondicoes: 'Usuário ativo', passos: 'Abrir login\nDigitar senha errada', resultadoEsperado: 'Acesso negado'
    });
    return { teste: teste.body, cenario: cenario.body, base: `/api/tests/${teste.body.id}/scenarios/${cenario.body.id}/executions` };
  }

  it('inicia execução de cenário existente e apresenta os passos', async () => {
    const { cenario, base } = await fixture();
    const started = await request(app).post(base).send({});
    expect(started.status).toBe(201);
    expect(started.body).toMatchObject({ status: 'em_andamento', cenarioId: cenario.id });
    expect(started.body.cenario.passos).toBe('Abrir login\nDigitar senha errada');
    expect((await request(app).get(base)).body).toHaveLength(0);
  });

  it('registra aprovado, reprovado e bloqueado, com evidências e histórico recente primeiro', async () => {
    const { teste, cenario, base } = await fixture();
    for (const resultado of ['aprovado', 'reprovado', 'bloqueado']) {
      const started = await request(app).post(base).send({});
      const finished = await request(app).patch(`${base}/${started.body.id}`).send({ resultado, responsavel: 'Ana QA', evidencias: `Evidência ${resultado}` });
      expect(finished.status).toBe(200);
      expect(finished.body).toMatchObject({ resultado, responsavel: 'Ana QA', evidencias: `Evidência ${resultado}`, status: 'finalizada', cenarioId: cenario.id });
      await new Promise((resolve) => setTimeout(resolve, 3));
    }
    const history = await request(app).get(base);
    expect(history.status).toBe(200);
    expect(history.body.map((item) => item.resultado)).toEqual(['bloqueado', 'reprovado', 'aprovado']);
    expect(history.body.every((item) => item.finalizadoEm && item.cenarioId === cenario.id)).toBe(true);
    expect((await request(app).get(`/api/tests/${teste.id}/scenarios`)).body[0].ultimoResultado).toBe('bloqueado');
  });

  it('repetir a mesma finalização é idempotente; dados diferentes são rejeitados', async () => {
    const { base } = await fixture();
    const started = await request(app).post(base).send({});
    const url = `${base}/${started.body.id}`;
    const payload = { resultado: 'aprovado', responsavel: 'Ana', evidencias: 'Captura de tela' };
    const first = await request(app).patch(url).send(payload);
    const retry = await request(app).patch(url).send(payload);
    expect(retry.status).toBe(200);
    expect(retry.body.finalizadoEm).toBe(first.body.finalizadoEm);
    expect((await request(app).get(base)).body).toHaveLength(1);
    expect((await request(app).patch(url).send({ ...payload, resultado: 'reprovado' })).status).toBe(409);
    expect((await request(app).get(base)).body).toHaveLength(1);
  });

  it('valida resultado e responsável e não aceita vínculo com outro cenário', async () => {
    const { teste, base } = await fixture();
    const started = await request(app).post(base).send({});
    const url = `${base}/${started.body.id}`;
    expect((await request(app).patch(url).send({ resultado: 'ignorado', responsavel: 'Ana' })).status).toBe(400);
    expect((await request(app).patch(url).send({ resultado: 'aprovado', responsavel: '  ' })).status).toBe(400);
    expect((await request(app).post(`/api/tests/${teste.id}/scenarios/${randomUUID()}/executions`).send({})).status).toBe(404);
    expect((await request(app).patch(`/api/tests/${teste.id}/scenarios/${randomUUID()}/executions/${started.body.id}`).send({ resultado: 'aprovado', responsavel: 'Ana' })).status).toBe(404);
    expect((await request(app).get(base)).body).toHaveLength(0);
  });
});
