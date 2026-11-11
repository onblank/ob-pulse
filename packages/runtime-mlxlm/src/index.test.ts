import { describe, expect, it, vi } from 'vitest';
import { MlxLmRuntime } from './index';

type FetchStub = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;
const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });

describe('MLX-LM observer runtime', () => {
  it('detects the opt-in default endpoint and reports available models as not loaded', async () => {
    const fetcher = vi.fn<FetchStub>(async () =>
      json({ object: 'list', data: [{ id: 'mlx-community/Qwen-4bit', created: 1 }] }),
    );
    const runtime = new MlxLmRuntime(fetcher);

    await expect(runtime.state()).resolves.toBe('external-running');
    await expect(runtime.listInstalled()).resolves.toEqual([
      expect.objectContaining({ id: 'mlx-community/Qwen-4bit', loaded: false }),
    ]);
    await expect(runtime.listLoaded()).resolves.toEqual([]);
    expect(
      fetcher.mock.calls.every(
        ([input]) => String(input) === `${'http://127.0.0.1:8080'}/v1/models`,
      ),
    ).toBe(true);
  });

  it('stays stopped for absent or malformed services', async () => {
    const absent = new MlxLmRuntime(
      vi.fn<FetchStub>(async () => {
        throw new TypeError('failed');
      }),
    );
    const malformed = new MlxLmRuntime(vi.fn<FetchStub>(async () => json({ models: [] })));
    await expect(absent.state()).resolves.toBe('stopped');
    await expect(malformed.state()).resolves.toBe('stopped');
  });

  it('declares observation-only permissions and refuses controls', async () => {
    const runtime = new MlxLmRuntime();
    expect(runtime.manifest).toMatchObject({
      contractVersion: '1.0.0',
      capabilities: {
        listInstalled: true,
        listLoaded: false,
        startServer: false,
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
    expect(runtime.controlAuthority()).toBe('observer');
    expect(runtime.ownedProcessId()).toBeNull();
    await expect(runtime.startServer()).rejects.toThrow('observation-only');
    await expect(runtime.stopServer()).rejects.toThrow('observation-only');
    await expect(runtime.loadModel('model')).rejects.toThrow('observation-only');
    await expect(runtime.unloadModel('model')).rejects.toThrow('observation-only');
    await expect(runtime.benchmark('model')).rejects.toThrow('observation-only');
  });
});
