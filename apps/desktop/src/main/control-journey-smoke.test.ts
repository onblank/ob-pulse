import { describe, expect, it } from 'vitest';
import { createControlJourneyRuntimes } from './control-journey-smoke';

const runtimes = () =>
  new Map(createControlJourneyRuntimes().map((runtime) => [runtime.id, runtime]));

describe('native control journey fixtures', () => {
  it('models an external takeover, release and explicit stop lifecycle', async () => {
    const ollama = runtimes().get('ollama')!;
    expect(await ollama.state()).toBe('external-running');
    expect(ollama.controlAuthority()).toBe('observer');

    await ollama.takeControl();
    expect(await ollama.state()).toBe('managed-running');
    expect(ollama.controlAuthority()).toBe('process-owned');

    await ollama.releaseControl();
    expect(await ollama.state()).toBe('external-running');
    expect(ollama.controlAuthority()).toBe('observer');

    await ollama.takeControl();
    await ollama.stopServer();
    expect(await ollama.state()).toBe('stopped');
  });

  it('models start, load, unload and stop without removing installed model data', async () => {
    const lmstudio = runtimes().get('lmstudio')!;
    expect(await lmstudio.listInstalled()).toHaveLength(1);
    expect(await lmstudio.listLoaded()).toHaveLength(0);

    await lmstudio.startServer();
    await lmstudio.loadModel('obpulse-smoke-model');
    expect(await lmstudio.listLoaded()).toHaveLength(1);
    await lmstudio.unloadModel('obpulse-smoke-model');
    expect(await lmstudio.listLoaded()).toHaveLength(0);
    await lmstudio.stopServer();
    expect(await lmstudio.listInstalled()).toHaveLength(1);
  });

  it('keeps observer fixtures unable to start, stop, adopt or manage models', async () => {
    const llamaCpp = runtimes().get('llamacpp')!;
    expect(llamaCpp.manifest.permissions.serverControl).toBe('none');
    await expect(llamaCpp.startServer()).rejects.toThrow('does not grant control');
    await expect(llamaCpp.takeControl()).rejects.toThrow('does not grant control');
    await expect(llamaCpp.loadModel('obpulse-smoke-model')).rejects.toThrow(
      'does not grant control',
    );
  });
});
