import type { RuntimeSnapshot } from '@obpulse/contracts';

export type RuntimePrimaryAction = 'start' | 'stop' | 'take-control' | 'release-control';

export function runtimePrimaryAction(runtime: RuntimeSnapshot): RuntimePrimaryAction | null {
  if (runtime.error) return null;
  const capabilities = runtime.manifest.capabilities;
  if (runtime.state === 'stopped') return capabilities.startServer ? 'start' : null;
  if (runtime.state === 'external-running') return capabilities.takeControl ? 'take-control' : null;
  if (capabilities.releaseControl) return 'release-control';
  return capabilities.stopServer ? 'stop' : null;
}

export function runtimeActionLabel(action: RuntimePrimaryAction): string {
  switch (action) {
    case 'start':
      return 'Start';
    case 'stop':
      return 'Stop';
    case 'take-control':
      return 'Take control';
    case 'release-control':
      return 'Release';
  }
}
