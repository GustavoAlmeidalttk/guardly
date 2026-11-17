import { finalizarExecucao, iniciarExecucao, listarHistorico } from '../services/execucoesService.js';

export async function start(req, res) {
  const { testId, scenarioId } = req.params;
  res.status(201).json(await iniciarExecucao(testId, scenarioId));
}

export async function finish(req, res) {
  const { testId, scenarioId, executionId } = req.params;
  res.json(await finalizarExecucao(testId, scenarioId, executionId, req.body));
}

export async function index(req, res) {
  const { testId, scenarioId } = req.params;
  res.json(await listarHistorico(testId, scenarioId));
}
