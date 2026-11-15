import { describe, expect, it, vi } from 'vitest';
import type { ProcessControlPort } from '@obpulse/process-control';
import { OllamaRuntime } from './index';

function processControl(): ProcessControlPort {
  const identity = { pid: 321, createdAt: 'now', executable: '/Applications/Ollama.app/ollama' };
  return {
    findListeningProcess: vi.fn(async () => identity),
    inspect: vi.fn(async () => identity),
    terminateTree: vi.fn(async () => undefined),
  };
}

describe('Ollama process ownership', () => {
  it('does not expose a PID before OB-Pulse starts the server', () => {
    const runtime = new OllamaRuntime(processControl());
    expect(runtime.ownedProcessId()).toBeNull();
    expect(runtime.controlAuthority()).toBe('observer');
    expect(runtime.manifest.capabilities.takeControl).toBe(true);
    expect(runtime.manifest.capabilities.releaseControl).toBe(true);
    expect(runtime.manifest).toMatchObject({
      contractVersion: '1.0.0',
      permissions: {
        networkScope: 'loopback-only',
        serverControl: 'explicit-process-takeover',
        credentialMode: 'none',
        externalProcessTermination: true,
        modelFileDeletion: false,
        inferenceContentAccess: false,
      },
    });
  });

  it('adopts only the unique Ollama listener and terminates it unless released', async () => {
    const control = processControl();
    const runtime = new OllamaRuntime(control);
    await runtime.takeControl();
    expect(runtime.ownedProcessId()).toBe(321);
    await runtime.stopServer();
    expect(control.terminateTree).toHaveBeenCalledWith(
      { pid: 321, createdAt: 'now', executable: '/Applications/Ollama.app/ollama' },
      /ollama\.app|(?:^|[\\/])ollama(?:\.exe)?(?:\s|$)|^ollama(?:\.exe)?$/i,
    );
    await expect(runtime.takeControl()).resolves.toBeUndefined();
    await runtime.releaseControl();
    expect(runtime.ownedProcessId()).toBeNull();
    expect(control.terminateTree).toHaveBeenCalledOnce();
  });
});
