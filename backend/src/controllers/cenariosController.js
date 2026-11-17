import { associarRiscosCenario, criarCenario, listarCenarios } from '../services/cenariosService.js';

export async function index(req, res) {
  res.json(await listarCenarios(req.params.testId));
}

export async function store(req, res) {
  res.status(201).json(await criarCenario(req.params.testId, req.body));
}

export async function linkRisks(req, res) {
  res.json(await associarRiscosCenario(req.params.testId, req.params.scenarioId, req.body));
}
