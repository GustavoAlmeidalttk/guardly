import { spawn } from 'node:child_process';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { HttpError } from '../middlewares/errors.js';

const defaultWorker = fileURLToPath(new URL('./eslintWorker.js', import.meta.url));
const MAX_OUTPUT_BYTES = 200_000;

export function runStaticAnalyzer(code, { workerPath = defaultWorker, timeoutMs = 8000 } = {}) {
  return new Promise((resolve, reject) => {
    const environment = {};
    for (const name of ['SystemRoot', 'WINDIR', 'PATH', 'Path', 'TEMP', 'TMP']) {
      if (process.env[name]) environment[name] = process.env[name];
    }
    const child = spawn(process.execPath, ['--max-old-space-size=128', workerPath], {
      cwd: tmpdir(), env: environment, stdio: ['pipe', 'pipe', 'pipe'], windowsHide: true, shell: false
    });
    let output = '';
    let settled = false;
    let timedOut = false;
    const fail = (error) => { if (!settled) { settled = true; clearTimeout(timer); reject(error); } };
    const timer = setTimeout(() => {
      timedOut = true;
      child.kill();
      fail(new HttpError(504, 'ANALYSIS_TIMEOUT', 'A análise excedeu o tempo permitido.'));
    }, timeoutMs);
    child.stdout.on('data', (chunk) => {
      output += chunk.toString();
      if (Buffer.byteLength(output, 'utf8') > MAX_OUTPUT_BYTES) {
        child.kill();
        fail(new HttpError(502, 'ANALYZER_FAILED', 'A ferramenta de análise produziu uma resposta inválida.'));
      }
    });
    child.stderr.on('data', () => {});
    child.on('error', () => fail(new HttpError(502, 'ANALYZER_FAILED', 'Não foi possível iniciar a ferramenta de análise.')));
    child.on('close', (code) => {
      if (settled || timedOut) return;
      if (code !== 0) return fail(new HttpError(502, 'ANALYZER_FAILED', 'A ferramenta de análise falhou.'));
      try {
        const result = JSON.parse(output);
        if (result.error?.kind === 'PARSE_ERROR') {
          return fail(new HttpError(422, 'ANALYSIS_PARSE_ERROR', `Não foi possível analisar a sintaxe do código na linha ${result.error.line || '?'}.`));
        }
        if (!Array.isArray(result.messages)) throw new Error('Invalid analyzer response');
        settled = true;
        clearTimeout(timer);
        resolve(result.messages);
      } catch {
        fail(new HttpError(502, 'ANALYZER_FAILED', 'A ferramenta de análise produziu uma resposta inválida.'));
      }
    });
    child.stdin.on('error', () => {});
    child.stdin.end(JSON.stringify({ code }));
  });
}
