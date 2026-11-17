export class HttpError extends Error {
  constructor(status, code, message, details = undefined) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export const asyncHandler = (handler) => (req, res, next) => {
  Promise.resolve(handler(req, res, next)).catch(next);
};

export function errorHandler(error, _req, res, _next) {
  if (error instanceof HttpError) {
    return res.status(error.status).json({ code: error.code, message: error.message, ...(error.details && { details: error.details }) });
  }
  if (error?.type === 'entity.parse.failed') {
    return res.status(400).json({ code: 'INVALID_JSON', message: 'JSON inválido.' });
  }
  if (error?.type === 'entity.too.large') {
    return res.status(413).json({ code: 'PAYLOAD_TOO_LARGE', message: 'O conteúdo enviado é muito grande.' });
  }
  console.error('Erro interno:', error);
  return res.status(500).json({ code: 'INTERNAL_ERROR', message: 'Não foi possível processar a solicitação.' });
}
