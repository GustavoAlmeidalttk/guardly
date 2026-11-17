const category = {
  'no-eval': 'Execução dinâmica de código',
  'no-implied-eval': 'Execução dinâmica de código',
  'security/detect-child-process': 'Processo do sistema',
  'security/detect-non-literal-fs-filename': 'Acesso dinâmico a arquivo',
  'security/detect-non-literal-require': 'Importação dinâmica',
  'security/detect-non-literal-regexp': 'Expressão regular dinâmica',
  'security/detect-unsafe-regex': 'Expressão regular potencialmente custosa',
  'security/detect-object-injection': 'Acesso dinâmico a objeto',
  'security/detect-bidi-characters': 'Caracteres bidirecionais suspeitos'
};

export function normalizeFindings(messages) {
  return messages.map((message) => {
    const location = {};
    if (Number.isInteger(message.line)) location.line = message.line;
    if (Number.isInteger(message.column)) location.column = message.column;
    if (Number.isInteger(message.endLine)) location.endLine = message.endLine;
    if (Number.isInteger(message.endColumn)) location.endColumn = message.endColumn;
    return {
      type: category[message.ruleId] || message.ruleId,
      severity: message.severity === 2 ? 'alta' : 'media',
      description: message.message,
      location: Object.keys(location).length ? location : null,
      ruleId: message.ruleId,
      analyzer: 'ESLint + eslint-plugin-security'
    };
  });
}
