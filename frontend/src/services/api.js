const baseUrl = (import.meta.env.VITE_API_URL || 'http://127.0.0.1:3000/api').replace(/\/$/, '');

export class ApiError extends Error {
  constructor(message, status, code) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${baseUrl}${path}`, {
      ...options,
      headers: { 'Content-Type': 'application/json', ...options.headers }
    });
  } catch {
    throw new ApiError('Não foi possível conectar à API. Verifique se o backend está em execução.', 0, 'NETWORK_ERROR');
  }
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new ApiError(body.message || 'A solicitação falhou.', response.status, body.code);
  return body;
}

export const api = {
  listarTestes: () => request('/tests'),
  obterTeste: (id) => request(`/tests/${encodeURIComponent(id)}`),
  criarTeste: (data) => request('/tests', { method: 'POST', body: JSON.stringify(data) }),
  listarCenarios: (id) => request(`/tests/${encodeURIComponent(id)}/scenarios`),
  criarCenario: (id, data) => request(`/tests/${encodeURIComponent(id)}/scenarios`, { method: 'POST', body: JSON.stringify(data) }),
  iniciarExecucao: (testId, scenarioId) => request(`/tests/${encodeURIComponent(testId)}/scenarios/${encodeURIComponent(scenarioId)}/executions`, { method: 'POST', body: '{}' }),
  finalizarExecucao: (testId, scenarioId, executionId, data) => request(`/tests/${encodeURIComponent(testId)}/scenarios/${encodeURIComponent(scenarioId)}/executions/${encodeURIComponent(executionId)}`, { method: 'PATCH', body: JSON.stringify(data) }),
  listarExecucoes: (testId, scenarioId) => request(`/tests/${encodeURIComponent(testId)}/scenarios/${encodeURIComponent(scenarioId)}/executions`),
  analisarCodigo: (data) => request('/security/analyze', { method: 'POST', body: JSON.stringify(data) })
};
