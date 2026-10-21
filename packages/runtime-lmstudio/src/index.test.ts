import { describe, expect, it, vi } from 'vitest';
import { LMStudioRuntime } from './index';

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

describe('LM Studio v1 runtime', () => {
  it('reports downloaded and loaded models without inventing residency metrics', async () => {
    const fetcher = vi.fn(async () => json(modelList));
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
      loadModel: true,
      unloadModel: true,
      benchmark: true,
    });
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

  it('keeps external server lifecycle outside OB-Pulse ownership', async () => {
    const runtime = new LMStudioRuntime(vi.fn());
    await expect(runtime.startServer()).rejects.toThrow('started outside OB-Pulse');
    await expect(runtime.stopServer()).rejects.toThrow('does not own');
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
