/** A real isolated public fork simulation: whitelist sources, no env files or credentials. */
import { mkdtemp, cp, access, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

const target = await mkdtemp(join(tmpdir(), 'atlas-public-fork-'));
const files = [
  'package.json',
  'pnpm-lock.yaml',
  'pnpm-workspace.yaml',
  'tsconfig.json',
  'vite.config.ts',
  'vitest.config.ts',
  'eslint.config.mjs',
  'playwright.config.ts',
  'index.html',
  'src',
  'tests',
  'public',
  'scripts',
  'deploy',
  'Dockerfile',
  'README.md',
  'RELEASES.md',
  'SECURITY.md',
  'docs',
  'LICENSE',
  'THIRD_PARTY_LICENSES.md',
];
for (const file of files) await cp(file, join(target, file), { recursive: true });
for (const file of ['.env', '.env.local', '.env.production', '.git', '.deploy-keys']) {
  try {
    await access(join(target, file));
    throw new Error(`Unexpected private file ${file}`);
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
}
const env = {
  PATH: process.env.PATH,
  HOME: process.env.HOME,
  CI: 'true',
  PLAYWRIGHT_BROWSERS_PATH: process.env.PLAYWRIGHT_BROWSERS_PATH ?? '',
  E2E_BASE_URL: 'http://127.0.0.1:4331',
};
function spawnPnpm(args, options) {
  if (process.platform !== 'win32') return spawn('pnpm', args, options);

  if (!process.env.ComSpec)
    throw new Error('Windows command processor is unavailable.');
  return spawn(
    process.env.ComSpec,
    ['/d', '/s', '/c', `pnpm ${args.join(' ')}`],
    options,
  );
}
function run(args) {
  return new Promise((resolve, reject) => {
    const child = spawnPnpm(args, { cwd: target, env, stdio: 'inherit' });
    child.on('error', reject);
    child.on('exit', (code) =>
      code === 0 ? resolve() : reject(Error(`${args.join(' ')} exited ${code}`)),
    );
  });
}
console.log(`Public fork workspace: ${target}`);
await run(['install', '--frozen-lockfile']);
await run(['typecheck']);
await run(['lint']);
await run(['test:unit']);
await run(['build']);
const builtAnalytics = await readFile(join(target, 'dist/analytics-bootstrap.js'), 'utf8');
if (!builtAnalytics.includes('var id=""'))
  throw new Error('A public fork must have analytics disabled.');
const preview = spawn(
  process.execPath,
  [
    join(target, 'node_modules', 'vite', 'bin', 'vite.js'),
    'preview',
    '--host',
    '127.0.0.1',
    '--port',
    '4331',
  ],
  { cwd: target, env, stdio: 'inherit' },
);
try {
  let ready = false;
  for (let i = 0; i < 80; i++) {
    try {
      const response = await fetch(env.E2E_BASE_URL);
      if (response.ok) {
        ready = true;
        break;
      }
    } catch {
      /* Preview is still starting. */
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  if (!ready) throw new Error('Fork preview did not start');
  await run(['exec', 'playwright', 'test', '--workers=2']);
  console.log(
    `PASS: isolated install, types, lint, unit tests, build, browser flows, offline, no private configuration. ${target}`,
  );
} finally {
  preview.kill('SIGTERM');
}
