import type { GpuSample, MetricHistorySample } from '@obpulse/contracts';

export function gpuKey(gpu: GpuSample): string {
  return `${gpu.source}:${gpu.index}`;
}

export function recentGpuDevices(
  current: readonly GpuSample[],
  history: readonly MetricHistorySample[],
): GpuSample[] {
  const devices = new Map<string, GpuSample>();
  for (const sample of history) {
    for (const gpu of sample.hostGpus) devices.set(gpuKey(gpu), gpu);
  }
  for (const gpu of current) devices.set(gpuKey(gpu), gpu);
  return [...devices.values()];
}
