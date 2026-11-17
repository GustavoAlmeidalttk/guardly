import { spawn } from 'node:child_process';
import { spawnSync } from 'node:child_process';
import { tmpdir } from 'node:os';
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { HttpError } from '../middlewares/errors.js';

const defaultWorker = fileURLToPath(new URL('./eslintWorker.js', import.meta.url));
const MAX_OUTPUT_BYTES = 200_000;

export function runStaticAnalyzer(code, { workerPath, timeoutMs = 8000 } = {}) {
  if (!workerPath && process.env.ANALYZER_MODE !== 'process-dev') {
    return runContainerAnalyzer(code, timeoutMs);
  }
  return new Promise((resolve, reject) => {
    const environment = {};
    for (const name of ['SystemRoot', 'WINDIR', 'PATH', 'Path', 'TEMP', 'TMP']) {
      if (process.env[name]) environment[name] = process.env[name];
    }
    const child = spawn(process.execPath, ['--max-old-space-size=128', workerPath || defaultWorker], {
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

function runContainerAnalyzer(code, timeoutMs) {
  return new Promise((resolve, reject) => {
    const dockerBin = process.env.DOCKER_BIN || 'docker';
    const cidDir = mkdtempSync(join(tmpdir(), 'guardly-container-'));
    const cidFile = join(cidDir, 'container-id');
    const cleanup = () => { try { rmSync(cidDir, { recursive: true, force: true }); } catch {} };
    const stopContainer = () => {
      try {
        const containerId = readFileSync(cidFile, 'utf8').trim();
        if (containerId) spawnSync(dockerBin, ['kill', containerId], { stdio: 'ignore', timeout: 3000, windowsHide: true });
      } catch {}
      cleanup();
    };
    const child = spawn(process.env.DOCKER_BIN || 'docker', [
      'run', '--rm', '-i', `--cidfile=${cidFile}`, '--network=none', '--memory=256m', '--cpus=1', '--pids-limit=64',
      '--read-only', '--cap-drop=ALL', '--security-opt=no-new-privileges', '--user=65532:65532',
      '--tmpfs=/tmp:rw,noexec,nosuid,size=16m', process.env.ANALYZER_IMAGE || 'guardly-analyzer:local'
    ], { stdio: ['pipe', 'pipe', 'ignore'], windowsHide: true, shell: false });
    let output = ''; let settled = false;
    const timer = setTimeout(() => { stopContainer(); child.kill('SIGKILL'); if (!settled) { settled = true; reject(new HttpError(504, 'ANALYSIS_TIMEOUT', 'A análise excedeu o tempo permitido.')); } }, timeoutMs);
    child.stdout.on('data', (chunk) => { output += chunk.toString(); if (Buffer.byteLength(output) > MAX_OUTPUT_BYTES) child.kill('SIGKILL'); });
    child.on('error', () => { cleanup(); if (!settled) { settled = true; clearTimeout(timer); reject(new HttpError(503, 'ISOLATION_UNAVAILABLE', 'O ambiente isolado Docker não está disponível.')); } });
    child.on('close', (status) => {
      cleanup(); if (settled) return; settled = true; clearTimeout(timer);
      if (status !== 0) return reject(new HttpError(502, 'ANALYZER_FAILED', 'O contêiner de análise falhou.'));
      try { const data = JSON.parse(output); if (data.error?.kind === 'PARSE_ERROR') return reject(new HttpError(422, 'ANALYSIS_PARSE_ERROR', `Não foi possível analisar a sintaxe do código na linha ${data.error.line || '?'}.`)); if (!Array.isArray(data.messages)) throw new Error(); resolve(data.messages); }
      catch { reject(new HttpError(502, 'ANALYZER_FAILED', 'A ferramenta de análise produziu uma resposta inválida.')); }
    });
    child.stdin.on('error', () => {}); child.stdin.end(JSON.stringify({ code }));
  });
}
