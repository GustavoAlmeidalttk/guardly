import { Linter } from 'eslint';
import security from 'eslint-plugin-security';

const linter = new Linter({ configType: 'flat' });
const rules = {
  ...security.configs.recommended.rules,
  'security/detect-eval-with-expression': 'off',
  'no-eval': 'error',
  'no-implied-eval': 'error'
};
const configuration = [{
  files: ['**/*.js'],
  languageOptions: { ecmaVersion: 'latest', sourceType: 'module', parserOptions: { ecmaFeatures: { jsx: true } } },
  plugins: { security },
  rules
}];

let input = '';
for await (const chunk of process.stdin) {
  input += chunk;
  if (Buffer.byteLength(input, 'utf8') > 120_000) process.exit(2);
}

try {
  const { code } = JSON.parse(input);
  if (typeof code !== 'string') throw new Error('Invalid worker input');
  const messages = linter.verify(code, configuration, { filename: 'snippet.js' });
  const syntaxError = messages.find((message) => message.fatal);
  if (syntaxError) {
    process.stdout.write(JSON.stringify({ error: { kind: 'PARSE_ERROR', line: syntaxError.line, column: syntaxError.column } }));
  } else {
    process.stdout.write(JSON.stringify({ messages: messages.filter((message) => message.ruleId) }));
  }
} catch {
  process.exitCode = 2;
}
