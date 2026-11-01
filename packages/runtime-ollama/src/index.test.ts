import { describe, expect, it } from 'vitest';
import { OllamaRuntime } from './index';

describe('Ollama process ownership', () => {
  it('does not expose a PID before OB-Pulse starts the server', () => {
    const runtime = new OllamaRuntime();
    expect(runtime.ownedProcessId()).toBeNull();
    expect(runtime.controlAuthority()).toBe('observer');
    expect(runtime.manifest.capabilities.takeControl).toBe(false);
    expect(runtime.manifest.capabilities.releaseControl).toBe(false);
    expect(runtime.manifest).toMatchObject({
      contractVersion: '1.0.0',
      permissions: {
        networkScope: 'loopback-only',
        serverControl: 'owned-process-only',
        credentialMode: 'none',
        externalProcessTermination: false,
        modelFileDeletion: false,
        inferenceContentAccess: false,
      },
    });
  });

  it('refuses unsafe takeover of an external server', async () => {
    const runtime = new OllamaRuntime();
    await expect(runtime.takeControl()).rejects.toThrow('safely');
    await expect(runtime.releaseControl()).rejects.toThrow('safely');
  });
});
