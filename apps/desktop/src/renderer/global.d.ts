import type {
  DashboardSnapshot,
  InstrumentationBridgeStatus,
  InstrumentationSnapshot,
  MetricHistoryWindow,
  RuntimeCatalogEntry,
  RuntimeId,
  RuntimePreferences,
  WidgetPreferences,
} from '@obpulse/contracts';
export {};
declare global {
  interface Window {
    obpulse: {
      snapshot(): Promise<DashboardSnapshot>;
      history(): Promise<MetricHistoryWindow>;
      runtimes(): Promise<Array<{ id: RuntimeId; name: string }>>;
      runtimeCatalog(): Promise<RuntimeCatalogEntry[]>;
      runtimePreferences(): Promise<RuntimePreferences>;
      setRuntimePreferences(preferences: RuntimePreferences): Promise<RuntimePreferences>;
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
      onWindowModeChanged(listener: (mode: 'compact' | 'expanded') => void): void;
      widgetPreferences(): Promise<WidgetPreferences>;
      setWidgetPreferences(preferences: WidgetPreferences): Promise<WidgetPreferences>;
      instrumentationStatus(): Promise<InstrumentationBridgeStatus>;
      instrumentationSessions(): Promise<InstrumentationSnapshot>;
      setInstrumentationEnabled(enabled: boolean): Promise<InstrumentationBridgeStatus>;
      copyInstrumentationValue(value: 'endpoint' | 'token'): Promise<void>;
    };
  }
}
