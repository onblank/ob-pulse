import { execFile } from 'node:child_process';
import { access, mkdir, readdir, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { promisify } from 'node:util';

const execFileAsync = promisify(execFile);
const [baselineArgument, currentArgument] = process.argv.slice(2);
if (!baselineArgument || !currentArgument) {
  throw new Error('Usage: node scripts/native-package-smoke.mjs <baseline-dir> <current-dir>');
}
const baselineDir = path.resolve(baselineArgument);
const currentDir = path.resolve(currentArgument);
// Keep the ordinary DOS path from os.tmpdir(); fs.mkdir may return a Windows \\?\ extended
// path, which NSIS and child processes treat as an unsupported current directory.
const workDir = path.join(os.tmpdir(), 'obpulse-native-smoke');

async function files(directory, suffix) {
  return (await readdir(directory)).filter((name) =>
    name.toLowerCase().endsWith(suffix.toLowerCase()),
  );
}

async function run(command, args, options = {}) {
  try {
    const result = await execFileAsync(command, args, {
      timeout: options.timeout ?? 180_000,
      maxBuffer: 8 * 1024 * 1024,
      windowsHide: true,
      ...options,
    });
    if (result.stdout) process.stdout.write(result.stdout);
    if (result.stderr) process.stderr.write(result.stderr);
    return result;
  } catch (error) {
    if (error.stdout) process.stdout.write(error.stdout);
    if (error.stderr) process.stderr.write(error.stderr);
    throw error;
  }
}

async function launch(executable, mode) {
  await access(executable);
  const args = [`--obpulse-package-smoke=${mode}`];
  if (process.platform === 'linux' && executable.endsWith('.AppImage')) {
    args.unshift('--appimage-extract-and-run');
  }
  if (process.platform === 'linux') {
    await run('xvfb-run', ['-a', executable, ...args], { timeout: 120_000 });
    return;
  }
  await run(executable, args, { timeout: 120_000 });
}

async function smokeWindows() {
  const baseline = (await files(baselineDir, '.exe')).find((name) => name.includes('win-x64'));
  const current = (await files(currentDir, '.exe')).find((name) => name.includes('win-x64'));
  if (!baseline || !current) throw new Error('Expected Windows x64 NSIS installers');
  const installDir = path.join(workDir, 'windows-install');
  const executable = path.join(installDir, 'OB-Pulse.exe');
  const install = (installer) => run(installer, ['/S', `/D=${installDir}`], { timeout: 180_000 });
  await install(path.join(baselineDir, baseline));
  await launch(executable, 'baseline');
  await install(path.join(currentDir, current));
  await launch(executable, 'upgrade');
}

async function mountDmg(dmg, destination) {
  await mkdir(destination, { recursive: true });
  await run('hdiutil', ['attach', dmg, '-nobrowse', '-quiet', '-mountpoint', destination]);
  try {
    const entries = await readdir(destination, { withFileTypes: true });
    const app = entries.find((entry) => entry.isDirectory() && entry.name.endsWith('.app'));
    if (!app) throw new Error(`No app bundle found in ${dmg}`);
    const destinationApp = path.join(workDir, 'OB-Pulse.app');
    await rm(destinationApp, { recursive: true, force: true });
    await run('ditto', [path.join(destination, app.name), destinationApp]);
    return path.join(destinationApp, 'Contents', 'MacOS', 'OB-Pulse');
  } finally {
    await run('hdiutil', ['detach', destination, '-quiet']);
  }
}

async function smokeMac() {
  const baseline = (await files(baselineDir, '.dmg')).find((name) =>
    name.includes('mac-universal'),
  );
  const current = (await files(currentDir, '.dmg')).find((name) => name.includes('mac-universal'));
  if (!baseline || !current) throw new Error('Expected universal macOS DMG artifacts');
  const baselineApp = await mountDmg(
    path.join(baselineDir, baseline),
    path.join(workDir, 'mount-baseline'),
  );
  await launch(baselineApp, 'baseline');
  const currentApp = await mountDmg(
    path.join(currentDir, current),
    path.join(workDir, 'mount-current'),
  );
  await launch(currentApp, 'upgrade');
}

async function installDeb(deb) {
  await run('sudo', ['apt-get', 'install', '-y', deb], { timeout: 180_000 });
  const { stdout } = await run('dpkg-deb', ['-f', deb, 'Package']);
  const packageName = stdout.trim();
  const { stdout: listing } = await run('dpkg-query', ['-L', packageName]);
  const executable = listing
    .split(/\r?\n/)
    .find((entry) => entry === '/usr/bin/ob-pulse' || entry === '/opt/OB-Pulse/ob-pulse');
  if (!executable) throw new Error(`Could not locate installed app executable for ${packageName}`);
  return executable;
}

async function smokeLinux() {
  const baselineDeb = (await files(baselineDir, '.deb'))[0];
  const currentDeb = (await files(currentDir, '.deb'))[0];
  const baselineImage = (await files(baselineDir, '.AppImage'))[0];
  const currentImage = (await files(currentDir, '.AppImage'))[0];
  if (!baselineDeb || !currentDeb || !baselineImage || !currentImage)
    throw new Error('Expected Linux x64 DEB and AppImage artifacts');
  const baselineAppImage = path.join(baselineDir, baselineImage);
  const currentAppImage = path.join(currentDir, currentImage);
  await run('chmod', ['+x', baselineAppImage, currentAppImage]);
  await launch(baselineAppImage, 'baseline');
  await launch(currentAppImage, 'upgrade');
  const executable = await installDeb(path.join(baselineDir, baselineDeb));
  await launch(executable, 'baseline');
  await installDeb(path.join(currentDir, currentDeb));
  await launch(executable, 'upgrade');
}

await rm(workDir, { recursive: true, force: true });
await mkdir(workDir, { recursive: true });
if (process.platform === 'win32') await smokeWindows();
else if (process.platform === 'darwin') await smokeMac();
else if (process.platform === 'linux') await smokeLinux();
else throw new Error(`Unsupported smoke platform: ${process.platform}`);
console.log(`Native install/upgrade and app lifecycle smoke passed on ${process.platform}`);
