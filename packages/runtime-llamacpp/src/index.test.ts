import { describe, expect, it, vi } from 'vitest';
import { isLlamaCppHealth, LlamaCppRuntime, parseLlamaCppModels } from './index';

type FetchStub = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

describe('llama.cpp observer runtime', () => {
  it('parses only valid loaded model identifiers without inventing metrics', () => {
    expect(
      parseLlamaCppModels({
        data: [{ id: 'ggml-org/gemma-3-4b-it-GGUF:Q4_K_M' }, { id: '' }, null],
      }),
    ).toEqual([
      {
        id: 'ggml-org/gemma-3-4b-it-GGUF:Q4_K_M',
        displayName: 'ggml-org/gemma-3-4b-it-GGUF:Q4_K_M',
        loaded: true,
        sizeBytes: null,
        gpuResidentBytes: null,
        contextCapacityTokens: null,
      },
    ]);
    expect(() => parseLlamaCppModels({ models: [] })).toThrow(
      'Malformed llama.cpp models response',
    );
  });

  it('recognizes only the documented ready and loading health responses', () => {
    expect(isLlamaCppHealth(200, { status: 'ok' })).toBe(true);
    expect(isLlamaCppHealth(503, { error: { code: 503, message: 'Loading model' } })).toBe(true);
    expect(isLlamaCppHealth(200, { status: 'another local service' })).toBe(false);
    expect(isLlamaCppHealth(503, {})).toBe(false);
  });

  it('detects the official loopback server and lists its loaded model', async () => {
    const fetcher = vi.fn<FetchStub>(async (input) =>
      String(input).endsWith('/health')
        ? json({ status: 'ok' })
        : json({ data: [{ id: 'model.gguf' }] }),
    );
    const runtime = new LlamaCppRuntime(fetcher);

    await expect(runtime.state()).resolves.toBe('external-running');
    await expect(runtime.listInstalled()).resolves.toEqual([]);
    await expect(runtime.listLoaded()).resolves.toEqual([
      expect.objectContaining({ id: 'model.gguf', loaded: true }),
    ]);
    expect(fetcher.mock.calls.map(([input]) => String(input))).toEqual([
      'http://127.0.0.1:9931/health',
      'http://127.0.0.1:9931/v1/models',
    ]);
  });

  it('treats loading health as reachable and network failure as stopped', async () => {
    const loading = new LlamaCppRuntime(
      vi.fn<FetchStub>(async () => json({ error: { code: 503 } }, 503)),
    );
    const absent = new LlamaCppRuntime(
      vi.fn<FetchStub>(async () => {
        throw new TypeError('fetch failed');
      }),
    );

    await expect(loading.state()).resolves.toBe('external-running');
    await expect(absent.state()).resolves.toBe('stopped');
  });

  it('declares observation-only permissions and refuses every control operation', async () => {
    const runtime = new LlamaCppRuntime();

    expect(runtime.controlAuthority()).toBe('observer');
    expect(runtime.ownedProcessId()).toBeNull();
    expect(runtime.manifest).toMatchObject({
      contractVersion: '1.0.0',
      capabilities: {
        listInstalled: false,
        listLoaded: true,
        startServer: false,
        stopServer: false,
        takeControl: false,
        releaseControl: false,
        loadModel: false,
        unloadModel: false,
        benchmark: false,
      },
      permissions: {
        networkScope: 'loopback-only',
        serverControl: 'none',
        credentialMode: 'none',
        externalProcessTermination: false,
        modelFileDeletion: false,
        inferenceContentAccess: false,
      },
    });
    await expect(runtime.startServer()).rejects.toThrow('observation-only');
    await expect(runtime.stopServer()).rejects.toThrow('observation-only');
    await expect(runtime.takeControl()).rejects.toThrow('observation-only');
    await expect(runtime.releaseControl()).rejects.toThrow('observation-only');
    await expect(runtime.loadModel('model.gguf')).rejects.toThrow('observation-only');
    await expect(runtime.unloadModel('model.gguf')).rejects.toThrow('observation-only');
    await expect(runtime.benchmark('model.gguf')).rejects.toThrow('observation-only');
  });
});
