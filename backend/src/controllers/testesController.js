import { criarTeste, listarTestes, obterTeste } from '../services/testesService.js';

export async function index(_req, res) {
  res.json(await listarTestes());
}

export async function show(req, res) {
  res.json(await obterTeste(req.params.id));
}

export async function store(req, res) {
  res.status(201).json(await criarTeste(req.body));
}
