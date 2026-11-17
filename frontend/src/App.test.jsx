import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mock = vi.hoisted(() => ({
  listarTestes: vi.fn(), obterTeste: vi.fn(), criarTeste: vi.fn(), listarCenarios: vi.fn(), criarCenario: vi.fn(),
  iniciarExecucao: vi.fn(), finalizarExecucao: vi.fn(), listarExecucoes: vi.fn()
}));
vi.mock('./services/api.js', () => ({ api: mock }));

import App from './App.jsx';

const teste = { id: '123e4567-e89b-42d3-a456-426614174000', nome: 'Teste de autenticação', descricao: 'Verificar login', passos: 'Abrir página', createdAt: '2026-11-17T10:00:00.000Z', _count: { cenarios: 1 } };
const cenario = { id: '123e4567-e89b-42d3-a456-426614174001', testeId: teste.id, nome: 'Senha inválida', descricao: 'Valida rejeição de senha', preCondicoes: 'Usuário ativo', passos: 'Abrir login\nInformar senha errada', resultadoEsperado: 'Acesso negado', createdAt: '2026-11-17T10:00:00.000Z' };

afterEach(() => cleanup());

beforeEach(() => {
  vi.clearAllMocks();
  mock.listarTestes.mockResolvedValue([]);
  mock.listarCenarios.mockResolvedValue([]);
  mock.listarExecucoes.mockResolvedValue([]);
});

describe('TES-55/56/61/62: execução manual e histórico', () => {
  async function openScenario(user) {
    mock.listarTestes.mockResolvedValue([teste]);
    mock.listarCenarios.mockResolvedValue([cenario]);
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Teste de autenticação/ }));
    await screen.findByText('Senha inválida');
  }

  it('inicia a execução e apresenta os passos em sequência com acompanhamento', async () => {
    const user = userEvent.setup();
    mock.iniciarExecucao.mockResolvedValue({ id: '123e4567-e89b-42d3-a456-426614174010', cenario, status: 'em_andamento' });
    await openScenario(user);
    await user.click(screen.getByRole('button', { name: 'Executar cenário' }));
    await user.click(screen.getByRole('button', { name: 'Iniciar execução' }));
    expect(await screen.findByText('Abrir login')).toBeInTheDocument();
    expect(screen.getByText('Informar senha errada')).toBeInTheDocument();
    expect(screen.getAllByText('Valida rejeição de senha')).toHaveLength(2);
    await user.click(screen.getAllByRole('checkbox')[0]);
    expect(screen.getByText('1/2 acompanhados')).toBeInTheDocument();
    expect(mock.iniciarExecucao).toHaveBeenCalledWith(teste.id, cenario.id);
  });

  it.each([['aprovado', 'Aprovado'], ['reprovado', 'Reprovado'], ['bloqueado', 'Bloqueado']])('finaliza como %s e atualiza o resultado na listagem', async (resultado, label) => {
    const user = userEvent.setup();
    const executionId = '123e4567-e89b-42d3-a456-426614174010';
    mock.iniciarExecucao.mockResolvedValue({ id: executionId, cenario, status: 'em_andamento' });
    mock.finalizarExecucao.mockResolvedValue({ id: executionId, resultado, responsavel: 'Ana QA', evidencias: 'Captura', finalizadoEm: '2026-11-17T12:00:00.000Z' });
    await openScenario(user);
    await user.click(screen.getByRole('button', { name: 'Executar cenário' }));
    await user.click(screen.getByRole('button', { name: 'Iniciar execução' }));
    await screen.findByLabelText(/Responsável/);
    await user.type(screen.getByLabelText(/Responsável/), 'Ana QA');
    await user.click(screen.getByRole('radio', { name: label }));
    await user.type(screen.getByLabelText('Evidências'), 'Captura');
    await user.click(screen.getByRole('button', { name: 'Finalizar execução' }));
    const dialog = screen.getByRole('dialog');
    expect(within(dialog).getByText(/Finalizar esta execução/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar e salvar' }));
    expect(await screen.findByText('Resultado salvo no histórico de execuções.')).toBeInTheDocument();
    expect(within(screen.getByText('ÚLTIMO RESULTADO').parentElement).getByText(label)).toBeInTheDocument();
    expect(mock.finalizarExecucao).toHaveBeenCalledWith(teste.id, cenario.id, executionId, { resultado, responsavel: 'Ana QA', evidencias: 'Captura' });
  });

  it('mostra histórico recente primeiro, responsável e evidências', async () => {
    const user = userEvent.setup();
    mock.listarExecucoes.mockResolvedValue([
      { id: '123e4567-e89b-42d3-a456-426614174012', resultado: 'bloqueado', responsavel: 'Bruno', evidencias: 'Evidência recente', finalizadoEm: '2026-11-17T12:00:00.000Z' },
      { id: '123e4567-e89b-42d3-a456-426614174011', resultado: 'aprovado', responsavel: 'Ana', evidencias: 'Evidência anterior', finalizadoEm: '2026-11-16T12:00:00.000Z' }
    ]);
    await openScenario(user);
    await user.click(screen.getByRole('button', { name: 'Histórico de Execuções' }));
    const history = (await screen.findByRole('heading', { name: 'Histórico de Execuções' })).closest('.execution-history');
    await waitFor(() => expect(within(history).getAllByRole('article')).toHaveLength(2));
    const items = within(history).getAllByRole('article');
    expect(items[0]).toHaveTextContent('Bloqueado');
    expect(items[0]).toHaveTextContent('Bruno');
    expect(items[0]).toHaveTextContent('Evidência recente');
    expect(items[1]).toHaveTextContent('Aprovado');
    expect(items[1]).toHaveTextContent('Evidência anterior');
  });

  it('informa quando não há histórico', async () => {
    const user = userEvent.setup();
    await openScenario(user);
    await user.click(screen.getByRole('button', { name: 'Histórico de Execuções' }));
    expect(await screen.findByText('Este cenário ainda não possui histórico de execuções.')).toBeInTheDocument();
  });
});

describe('TES-33/34: interface de testes', () => {
  it('cadastra um teste e o mostra na listagem', async () => {
    mock.criarTeste.mockResolvedValue(teste);
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Nenhum teste ainda');
    await user.type(screen.getByLabelText(/Nome do teste/), 'Teste de autenticação');
    await user.type(screen.getByLabelText('Descrição'), 'Verificar login');
    await user.type(screen.getByLabelText('Passos de execução'), 'Abrir página');
    await user.click(screen.getByRole('button', { name: 'Cadastrar teste' }));
    expect(await screen.findByText('Teste cadastrado com sucesso.')).toBeInTheDocument();
    expect(screen.getByText('Teste de autenticação')).toBeInTheDocument();
    expect(mock.criarTeste).toHaveBeenCalledWith({ nome: 'Teste de autenticação', descricao: 'Verificar login', passos: 'Abrir página' });
  });

  it('mostra erro sem nome e não chama a API', async () => {
    const user = userEvent.setup();
    render(<App />);
    await screen.findByText('Nenhum teste ainda');
    await user.click(screen.getByRole('button', { name: 'Cadastrar teste' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Informe o nome do teste.');
    expect(mock.criarTeste).not.toHaveBeenCalled();
  });
});

describe('TES-36/37: cenários e alerta', () => {
  async function openDetail(user) {
    mock.listarTestes.mockResolvedValue([teste]);
    mock.listarCenarios.mockResolvedValue([cenario]);
    render(<App />);
    await user.click(await screen.findByRole('button', { name: /Teste de autenticação/ }));
    await screen.findByText('Senha inválida');
  }

  it('cadastra e exibe um cenário vinculado ao teste', async () => {
    const user = userEvent.setup();
    const novo = { ...cenario, id: '123e4567-e89b-42d3-a456-426614174002', nome: 'Conta bloqueada' };
    mock.criarCenario.mockResolvedValue(novo);
    await openDetail(user);
    await user.type(screen.getByLabelText(/Nome do cenário/), 'Conta bloqueada');
    await user.type(screen.getByLabelText('Pré-condições'), 'Conta suspensa');
    await user.type(screen.getByLabelText('Resultado esperado'), 'Acesso negado');
    await user.click(screen.getByRole('button', { name: 'Cadastrar cenário' }));
    expect(await screen.findByText('Conta bloqueada')).toBeInTheDocument();
    expect(screen.getByText('Cenário cadastrado com sucesso.')).toBeInTheDocument();
    expect(mock.criarCenario).toHaveBeenCalledWith(teste.id, expect.objectContaining({ nome: 'Conta bloqueada', confirmarDuplicidade: false }));
  });

  it('mostra alerta de duplicidade e cancela sem reenviar', async () => {
    const user = userEvent.setup();
    mock.criarCenario.mockRejectedValue({ code: 'DUPLICATE_SCENARIO', message: 'Nome duplicado' });
    await openDetail(user);
    await user.type(screen.getByLabelText(/Nome do cenário/), 'Senha inválida');
    await user.click(screen.getByRole('button', { name: 'Cadastrar cenário' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/Já existe um cenário/)).toBeInTheDocument();
    await user.click(within(dialog).getByRole('button', { name: 'Cancelar' }));
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    expect(mock.criarCenario).toHaveBeenCalledTimes(1);
  });

  it('reenvia com confirmação explícita e exibe o duplicado', async () => {
    const user = userEvent.setup();
    const duplicado = { ...cenario, id: '123e4567-e89b-42d3-a456-426614174003' };
    mock.criarCenario.mockRejectedValueOnce({ code: 'DUPLICATE_SCENARIO', message: 'Nome duplicado' }).mockResolvedValueOnce(duplicado);
    await openDetail(user);
    await user.type(screen.getByLabelText(/Nome do cenário/), 'Senha inválida');
    await user.click(screen.getByRole('button', { name: 'Cadastrar cenário' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Confirmar duplicidade' }));
    await waitFor(() => expect(mock.criarCenario).toHaveBeenCalledTimes(2));
    expect(mock.criarCenario).toHaveBeenLastCalledWith(teste.id, expect.objectContaining({ confirmarDuplicidade: true }));
    expect(await screen.findByText('Cenário cadastrado com sucesso.')).toBeInTheDocument();
    expect(screen.getAllByText('Senha inválida')).toHaveLength(2);
  });
});
