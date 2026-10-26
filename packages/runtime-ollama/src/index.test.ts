import { describe, expect, it } from 'vitest';
import { OllamaRuntime } from './index';

describe('Ollama process ownership', () => {
  it('does not expose a PID before OB-Pulse starts the server', () => {
    expect(new OllamaRuntime().ownedProcessId()).toBeNull();
  });
});
