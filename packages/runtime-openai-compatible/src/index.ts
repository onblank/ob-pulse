import type { ModelRecord } from '@obpulse/contracts';

type RecordObject = Record<string, unknown>;

function object(value: unknown): value is RecordObject {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function modelId(value: unknown): string | null {
  if (typeof value !== 'string') return null;
  if (
    value.length === 0 ||
    value.length > 240 ||
    value.trim() !== value ||
    Array.from(value).some((character) => character.charCodeAt(0) <= 0x1f)
  )
    return null;
  return value;
}

export function parseOpenAiModelList(
  value: unknown,
  options: { readonly loaded: boolean; readonly providerName: string },
): ModelRecord[] {
  if (!object(value) || !Array.isArray(value.data))
    throw new Error(`Malformed ${options.providerName} models response`);
  return value.data.flatMap((entry: unknown) => {
    if (!object(entry)) return [];
    const id = modelId(entry.id);
    if (!id) return [];
    return [
      {
        id,
        displayName: id,
        loaded: options.loaded,
        sizeBytes: null,
        gpuResidentBytes: null,
        contextCapacityTokens: null,
      },
    ];
  });
}
