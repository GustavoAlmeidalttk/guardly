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

const criticalRules = new Set(['no-eval', 'no-implied-eval']);
const highRules = new Set([
  'security/detect-child-process', 'security/detect-non-literal-fs-filename',
  'security/detect-non-literal-require', 'security/detect-unsafe-regex',
  'security/detect-object-injection'
]);

const remediation = {
  'no-eval': 'Remova eval e use operações explícitas ou um parser restrito para tratar a entrada como dado.',
  'no-implied-eval': 'Passe uma função como callback em vez de uma string executável.',
  'security/detect-child-process': 'Evite argumentos controlados pelo usuário; use comandos permitidos e argumentos validados individualmente.',
  'security/detect-non-literal-fs-filename': 'Normalize o caminho e valide que ele permaneça dentro do diretório permitido.',
  'security/detect-non-literal-require': 'Prefira imports estáticos ou uma lista fechada de módulos permitidos.',
  'security/detect-non-literal-regexp': 'Valide e limite a entrada antes de construir a expressão regular.',
  'security/detect-unsafe-regex': 'Revise a expressão para evitar retrocesso excessivo e limite o tamanho da entrada.',
  'security/detect-object-injection': 'Valide a chave contra uma lista permitida antes de acessar o objeto.',
  'security/detect-bidi-characters': 'Remova caracteres bidirecionais inesperados e revise a linha no diff de origem.'
};

function severityFor(message) {
  if (criticalRules.has(message.ruleId)) return 'critica';
  if (highRules.has(message.ruleId)) return 'alta';
  return message.severity === 1 ? 'baixa' : 'media';
}

export function normalizeFindings(messages) {
  return messages.map((message) => {
    const location = {};
    if (Number.isInteger(message.line)) location.line = message.line;
    if (Number.isInteger(message.column)) location.column = message.column;
    if (Number.isInteger(message.endLine)) location.endLine = message.endLine;
    if (Number.isInteger(message.endColumn)) location.endColumn = message.endColumn;
    return {
      type: category[message.ruleId] || message.ruleId,
      severity: severityFor(message),
      description: message.message,
      recommendation: remediation[message.ruleId] || 'Revise o uso identificado e aplique validação e controles de acesso adequados ao contexto.',
      location: Object.keys(location).length ? location : null,
      ruleId: message.ruleId,
      analyzer: 'ESLint + eslint-plugin-security'
    };
  });
}

const sensitivePatterns = [
  ['autenticacao', /(?:\b(?:login|authenticate|auth|authorize|isAuthenticated|checkPermission|acesso)\b|autentica(?:cao|ção)|autoriz(?:a|ação))/i, 'Autenticação e controle de acesso', 'Revisar validação de identidade e autorização no servidor.'],
  ['credenciais', /\b(?:password|passwd|secret|api[_-]?key|access[_-]?token|credential|senha|credencial|segredo)\b/i, 'Manipulação de credenciais', 'Verificar armazenamento, exposição e rotação de credenciais.'],
  ['dados_sensiveis', /\b(?:ssn|cpf|creditCard|health|medical|personalData|cart[aã]o)\b|dados(?:Pessoais|Sens[ií]veis)|\bdados\s+(?:pessoais|sens[ií]veis)\b/i, 'Acesso a dados sensíveis', 'Verificar minimização, autorização e proteção dos dados sensíveis.'],
  ['permissoes', /\b(?:chmod|chown|grant|role|permission|sudo|permiss[aã]o|papel)\b/i, 'Operações com permissões', 'Verificar privilégio mínimo e validação das permissões.'],
  ['banco', /\b(?:query|execute|findOne|findMany|select|insert|update|delete|banco\s+de\s+dados|consulta)\s*(?:\(|\b)/i, 'Consulta ou manipulação de banco de dados', 'Revisar uso de parâmetros e controle de acesso aos registros.'],
  ['arquivos', /\b(?:readFile|writeFile|createReadStream|unlink|open|arquivo|filePath)\s*(?:\(|\b)/i, 'Operações com arquivos', 'Verificar validação de caminhos e acesso fora do diretório permitido.'],
  ['upload', /\b(?:upload|uploadFile|fileUpload|receiveFile|multipart|multer|formidable|busboy|anexar\s+arquivo)\b/i, 'Upload de arquivos', 'Verificar tipo, tamanho, conteúdo e armazenamento seguro dos arquivos recebidos.'],
  ['pagamento', /\b(?:payment|checkout|charge|refund|billing|stripe|paypal|invoice|pagamento|cobranca|cobrança|pagamentos)\b/i, 'Operações de pagamento', 'Verificar autorização, integridade do valor e prevenção de repetição de transações.'],
  ['comandos', /\b(?:exec|execSync|spawn|spawnSync)\s*\(/i, 'Execução de comandos', 'Verificar se argumentos não controlados pelo usuário chegam ao processo.'],
  ['servicos_externos', /\b(?:fetch|axios\.(?:get|post|put|delete)|https?\.request|webhook|externalApi|apiClient|integra(?:cao|ção)\s+externa|servi(?:co|ço)\s+externo)\s*(?:\(|\b)/i, 'Comunicação com serviços externos', 'Verificar validação de destino, autenticação e tratamento de dados enviados.']
];

export function detectSensitiveFeatures(code) {
  const found = new Map();
  code.split(/\r?\n/).forEach((line, index) => {
    for (const [key, pattern, name, guidance] of sensitivePatterns) {
      if (pattern.test(line) && !found.has(key)) found.set(key, {
        id: key, name, description: guidance,
        location: { line: index + 1, column: Math.max(1, line.search(pattern) + 1) }
      });
    }
  });
  return [...found.values()];
}
