import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

const mock = vi.hoisted(() => ({
  analisarCodigo: vi.fn(), listarTestes: vi.fn()
}));
vi.mock('./services/api.js', () => ({ api: mock }));

import App from './App.jsx';
import SecurityAnalysis from './pages/SecurityAnalysis.jsx';

const report = {
  analysisId: '123e4567-e89b-42d3-a456-426614174100',
  analyzedAt: '2026-11-17T12:00:00.000Z',
  language: 'javascript', generatedByAI: true, aiTool: 'ChatGPT',
  analyzer: 'ESLint + eslint-plugin-security', status: 'risks_found',
  risks: [{ type: 'Execução dinâmica de código', severity: 'alta', description: 'eval can be harmful.', location: { line: 2, column: 1 }, ruleId: 'no-eval', analyzer: 'ESLint + eslint-plugin-security' }]
};

afterEach(() => cleanup());
beforeEach(() => { vi.clearAllMocks(); mock.listarTestes.mockResolvedValue([]); });

describe('TES-71/68/7: interface de análise de segurança', () => {
  it('abre a tela de análise pela navegação existente', async () => {
    const user = userEvent.setup();
    render(<App />);
    await user.click(screen.getByRole('button', { name: 'Análise de segurança' }));
    expect(screen.getByRole('heading', { name: 'Enviar código' })).toBeInTheDocument();
    expect(screen.getByLabelText(/Código para análise/)).toBeInTheDocument();
  });

  it('rejeita envio vazio sem chamar a API', async () => {
    const user = userEvent.setup();
    render(<SecurityAnalysis />);
    await user.click(screen.getByRole('button', { name: 'Analisar código' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Insira um código para análise.');
    expect(mock.analisarCodigo).not.toHaveBeenCalled();
  });

  it('envia código, mostra carregamento e apresenta risco com severidade e linha', async () => {
    const user = userEvent.setup();
    let resolveAnalysis;
    mock.analisarCodigo.mockReturnValue(new Promise((resolve) => { resolveAnalysis = resolve; }));
    render(<SecurityAnalysis />);
    await user.type(screen.getByLabelText(/Código para análise/), 'const value = input;\neval(value);');
    await user.click(screen.getByRole('checkbox', { name: /Código gerado por inteligência artificial/ }));
    await user.type(screen.getByLabelText(/Ferramenta de IA/), 'ChatGPT');
    await user.click(screen.getByRole('button', { name: 'Analisar código' }));
    expect(screen.getByRole('status')).toHaveTextContent('Analisando o trecho');
    expect(mock.analisarCodigo).toHaveBeenCalledWith(expect.objectContaining({ language: 'javascript', generatedByAI: true, aiTool: 'ChatGPT' }));
    resolveAnalysis(report);
    expect(await screen.findByRole('heading', { name: 'Resultado da análise' })).toBeInTheDocument();
    expect(screen.getByText('Execução dinâmica de código')).toBeInTheDocument();
    expect(screen.getByText('Alta')).toBeInTheDocument();
    expect(screen.getByText('Linha 2, coluna 1')).toBeInTheDocument();
    expect(screen.getByText('eval can be harmful.')).toBeInTheDocument();
  });

  it('mostra estado sem ocorrências sem afirmar segurança completa', async () => {
    const user = userEvent.setup();
    mock.analisarCodigo.mockResolvedValue({ ...report, status: 'no_findings', risks: [], aiTool: null });
    render(<SecurityAnalysis />);
    await user.type(screen.getByLabelText(/Código para análise/), 'const answer = 2 + 2;');
    await user.click(screen.getByRole('button', { name: 'Analisar código' }));
    expect(await screen.findByText('Nenhum risco identificado pelas regras configuradas')).toBeInTheDocument();
    expect(screen.getByText(/Isso não garante que o código seja seguro/)).toBeInTheDocument();
  });

  it('exibe falha da API sem mostrar estado sem riscos', async () => {
    const user = userEvent.setup();
    mock.analisarCodigo.mockRejectedValue(new Error('A ferramenta de análise falhou.'));
    render(<SecurityAnalysis />);
    await user.type(screen.getByLabelText(/Código para análise/), 'const x = 1;');
    await user.click(screen.getByRole('button', { name: 'Analisar código' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('A ferramenta de análise falhou.');
    expect(screen.queryByText('Nenhum risco encontrado.')).not.toBeInTheDocument();
  });

  it('exporta o relatório JSON recebido da API', async () => {
    const user = userEvent.setup();
    mock.analisarCodigo.mockResolvedValue(report);
    const createUrl = vi.fn(() => 'blob:guardly-report');
    const revokeUrl = vi.fn();
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});
    URL.createObjectURL = createUrl;
    URL.revokeObjectURL = revokeUrl;
    render(<SecurityAnalysis />);
    await user.type(screen.getByLabelText(/Código para análise/), 'eval(value);');
    await user.click(screen.getByRole('button', { name: 'Analisar código' }));
    await screen.findByRole('heading', { name: 'Resultado da análise' });
    await user.click(screen.getByRole('button', { name: 'Exportar JSON' }));
    expect(createUrl).toHaveBeenCalledOnce();
    expect(createUrl.mock.calls[0][0].type).toBe('application/json');
    expect(click).toHaveBeenCalledOnce();
    expect(click.mock.instances[0].download).toBe('guardly-analise-2026-11-17.json');
    await waitFor(() => expect(revokeUrl).toHaveBeenCalledWith('blob:guardly-report'));
    click.mockRestore();
  });
});
