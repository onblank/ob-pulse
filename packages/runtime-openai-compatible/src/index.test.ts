import { describe, expect, it } from 'vitest';
import { parseOpenAiModelList } from './index';

describe('OpenAI-compatible model list parser', () => {
  it('keeps valid identifiers and preserves provider-assigned load semantics', () => {
    expect(
      parseOpenAiModelList(
        { data: [{ id: 'model-a' }, { id: ' invalid ' }, null] },
        {
          loaded: false,
          providerName: 'test',
        },
      ),
    ).toEqual([
      {
        id: 'model-a',
        displayName: 'model-a',
        loaded: false,
        sizeBytes: null,
        gpuResidentBytes: null,
        contextCapacityTokens: null,
      },
    ]);
  });

  it('rejects a malformed root payload', () => {
    expect(() =>
      parseOpenAiModelList({ models: [] }, { loaded: true, providerName: 'test' }),
    ).toThrow('Malformed test models response');
  });
});
