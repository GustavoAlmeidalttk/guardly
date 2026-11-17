import { atualizarSugestao, gerarSugestoes, listarSugestoes } from '../services/suggestionsService.js';

export async function index(req, res) { res.json(await listarSugestoes(req.params.testId)); }
export async function generate(req, res) { res.status(201).json(await gerarSugestoes(req.params.testId, req.body)); }
export async function update(req, res) { res.json(await atualizarSugestao(req.params.testId, req.params.suggestionId, req.body)); }
