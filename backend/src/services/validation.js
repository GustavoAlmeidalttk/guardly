import { HttpError } from '../middlewares/errors.js';

const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function validId(id) {
  if (!uuidPattern.test(id)) throw new HttpError(400, 'INVALID_ID', 'Identificador inválido.');
  return id;
}

function bodyObject(body) {
  if (!body || typeof body !== 'object' || Array.isArray(body)) {
    throw new HttpError(400, 'INVALID_BODY', 'Envie um objeto JSON válido.');
  }
}

function field(body, key, { required = false, max = 10000 } = {}) {
  const value = body[key] === undefined ? '' : body[key];
  if (typeof value !== 'string') throw new HttpError(400, 'INVALID_FIELD', `O campo ${key} deve ser texto.`);
  const trimmed = value.trim();
  if (required && !trimmed) throw new HttpError(400, 'REQUIRED_FIELD', `O campo ${key} é obrigatório.`);
  if (trimmed.length > max) throw new HttpError(400, 'FIELD_TOO_LONG', `O campo ${key} deve ter no máximo ${max} caracteres.`);
  return trimmed;
}

export function validateTeste(body) {
  bodyObject(body);
  return {
    nome: field(body, 'nome', { required: true, max: 160 }),
    descricao: field(body, 'descricao'),
    passos: field(body, 'passos')
  };
}

export function validateCenario(body) {
  bodyObject(body);
  if (body.confirmarDuplicidade !== undefined && typeof body.confirmarDuplicidade !== 'boolean') {
    throw new HttpError(400, 'INVALID_FIELD', 'O campo confirmarDuplicidade deve ser booleano.');
  }
  const nome = field(body, 'nome', { required: true, max: 160 });
  const nomeNormalizado = nome.normalize('NFKC').toLocaleLowerCase('pt-BR');
  if (nomeNormalizado.length > 160) throw new HttpError(400, 'FIELD_TOO_LONG', 'O campo nome deve ter no máximo 160 caracteres.');
  return {
    nome,
    nomeNormalizado,
    descricao: field(body, 'descricao'),
    preCondicoes: field(body, 'preCondicoes'),
    passos: field(body, 'passos'),
    resultadoEsperado: field(body, 'resultadoEsperado'),
    confirmarDuplicidade: body.confirmarDuplicidade === true
  };
}

export function validateFinalizacao(body) {
  bodyObject(body);
  if (!['aprovado', 'reprovado', 'bloqueado'].includes(body.resultado)) {
    throw new HttpError(400, 'INVALID_RESULT', 'O resultado deve ser aprovado, reprovado ou bloqueado.');
  }
  return {
    resultado: body.resultado,
    responsavel: field(body, 'responsavel', { required: true, max: 160 }),
    evidencias: field(body, 'evidencias')
  };
}
