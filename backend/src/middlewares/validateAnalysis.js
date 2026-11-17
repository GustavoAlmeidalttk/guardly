import { HttpError } from './errors.js';

const MAX_CODE_BYTES = 50_000;

export function validateAnalysis(req, _res, next) {
  try {
    const body = req.body;
    if (!body || typeof body !== 'object' || Array.isArray(body)) {
      throw new HttpError(400, 'INVALID_BODY', 'Envie um objeto JSON válido.');
    }
    if (typeof body.code !== 'string' || !body.code.trim()) {
      throw new HttpError(400, 'CODE_REQUIRED', 'Insira um código para análise.');
    }
    if (Buffer.byteLength(body.code, 'utf8') > MAX_CODE_BYTES) {
      throw new HttpError(413, 'CODE_TOO_LARGE', 'O código deve ter no máximo 50 KB.');
    }
    const language = body.language ?? 'javascript';
    if (!['javascript', 'js'].includes(language)) {
      throw new HttpError(422, 'UNSUPPORTED_LANGUAGE', 'A linguagem informada não é suportada. Use JavaScript.');
    }
    if (body.generatedByAI !== undefined && typeof body.generatedByAI !== 'boolean') {
      throw new HttpError(400, 'INVALID_FIELD', 'O campo generatedByAI deve ser booleano.');
    }
    const aiTool = body.aiTool ?? '';
    if (typeof aiTool !== 'string' || aiTool.trim().length > 100) {
      throw new HttpError(400, 'INVALID_FIELD', 'A ferramenta de IA deve ser texto com até 100 caracteres.');
    }
    req.analysisInput = {
      code: body.code,
      language: 'javascript',
      generatedByAI: body.generatedByAI === true,
      aiTool: aiTool.trim()
    };
    next();
  } catch (error) {
    next(error);
  }
}
