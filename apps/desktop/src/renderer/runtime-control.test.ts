import { describe, expect, it } from 'vitest';
import type { RuntimeSnapshot } from '@obpulse/contracts';
import { runtimePrimaryAction } from './runtime-control';

const runtime = (overrides: Partial<RuntimeSnapshot>): RuntimeSnapshot => ({
  id: 'ollama',
  displayName: 'Ollama',
  state: 'stopped',
  controlAuthority: 'observer',
  manifest: {
    contractVersion: '1.0.0',
    adapterVersion: 'test',
    capabilities: {
      listInstalled: true,
      listLoaded: true,
      startServer: true,
      stopServer: true,
      takeControl: false,
      releaseControl: false,
      loadModel: true,
      unloadModel: true,
      benchmark: true,
    },
    permissions: {
      networkScope: 'loopback-only',
      serverControl: 'owned-process-only',
      credentialMode: 'none',
      externalProcessTermination: false,
      modelFileDeletion: false,
      inferenceContentAccess: false,
    },
  },
  installed: [],
  loaded: [],
  ownedProcess: null,
  latestBenchmark: null,
  error: null,
  observedAt: '2026-11-11T00:00:00.000Z',
  ...overrides,
});

describe('runtime control-center primary action', () => {
  it('offers only actions supported by state and capability', () => {
    expect(runtimePrimaryAction(runtime({}))).toBe('start');
    expect(
      runtimePrimaryAction(
        runtime({
          state: 'external-running',
          manifest: {
            ...runtime({}).manifest,
            capabilities: { ...runtime({}).manifest.capabilities, takeControl: true },
          },
        }),
      ),
    ).toBe('take-control');
    expect(runtimePrimaryAction(runtime({ state: 'managed-running' }))).toBe('stop');
  });

  it('prefers non-disruptive release over stopping a managed provider toggle', () => {
    expect(
      runtimePrimaryAction(
        runtime({
          state: 'managed-running',
          manifest: {
            ...runtime({}).manifest,
            capabilities: { ...runtime({}).manifest.capabilities, releaseControl: true },
          },
        }),
      ),
    ).toBe('release-control');
  });

  it('keeps observation-only runtimes actionless', () => {
    expect(
      runtimePrimaryAction(
        runtime({
          state: 'external-running',
          manifest: {
            ...runtime({}).manifest,
            capabilities: {
              ...runtime({}).manifest.capabilities,
              startServer: false,
              stopServer: false,
              takeControl: false,
            },
          },
        }),
      ),
    ).toBeNull();
    expect(runtimePrimaryAction(runtime({ error: 'read failed' }))).toBeNull();
  });
});
