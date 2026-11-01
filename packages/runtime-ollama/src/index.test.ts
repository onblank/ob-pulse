import { describe, expect, it } from 'vitest';
import { OllamaRuntime } from './index';

describe('Ollama process ownership', () => {
  it('does not expose a PID before OB-Pulse starts the server', () => {
    const runtime = new OllamaRuntime();
    expect(runtime.ownedProcessId()).toBeNull();
    expect(runtime.controlAuthority()).toBe('observer');
    expect(runtime.capabilities.takeControl).toBe(false);
  });

  it('refuses unsafe takeover of an external server', async () => {
    await expect(new OllamaRuntime().takeControl()).rejects.toThrow('safely');
  });
});
