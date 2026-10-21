import type { DashboardSnapshot, MetricHistoryWindow, RuntimeId } from '@obpulse/contracts';
export {};
declare global {
  interface Window {
    obpulse: {
      snapshot(): Promise<DashboardSnapshot>;
      history(): Promise<MetricHistoryWindow>;
      runtimes(): Promise<Array<{ id: RuntimeId; name: string }>>;
      selectRuntime(id: RuntimeId): Promise<void>;
      start(): Promise<void>;
      stop(): Promise<void>;
      load(modelId: string): Promise<void>;
      unload(modelId: string): Promise<void>;
      benchmark(modelId: string): Promise<unknown>;
      toggleAlwaysOnTop(): Promise<boolean>;
      isAlwaysOnTop(): Promise<boolean>;
      hide(): Promise<void>;
      setWindowMode(mode: 'compact' | 'expanded'): Promise<'compact' | 'expanded'>;
      getWindowMode(): Promise<'compact' | 'expanded'>;
    };
  }
}
