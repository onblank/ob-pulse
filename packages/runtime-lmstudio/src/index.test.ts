import { describe, expect, it, vi } from 'vitest';
import {
  LmsCliLifecycle,
  LMStudioRuntime,
  type LMStudioLifecycle,
  parseServerStatus,
  resolveLmsBinary,
} from './index';

type FetchStub = (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

const modelList = {
  models: [
    {
      key: 'google/gemma-4-26b-a4b',
      display_name: 'Gemma 4 26B A4B',
      size_bytes: 17_990_911_801,
      max_context_length: 262_144,
      loaded_instances: [
        {
          id: 'gemma-primary',
          config: { context_length: 16_384 },
        },
      ],
    },
    {
      key: 'deepseek-r1',
      display_name: 'DeepSeek R1',
      size_bytes: 40_492_610_355,
      max_context_length: 131_072,
      loaded_instances: [],
    },
  ],
};

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { 'content-type': 'application/json' },
  });

function lifecycleHarness(
  options: {
    serverRunning?: boolean;
  } = {},
) {
  let serverRunning = options.serverRunning ?? false;
  const fetcher = vi.fn<FetchStub>(async () => {
    if (!serverRunning) throw new TypeError('fetch failed');
    return json(modelList);
  });
  const lifecycle: LMStudioLifecycle = {
    serverRunning: vi.fn(async () => serverRunning),
    startServer: vi.fn(async () => {
      serverRunning = true;
    }),
    stopServer: vi.fn(async () => {
      serverRunning = false;
    }),
  };
  return { fetcher, lifecycle };
}

describe('LM Studio v1 runtime', () => {
  it('parses strict server status after trusted CLI progress output', () => {
    expect(parseServerStatus('Waking up LM Studio service...\n{"running":true,"port":1234}')).toBe(
      true,
    );
    expect(parseServerStatus('{"running":false}')).toBe(false);
    expect(() => parseServerStatus('{"running":"yes"}')).toThrow(
      'Malformed LM Studio server status',
    );
  });

  it('resolves only the expected machine-local CLI path', () => {
    expect(resolveLmsBinary('/Users/test', 'darwin', () => true)).toBe(
      '/Users/test/.lmstudio/bin/lms',
    );
    expect(resolveLmsBinary('C:\\Users\\test', 'win32', () => true)).toContain(
      '.lmstudio/bin/lms.exe',
    );
    expect(() => resolveLmsBinary('/Users/test', 'darwin', () => false)).toThrow(
      'LM Studio CLI was not found',
    );
  });

  it('uses fixed non-interactive lifecycle commands', async () => {
    const execute = vi.fn(async (_executable: string, args: readonly string[]) => ({
      stdout: args[1] === 'status' ? '{"running":false}' : '',
    }));
    const lifecycle = new LmsCliLifecycle(() => '/fixed/lms', execute);

    await lifecycle.serverRunning();
    await lifecycle.startServer();
    await lifecycle.stopServer();

    expect(execute.mock.calls.map((call) => call.slice(0, 2))).toEqual([
      ['/fixed/lms', ['server', 'status', '--json']],
      ['/fixed/lms', ['server', 'start', '--port', '1234', '--bind', '127.0.0.1']],
      ['/fixed/lms', ['server', 'stop']],
    ]);
  });

  it('reports downloaded and loaded models without inventing residency metrics', async () => {
    const fetcher = vi.fn<FetchStub>(async () => json(modelList));
    const runtime = new LMStudioRuntime(fetcher);

    await expect(runtime.state()).resolves.toBe('external-running');
    await expect(runtime.listInstalled()).resolves.toEqual([
      {
        id: 'google/gemma-4-26b-a4b',
        displayName: 'Gemma 4 26B A4B',
        loaded: true,
        sizeBytes: 17_990_911_801,
        gpuResidentBytes: null,
        contextCapacityTokens: 16_384,
      },
      {
        id: 'deepseek-r1',
        displayName: 'DeepSeek R1',
        loaded: false,
        sizeBytes: 40_492_610_355,
        gpuResidentBytes: null,
        contextCapacityTokens: null,
      },
    ]);
    expect(runtime.capabilities).toMatchObject({
      takeControl: true,
      releaseControl: true,
      loadModel: true,
      unloadModel: true,
      benchmark: true,
    });
  });

  it('adds a configured bearer token to every request without exposing it as state', async () => {
    const fetcher = vi.fn<FetchStub>(async () => json(modelList));
    const runtime = new LMStudioRuntime(fetcher);
    runtime.setApiToken('lms-secret-token');

    await runtime.listInstalled();

    const headers = new Headers(fetcher.mock.calls[0]?.[1]?.headers);
    expect(headers.get('authorization')).toBe('Bearer lms-secret-token');
    expect(runtime.hasApiToken()).toBe(true);
    runtime.setApiToken(null);
    expect(runtime.hasApiToken()).toBe(false);
  });

  it('reports a rejected configured token without including the credential', async () => {
    const runtime = new LMStudioRuntime(vi.fn<FetchStub>(async () => json({}, 401)));
    runtime.setApiToken('lms-secret-token');

    await expect(runtime.listInstalled()).rejects.toThrow('configured token was rejected');
    await expect(runtime.listInstalled()).rejects.not.toThrow('lms-secret-token');
  });

  it('loads a selected model through the native v1 endpoint', async () => {
    const fetcher = vi.fn<FetchStub>(async () =>
      json({
        type: 'llm',
        instance_id: 'deepseek-r1',
        status: 'loaded',
        load_time_seconds: 3.2,
      }),
    );
    const runtime = new LMStudioRuntime(fetcher);

    await runtime.loadModel('deepseek-r1');

    expect(fetcher).toHaveBeenCalledOnce();
    expect(fetcher.mock.calls[0]?.[0]).toBe('http://127.0.0.1:1234/api/v1/models/load');
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({ model: 'deepseek-r1' });
  });

  it('resolves and unloads the unique loaded instance for a model', async () => {
    const fetcher = vi
      .fn<FetchStub>(async () => json({}))
      .mockResolvedValueOnce(json(modelList))
      .mockResolvedValueOnce(json({ instance_id: 'gemma-primary' }));
    const runtime = new LMStudioRuntime(fetcher);

    await runtime.unloadModel('google/gemma-4-26b-a4b');

    expect(fetcher.mock.calls[1]?.[0]).toBe('http://127.0.0.1:1234/api/v1/models/unload');
    expect(JSON.parse(String(fetcher.mock.calls[1]?.[1]?.body))).toEqual({
      instance_id: 'gemma-primary',
    });
  });

  it('refuses ambiguous multi-instance unloads', async () => {
    const fetcher = vi.fn(async () =>
      json({
        models: [
          {
            key: 'model-a',
            loaded_instances: [{ id: 'instance-a' }, { id: 'instance-b' }],
          },
        ],
      }),
    );
    const runtime = new LMStudioRuntime(fetcher);

    await expect(runtime.unloadModel('model-a')).rejects.toThrow('multiple loaded instances');
    expect(fetcher).toHaveBeenCalledOnce();
  });

  it('starts and stops only the loopback server it enabled', async () => {
    const harness = lifecycleHarness();
    const runtime = new LMStudioRuntime(harness.fetcher, harness.lifecycle);

    await expect(runtime.state()).resolves.toBe('stopped');
    await runtime.startServer();

    expect(harness.lifecycle.startServer).toHaveBeenCalledOnce();
    await expect(runtime.state()).resolves.toBe('managed-running');
    expect(runtime.controlAuthority()).toBe('session-managed');
    expect(runtime.ownedProcessId()).toBeNull();
    expect(runtime.capabilities).toMatchObject({ startServer: true, stopServer: true });

    await runtime.stopServer();

    expect(harness.lifecycle.stopServer).toHaveBeenCalledOnce();
    expect(runtime.ownedProcessId()).toBeNull();
    await expect(runtime.state()).resolves.toBe('stopped');
  });

  it('takes explicit session control of an existing server before stopping it', async () => {
    const harness = lifecycleHarness({ serverRunning: true });
    const runtime = new LMStudioRuntime(harness.fetcher, harness.lifecycle);

    await runtime.startServer();

    await expect(runtime.state()).resolves.toBe('external-running');
    expect(runtime.controlAuthority()).toBe('observer');
    expect(harness.lifecycle.startServer).not.toHaveBeenCalled();
    await expect(runtime.stopServer()).rejects.toThrow('has not been delegated');

    await runtime.takeControl();

    expect(runtime.controlAuthority()).toBe('delegated');
    await expect(runtime.state()).resolves.toBe('managed-running');
    await runtime.stopServer();
    expect(harness.lifecycle.stopServer).toHaveBeenCalledOnce();
    expect(runtime.controlAuthority()).toBe('observer');
  });

  it('releases delegated control on quit without stopping an external server', async () => {
    const harness = lifecycleHarness({ serverRunning: true });
    const runtime = new LMStudioRuntime(harness.fetcher, harness.lifecycle);

    await runtime.takeControl();
    await runtime.shutdownOwned();

    expect(harness.lifecycle.stopServer).not.toHaveBeenCalled();
    expect(runtime.controlAuthority()).toBe('observer');
    await expect(runtime.state()).resolves.toBe('external-running');
  });

  it('releases session control without stopping the LM Studio server', async () => {
    const harness = lifecycleHarness();
    const runtime = new LMStudioRuntime(harness.fetcher, harness.lifecycle);

    await runtime.startServer();
    await runtime.releaseControl();

    expect(harness.lifecycle.stopServer).not.toHaveBeenCalled();
    expect(runtime.controlAuthority()).toBe('observer');
    await expect(runtime.state()).resolves.toBe('external-running');
    await expect(runtime.stopServer()).rejects.toThrow('has not been delegated');
    await runtime.shutdownOwned();
    expect(harness.lifecycle.stopServer).not.toHaveBeenCalled();
  });

  it('runs a non-persistent benchmark and keeps only provider-reported metrics', async () => {
    const fetcher = vi.fn<FetchStub>(async () =>
      json({
        model_instance_id: 'gemma-primary',
        output: [{ type: 'message', content: 'discarded immediately' }],
        stats: {
          input_tokens: 18,
          total_output_tokens: 24,
          reasoning_output_tokens: 0,
          tokens_per_second: 32.5,
          time_to_first_token_seconds: 0.125,
        },
      }),
    );
    const runtime = new LMStudioRuntime(fetcher);

    await expect(runtime.benchmark('google/gemma-4-26b-a4b')).resolves.toMatchObject({
      source: 'benchmark',
      modelId: 'google/gemma-4-26b-a4b',
      promptTokens: 18,
      outputTokens: 24,
      readTokensPerSecond: null,
      writeTokensPerSecond: 32.5,
      timeToFirstTokenMs: 125,
    });
    const init = fetcher.mock.calls[0]?.[1];
    expect(init?.method).toBe('POST');
    expect(JSON.parse(String(init?.body))).toEqual({
      model: 'google/gemma-4-26b-a4b',
      input: 'Write a short greeting in one sentence.',
      temperature: 0,
      max_output_tokens: 48,
      stream: false,
      store: false,
    });
  });
});
