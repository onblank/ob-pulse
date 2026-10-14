import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
import { dirname, resolve } from 'node:path';
const require = createRequire(import.meta.url);
const viteCli = resolve(dirname(require.resolve('vite')), '../../bin/vite.js');
const electron = require('electron');
const here = process.cwd();
let quitting = false;
const renderer = spawn(process.execPath, [viteCli, '--config', 'vite.renderer.config.ts'], {
  cwd: here,
  stdio: 'inherit',
});
const build = (config) =>
  new Promise((yes, no) => {
    const p = spawn(process.execPath, [viteCli, 'build', '--config', config], {
      cwd: here,
      stdio: 'inherit',
    });
    p.on('exit', (code) => (code === 0 ? yes() : no(new Error(`${config} failed: ${code}`))));
  });
async function online() {
  for (let i = 0; i < 100; i++) {
    try {
      const result = await fetch('http://127.0.0.1:5174');
      if (result.ok) return;
    } catch {
      // The renderer may still be starting; retry until the deadline below.
    }
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error('Vite renderer did not start');
}
let app;
try {
  await Promise.all([build('vite.main.config.ts'), build('vite.preload.config.ts'), online()]);
  app = spawn(electron, ['.'], {
    cwd: here,
    stdio: 'inherit',
    env: { ...process.env, OBPULSE_DEV_URL: 'http://127.0.0.1:5174' },
  });
  app.once('exit', () => shutdown());
} catch (e) {
  console.error(e);
  shutdown(1);
}
function shutdown(code = 0) {
  if (quitting) return;
  quitting = true;
  renderer.kill();
  app?.kill();
  process.exitCode = code;
}
process.on('SIGINT', () => shutdown());
process.on('SIGTERM', () => shutdown());
