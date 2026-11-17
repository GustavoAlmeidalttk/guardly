import { existsSync, readdirSync } from 'node:fs';
import { spawn, spawnSync } from 'node:child_process';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const environment = {
  ...process.env,
  XDG_CONFIG_HOME: join(root, '.firebase-config'),
  XDG_CACHE_HOME: join(root, '.firebase-cache'),
  FIREBASE_CLI_DISABLE_UPDATE_CHECK: '1'
};

const currentJava = spawnSync('java', ['-version'], { encoding: 'utf8' });
const version = Number((`${currentJava.stdout || ''}${currentJava.stderr || ''}`).match(/version "(\d+)/)?.[1] || 0);
if (process.platform === 'win32' && version < 21) {
  const bases = [
    join(process.env.LOCALAPPDATA || '', 'Programs', 'Eclipse Adoptium'),
    'C:\\Program Files\\Eclipse Adoptium'
  ];
  for (const base of bases) {
    if (!existsSync(base)) continue;
    const candidates = readdirSync(base).filter((name) => /^jdk-2[1-9]/.test(name)).sort().reverse();
    const selected = candidates.map((name) => join(base, name)).find((path) => existsSync(join(path, 'bin', 'java.exe')));
    if (selected) {
      environment.JAVA_HOME = selected;
      const pathKey = Object.keys(environment).find((key) => key.toLowerCase() === 'path') || 'PATH';
      environment[pathKey] = `${join(selected, 'bin')};${environment[pathKey] || ''}`;
      console.log(`Usando Java de ${selected}`);
      break;
    }
  }
}

const selectedJava = spawnSync('java', ['-version'], { encoding: 'utf8', env: environment });
const selectedVersion = Number((`${selectedJava.stdout || ''}${selectedJava.stderr || ''}`).match(/version "(\d+)/)?.[1] || 0);
if (selectedVersion < 21) {
  console.error('O emulador do Firestore exige Java 21 ou superior.');
  process.exit(1);
}

const cli = join(root, 'node_modules', 'firebase-tools', 'lib', 'bin', 'firebase.js');
const child = spawn(process.execPath, [cli, 'emulators:start', '--only', 'firestore', '--project', 'demo-guardly'], {
  cwd: root,
  env: environment,
  stdio: 'inherit'
});
child.on('error', (error) => { console.error(error.message); process.exitCode = 1; });
child.on('exit', (code) => { process.exitCode = code ?? 1; });
