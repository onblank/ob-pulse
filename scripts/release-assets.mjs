import { createHash } from 'node:crypto';
import { copyFile, mkdir, readFile, readdir, stat, writeFile } from 'node:fs/promises';
import path from 'node:path';

const EXPECTED_EXTENSIONS = new Set(['.exe', '.dmg', '.appimage', '.deb']);
const MANIFEST_NAME = 'release-manifest.json';
const CHECKSUMS_NAME = 'SHA256SUMS';

function releaseVersion(tag) {
  const version = tag.startsWith('v') ? tag.slice(1) : tag;
  if (!/^\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?(?:\+[0-9A-Za-z.-]+)?$/.test(version)) {
    throw new Error(`Invalid release tag: ${tag}`);
  }
  return version;
}

function safeFileName(name) {
  return name.length > 0 && name !== '.' && name !== '..' && !/[\\/\r\n\0]/.test(name);
}

async function listFilesRecursively(directory) {
  const files = [];
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const entryPath = path.join(directory, entry.name);
    if (entry.isDirectory()) files.push(...(await listFilesRecursively(entryPath)));
    else if (entry.isFile()) files.push(entryPath);
    else throw new Error(`Unsupported release artifact entry: ${entryPath}`);
  }
  return files;
}

async function sha256(filePath) {
  return createHash('sha256')
    .update(await readFile(filePath))
    .digest('hex');
}

function assertExpectedArtifacts(artifacts, version) {
  const byExtension = new Map();
  for (const artifact of artifacts) {
    const extension = path.extname(artifact.name).toLowerCase();
    if (!EXPECTED_EXTENSIONS.has(extension))
      throw new Error(`Unexpected release artifact extension: ${artifact.name}`);
    if (byExtension.has(extension))
      throw new Error(`Duplicate release artifact type: ${extension}`);
    if (!artifact.name.includes(`-${version}-`))
      throw new Error(`Artifact version does not match release tag: ${artifact.name}`);
    byExtension.set(extension, artifact);
  }
  const missing = [...EXPECTED_EXTENSIONS].filter((extension) => !byExtension.has(extension));
  if (missing.length > 0) throw new Error(`Missing release artifact types: ${missing.join(', ')}`);
}

export async function collectReleaseAssets({
  sourceDirectory,
  destinationDirectory,
  releaseTag,
  sourceCommit,
  workflowRunUrl,
}) {
  const version = releaseVersion(releaseTag);
  if (!/^[a-f0-9]{40}$/i.test(sourceCommit))
    throw new Error('Source commit must be a full Git SHA');
  if (!workflowRunUrl.startsWith('https://github.com/'))
    throw new Error('Workflow run URL must point to GitHub Actions');

  const existing = await readdir(destinationDirectory).catch((error) => {
    if (error.code === 'ENOENT') return [];
    throw error;
  });
  if (existing.length > 0) throw new Error('Release asset destination must be empty');
  await mkdir(destinationDirectory, { recursive: true });

  const sourceFiles = await listFilesRecursively(sourceDirectory);
  const candidates = sourceFiles.filter((filePath) =>
    EXPECTED_EXTENSIONS.has(path.extname(filePath).toLowerCase()),
  );
  const names = candidates.map((filePath) => path.basename(filePath));
  if (new Set(names).size !== names.length) throw new Error('Duplicate release artifact filenames');
  const artifacts = candidates.map((filePath) => ({ name: path.basename(filePath), filePath }));
  assertExpectedArtifacts(artifacts, version);

  for (const artifact of artifacts) {
    if (!safeFileName(artifact.name)) throw new Error(`Unsafe artifact filename: ${artifact.name}`);
    await copyFile(artifact.filePath, path.join(destinationDirectory, artifact.name));
  }

  const manifestArtifacts = [];
  for (const artifact of artifacts.sort((left, right) => left.name.localeCompare(right.name))) {
    const destinationPath = path.join(destinationDirectory, artifact.name);
    manifestArtifacts.push({
      name: artifact.name,
      sizeBytes: (await stat(destinationPath)).size,
      sha256: await sha256(destinationPath),
    });
  }

  const manifest = {
    schemaVersion: 1,
    product: 'OB-Pulse',
    version,
    sourceCommit: sourceCommit.toLowerCase(),
    workflowRunUrl,
    artifacts: manifestArtifacts,
  };
  await writeFile(
    path.join(destinationDirectory, MANIFEST_NAME),
    `${JSON.stringify(manifest, null, 2)}\n`,
    'utf8',
  );

  const checksummedNames = [
    ...manifestArtifacts.map((artifact) => artifact.name),
    MANIFEST_NAME,
  ].sort((left, right) => left.localeCompare(right));
  const checksumLines = [];
  for (const name of checksummedNames) {
    checksumLines.push(`${await sha256(path.join(destinationDirectory, name))}  ${name}`);
  }
  await writeFile(
    path.join(destinationDirectory, CHECKSUMS_NAME),
    `${checksumLines.join('\n')}\n`,
    'utf8',
  );
  await verifyReleaseAssets({ directory: destinationDirectory, expectedTag: releaseTag });
  return manifest;
}

export async function verifyReleaseAssets({ directory, expectedTag }) {
  const version = releaseVersion(expectedTag);
  const manifestPath = path.join(directory, MANIFEST_NAME);
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (
    manifest.schemaVersion !== 1 ||
    manifest.product !== 'OB-Pulse' ||
    manifest.version !== version ||
    !/^[a-f0-9]{40}$/.test(manifest.sourceCommit) ||
    typeof manifest.workflowRunUrl !== 'string' ||
    !manifest.workflowRunUrl.startsWith('https://github.com/') ||
    !Array.isArray(manifest.artifacts)
  ) {
    throw new Error('Release manifest metadata is invalid');
  }
  assertExpectedArtifacts(manifest.artifacts, version);

  const expectedNames = new Set([MANIFEST_NAME]);
  for (const artifact of manifest.artifacts) {
    if (!safeFileName(artifact.name) || expectedNames.has(artifact.name))
      throw new Error(`Unsafe or duplicate manifest filename: ${artifact.name}`);
    expectedNames.add(artifact.name);
    const artifactPath = path.join(directory, artifact.name);
    const metadata = await stat(artifactPath);
    if (metadata.size !== artifact.sizeBytes)
      throw new Error(`Artifact size mismatch: ${artifact.name}`);
    if ((await sha256(artifactPath)) !== artifact.sha256)
      throw new Error(`Artifact digest mismatch: ${artifact.name}`);
  }

  const checksumText = await readFile(path.join(directory, CHECKSUMS_NAME), 'utf8');
  const checksumEntries = new Map();
  for (const line of checksumText.trimEnd().split('\n')) {
    const match = /^([a-f0-9]{64}) {2}([^\\/\r\n]+)$/i.exec(line);
    if (!match || checksumEntries.has(match[2])) throw new Error('SHA256SUMS format is invalid');
    checksumEntries.set(match[2], match[1].toLowerCase());
  }
  const expectedChecksumNames = new Set([...expectedNames, CHECKSUMS_NAME]);
  if (
    checksumEntries.size !== expectedNames.size ||
    [...expectedNames].some((name) => !checksumEntries.has(name))
  ) {
    throw new Error('SHA256SUMS entries do not match the release files');
  }
  for (const name of expectedNames) {
    if ((await sha256(path.join(directory, name))) !== checksumEntries.get(name))
      throw new Error(`SHA256SUMS digest mismatch: ${name}`);
  }

  const actualEntries = await readdir(directory, { withFileTypes: true });
  const actualFiles = new Set(
    actualEntries.filter((entry) => entry.isFile()).map((entry) => entry.name),
  );
  if (
    actualEntries.some((entry) => !entry.isFile()) ||
    actualFiles.size !== expectedChecksumNames.size ||
    [...expectedChecksumNames].some((name) => !actualFiles.has(name))
  ) {
    throw new Error('Release directory contains missing or unexpected files');
  }
  return manifest;
}

async function main() {
  const [command, ...args] = process.argv.slice(2);
  if (command === 'collect') {
    const [sourceDirectory, destinationDirectory, releaseTag, sourceCommit, workflowRunUrl] = args;
    if (
      !sourceDirectory ||
      !destinationDirectory ||
      !releaseTag ||
      !sourceCommit ||
      !workflowRunUrl
    ) {
      throw new Error(
        'Usage: node scripts/release-assets.mjs collect <source> <destination> <tag> <commit> <workflow-run-url>',
      );
    }
    const manifest = await collectReleaseAssets({
      sourceDirectory,
      destinationDirectory,
      releaseTag,
      sourceCommit,
      workflowRunUrl,
    });
    console.log(`Prepared ${manifest.artifacts.length} release assets for ${manifest.version}`);
    return;
  }
  if (command === 'verify') {
    const [directory, releaseTag] = args;
    if (!directory || !releaseTag)
      throw new Error('Usage: node scripts/release-assets.mjs verify <directory> <tag>');
    const manifest = await verifyReleaseAssets({ directory, expectedTag: releaseTag });
    console.log(`Verified checksums and manifest for OB-Pulse ${manifest.version}`);
    return;
  }
  throw new Error('Expected command: collect or verify');
}

if (import.meta.url === `file://${process.argv[1]}`) {
  main().catch((error) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  });
}
