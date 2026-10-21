import { useEffect, useMemo, useState } from 'react';
import type {
  DashboardSnapshot,
  InstrumentationBridgeStatus,
  InstrumentationSnapshot,
  InstrumentedRequestSample,
  InstrumentedSession,
  MetricHistorySample,
  MetricHistoryWindow,
  ModelRecord,
  RuntimeId,
} from '@obpulse/contracts';
import logo from './assets/brand/ob-pulse-logo.svg';
import onblankLogo from './assets/brand/powered-by-onblank.svg';

type WindowMode = 'compact' | 'expanded';

const DISABLED_BRIDGE: InstrumentationBridgeStatus = {
  enabled: false,
  endpoint: null,
  authToken: null,
};
const EMPTY_INSTRUMENTATION: InstrumentationSnapshot = {
  sessions: [],
  requestHistory: { retentionMs: 60 * 60 * 1000, maxSamples: 7200, samples: [] },
};

const fmt = (value: number | null, places = 1) => (value == null ? '—' : value.toFixed(places));
const gib = (value: number | null) =>
  value == null ? '—' : `${(value / 1024 ** 3).toFixed(2)} GiB`;
const pct = (value: number | null) => (value == null ? '—' : `${value.toFixed(1)}%`);
const lastKnown = (values: readonly (number | null)[]) => {
  for (let index = values.length - 1; index >= 0; index--) {
    const value = values[index];
    if (value != null) return value;
  }
  return null;
};

function Sparkline({ values, color }: { values: readonly (number | null)[]; color: string }) {
  const width = 280;
  const height = 48;
  const finite = values.filter((value): value is number => value != null && Number.isFinite(value));
  const maximum = Math.max(1, ...finite);
  const points = values.map((value, index) => ({
    value,
    x: values.length <= 1 ? width : (index / (values.length - 1)) * width,
    y: value == null ? null : height - Math.min(1, Math.max(0, value / maximum)) * (height - 6) - 3,
  }));
  const segments: Array<Array<{ x: number; y: number }>> = [];
  points.forEach((point, index) => {
    if (point.y == null) return;
    if (index === 0 || points[index - 1]?.y == null) segments.push([]);
    segments.at(-1)?.push({ x: point.x, y: point.y });
  });
  return (
    <svg className="sparkline" viewBox={`0 0 ${width} ${height}`} preserveAspectRatio="none">
      <line x1="0" y1={height - 1} x2={width} y2={height - 1} className="sparkline-base" />
      {segments.map((segment, index) => (
        <polyline
          key={`${segment[0]?.x ?? 0}-${index}`}
          points={segment.map((point) => `${point.x},${point.y}`).join(' ')}
          fill="none"
          stroke={color}
          strokeWidth="2"
          vectorEffect="non-scaling-stroke"
        />
      ))}
      {points.map((point, index) =>
        point.y == null ? null : (
          <circle key={index} cx={point.x} cy={point.y} r="1.8" fill={color} />
        ),
      )}
    </svg>
  );
}

function MetricChart({
  label,
  value,
  unit,
  values,
  color,
  unavailable,
}: {
  label: string;
  value: string;
  unit: string;
  values: readonly (number | null)[];
  color: string;
  unavailable?: string;
}) {
  return (
    <div className="history-row">
      <div className="history-label">
        <span>{label}</span>
        <strong>
          {value} <small>{unit}</small>
        </strong>
      </div>
      <Sparkline values={values} color={color} />
      {values.every((entry) => entry == null) && unavailable && (
        <span className="history-unavailable">{unavailable}</span>
      )}
    </div>
  );
}

function HistoryPanel({
  history,
  runtime,
  snapshot,
}: {
  history: MetricHistoryWindow | null;
  runtime: RuntimeId;
  snapshot: DashboardSnapshot | null;
}) {
  const samples = history?.samples ?? [];
  const runtimeValues = (pick: (sample: MetricHistorySample) => number | null) =>
    samples.map((sample) => (sample.runtimeId === runtime ? pick(sample) : null));
  const ram = samples.map((sample) => sample.hostMemoryUsedPercent);
  const vram = runtimeValues((sample) => sample.gpuResidentBytes);
  const output = runtimeValues((sample) => sample.outputTokensPerSecond);
  const loadedVram = snapshot?.runtime.loaded
    .map((model) => model.gpuResidentBytes)
    .filter((value): value is number => value != null);
  const currentVram = loadedVram?.length
    ? loadedVram.reduce((total, value) => total + value, 0)
    : lastKnown(vram);
  return (
    <section className="history-card" aria-label="Last hour metrics">
      <div className="history-heading">
        <div>
          <span className="eyebrow">ROLLING HISTORY</span>
          <h2>Last hour</h2>
        </div>
        <span className="live-pill">IN MEMORY</span>
      </div>
      <MetricChart
        label="Host RAM"
        value={pct(snapshot?.host.memoryUsedPercent ?? lastKnown(ram))}
        unit=""
        values={ram}
        color="#7f8cff"
      />
      <MetricChart
        label="VRAM resident"
        value={gib(currentVram ?? null)}
        unit=""
        values={vram}
        color="#69e6bd"
        unavailable="Runtime does not report resident VRAM"
      />
      <MetricChart
        label="Output speed"
        value={fmt(snapshot?.latestBenchmark?.writeTokensPerSecond ?? lastKnown(output))}
        unit="tok/s"
        values={output}
        color="#f4ba72"
        unavailable="Benchmark events appear as measured points"
      />
      <div className="history-axis">
        <span>−60 min</span>
        <span>now</span>
      </div>
    </section>
  );
}

function PowerControl({
  snapshot,
  busy,
  onToggle,
}: {
  snapshot: DashboardSnapshot | null;
  busy: boolean;
  onToggle: () => void;
}) {
  const runtime = snapshot?.runtime;
  const state = runtime?.state ?? 'stopped';
  const running = state !== 'stopped';
  const canStart = state === 'stopped' && !!runtime?.capabilities.startServer;
  const canStop = state === 'managed-running' && !!runtime?.capabilities.stopServer;
  const external = state === 'external-running';
  const enabled = !busy && (canStart || canStop);
  const stateLabel = external
    ? 'Managed externally'
    : state === 'managed-running'
      ? 'Managed by OB-Pulse'
      : canStart
        ? 'Ready to start'
        : 'Observation only';
  return (
    <div className="power-control">
      <button
        className={`power-button ${running ? 'running' : ''} ${external ? 'external' : ''}`}
        disabled={!enabled}
        onClick={onToggle}
        aria-label={canStop ? `Stop ${runtime?.displayName}` : `Start ${runtime?.displayName}`}
        title={
          external ? 'This runtime was started outside OB-Pulse and cannot be stopped here' : ''
        }
      >
        <span className="power-symbol">⏻</span>
      </button>
      <div className="power-copy">
        <strong>{runtime?.displayName ?? 'Local runtime'}</strong>
        <span className={running ? 'state online' : 'state'}>{stateLabel}</span>
      </div>
    </div>
  );
}

function WindowHeader({
  mode,
  top,
  onMode,
  onTop,
}: {
  mode: WindowMode;
  top: boolean;
  onMode: () => void;
  onTop: () => void;
}) {
  return (
    <header className="header">
      <div className="identity">
        <img className="product-logo" src={logo} alt="OB-Pulse" />
        <span>LOCAL AI MONITOR</span>
      </div>
      <div className="window-buttons">
        <button className={top ? 'icon active' : 'icon'} title="Keep on top" onClick={onTop}>
          ⌁
        </button>
        <button className="icon" title={mode === 'compact' ? 'Expand' : 'Compact'} onClick={onMode}>
          {mode === 'compact' ? '↗' : '↙'}
        </button>
        <button className="icon" title="Hide to tray" onClick={() => void window.obpulse.hide()}>
          —
        </button>
      </div>
    </header>
  );
}

function ModelCard({
  model,
  loaded,
  busy,
  enabled,
  canBenchmark,
  onAction,
  onBenchmark,
}: {
  model: ModelRecord;
  loaded: boolean;
  busy: boolean;
  enabled: boolean;
  canBenchmark: boolean;
  onAction: () => void;
  onBenchmark: () => void;
}) {
  return (
    <article className="model-card">
      <div className="model-heading">
        <span className={`pulse-dot ${loaded ? 'online' : ''}`} />
        <strong>{model.displayName}</strong>
        <small>{loaded ? 'Loaded' : 'Installed'}</small>
      </div>
      <dl>
        <div>
          <dt>Weights</dt>
          <dd>{gib(model.sizeBytes)}</dd>
        </div>
        <div>
          <dt>VRAM resident</dt>
          <dd>{loaded ? gib(model.gpuResidentBytes) : '—'}</dd>
        </div>
        <div>
          <dt>Context capacity</dt>
          <dd>
            {loaded && model.contextCapacityTokens != null
              ? `${model.contextCapacityTokens.toLocaleString()} tok`
              : '—'}
          </dd>
        </div>
      </dl>
      <div className="model-actions">
        <button
          className={loaded ? 'quiet' : 'primary'}
          disabled={!enabled || busy}
          onClick={onAction}
        >
          {loaded ? 'Unload' : 'Load model'}
        </button>
        {loaded && (
          <button className="quiet" disabled={busy || !canBenchmark} onClick={onBenchmark}>
            Test speed
          </button>
        )}
      </div>
    </article>
  );
}

function SessionReadout({ session }: { session: InstrumentedSession }) {
  const contextValue =
    session.contextUsedTokens == null
      ? '—'
      : `${session.contextUsedTokens.toLocaleString()} / ${session.contextCapacityTokens?.toLocaleString() ?? '—'}`;
  const progress = Math.min(100, Math.max(0, session.contextUsedPercent ?? 0));
  return (
    <div className={`session-readout ${session.contextAlert}`}>
      <div className="session-heading">
        <div>
          <span className="eyebrow">LATEST CLIENT SESSION</span>
          <strong>{session.modelId}</strong>
        </div>
        <span className={session.active ? 'session-state active' : 'session-state'}>
          {session.active ? 'ACTIVE' : 'ENDED'}
        </span>
      </div>
      <div className="context-copy">
        <span>Context · epoch {session.epoch}</span>
        <strong>{contextValue} tok</strong>
      </div>
      <div
        className="context-track"
        aria-label={`Context usage ${pct(session.contextUsedPercent)}`}
      >
        <span style={{ width: `${progress}%` }} />
      </div>
      <div className="session-metrics">
        <div>
          <span>Prefill</span>
          <strong>{fmt(session.readTokensPerSecond)} tok/s</strong>
        </div>
        <div>
          <span>Decode</span>
          <strong>{fmt(session.writeTokensPerSecond)} tok/s</strong>
        </div>
        <div>
          <span>First token</span>
          <strong>{fmt(session.timeToFirstTokenMs)} ms</strong>
        </div>
      </div>
      <small>
        {session.origin} · {session.runtimeId} · {session.sessionId}
      </small>
    </div>
  );
}

function RequestHistoryPanel({
  session,
  samples,
}: {
  session: InstrumentedSession;
  samples: readonly InstrumentedRequestSample[];
}) {
  const sessionSamples = samples.filter((sample) => sample.sessionId === session.sessionId);
  const context = sessionSamples.map((sample) => sample.contextUsedPercent);
  const prefill = sessionSamples.map((sample) => sample.readTokensPerSecond);
  const decode = sessionSamples.map((sample) => sample.writeTokensPerSecond);
  const firstToken = sessionSamples.map((sample) => sample.timeToFirstTokenMs);
  return (
    <div className="request-history">
      <div className="request-history-heading">
        <div>
          <span className="eyebrow">REQUEST HISTORY</span>
          <strong>Last hour · memory only</strong>
        </div>
        <span className="live-pill">
          {sessionSamples.length} {sessionSamples.length === 1 ? 'SAMPLE' : 'SAMPLES'}
        </span>
      </div>
      {sessionSamples.length ? (
        <>
          <MetricChart
            label="Context"
            value={pct(lastKnown(context))}
            unit=""
            values={context}
            color="#69e6bd"
          />
          <MetricChart
            label="Prefill"
            value={fmt(lastKnown(prefill))}
            unit="tok/s"
            values={prefill}
            color="#7f8cff"
          />
          <MetricChart
            label="Decode"
            value={fmt(lastKnown(decode))}
            unit="tok/s"
            values={decode}
            color="#f4ba72"
          />
          <MetricChart
            label="First token"
            value={fmt(lastKnown(firstToken))}
            unit="ms"
            values={firstToken}
            color="#dc8fff"
          />
          <div className="history-axis">
            <span>−60 min</span>
            <span>now</span>
          </div>
        </>
      ) : (
        <div className="empty request-history-empty">
          Waiting for an authenticated <code>request.completed</code> event.
        </div>
      )}
    </div>
  );
}

function InstrumentationPanel({
  bridge,
  instrumentation,
  busy,
  onToggle,
}: {
  bridge: InstrumentationBridgeStatus;
  instrumentation: InstrumentationSnapshot;
  busy: boolean;
  onToggle: () => void;
}) {
  const [revealToken, setRevealToken] = useState(false);
  const [selectedSessionId, setSelectedSessionId] = useState<string | null>(null);
  useEffect(() => setRevealToken(false), [bridge.authToken]);
  const session =
    instrumentation.sessions.find((entry) => entry.sessionId === selectedSessionId) ??
    instrumentation.sessions[0] ??
    null;
  return (
    <section className="instrumentation-card">
      <div className="instrumentation-heading">
        <div>
          <span className="eyebrow">OPT-IN CLIENT INSTRUMENTATION</span>
          <h2>Sessions & request history</h2>
        </div>
        <button
          className={bridge.enabled ? 'bridge-toggle enabled' : 'bridge-toggle'}
          disabled={busy}
          onClick={onToggle}
        >
          {bridge.enabled ? 'Disable bridge' : 'Enable bridge'}
        </button>
      </div>
      {!bridge.enabled ? (
        <p>
          Disabled by default. Enable only when connecting an approved local client. OB-Pulse
          accepts numeric events, never prompts, completions or tool arguments.
        </p>
      ) : (
        <div className="instrumentation-grid">
          <div className="bridge-access">
            <span className="bridge-live">LOCAL BRIDGE ACTIVE</span>
            <label>
              Endpoint
              <span className="access-row">
                <code>{bridge.endpoint}</code>
                <button
                  className="quiet"
                  onClick={() => void window.obpulse.copyInstrumentationValue('endpoint')}
                >
                  Copy
                </button>
              </span>
            </label>
            <label>
              Ephemeral bearer token
              <span className="token-row">
                <code>{revealToken ? bridge.authToken : '••••••••••••••••••••••••'}</code>
                <button className="quiet" onClick={() => setRevealToken((value) => !value)}>
                  {revealToken ? 'Hide' : 'Reveal'}
                </button>
                <button
                  className="quiet"
                  onClick={() => void window.obpulse.copyInstrumentationValue('token')}
                >
                  Copy
                </button>
              </span>
            </label>
            <small>Rotates whenever the bridge is enabled or OB-Pulse restarts.</small>
          </div>
          {session ? (
            <div className="session-stack">
              <label className="session-picker">
                <span>Observed session</span>
                <select
                  value={session.sessionId}
                  onChange={(event) => setSelectedSessionId(event.target.value)}
                >
                  {instrumentation.sessions.map((entry) => (
                    <option key={entry.sessionId} value={entry.sessionId}>
                      {entry.active ? '●' : '○'} {entry.modelId} · {entry.origin}
                    </option>
                  ))}
                </select>
              </label>
              <SessionReadout session={session} />
              <RequestHistoryPanel
                session={session}
                samples={instrumentation.requestHistory.samples}
              />
            </div>
          ) : (
            <div className="empty instrumentation-empty">
              Waiting for an authenticated <code>session.started</code> event.
            </div>
          )}
        </div>
      )}
    </section>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [history, setHistory] = useState<MetricHistoryWindow | null>(null);
  const [runtime, setRuntime] = useState<RuntimeId>('ollama');
  const [runtimes, setRuntimes] = useState<Array<{ id: RuntimeId; name: string }>>([]);
  const [mode, setMode] = useState<WindowMode>('compact');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [top, setTop] = useState(false);
  const [bridge, setBridge] = useState<InstrumentationBridgeStatus>(DISABLED_BRIDGE);
  const [instrumentation, setInstrumentation] =
    useState<InstrumentationSnapshot>(EMPTY_INSTRUMENTATION);

  const refresh = async () => {
    try {
      const [current, currentHistory, bridgeStatus, instrumentationSnapshot] = await Promise.all([
        window.obpulse.snapshot(),
        window.obpulse.history(),
        window.obpulse.instrumentationStatus(),
        window.obpulse.instrumentationSessions(),
      ]);
      setSnapshot(current);
      setHistory(currentHistory);
      setRuntime(current.selectedRuntime);
      setBridge(bridgeStatus);
      setInstrumentation(instrumentationSnapshot);
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : String(refreshError));
    }
  };

  useEffect(() => {
    void refresh();
    void window.obpulse.runtimes().then(setRuntimes).catch(setError);
    void window.obpulse.isAlwaysOnTop().then(setTop);
    void window.obpulse.getWindowMode().then(setMode);
    const ticker = setInterval(() => void refresh(), 3000);
    return () => clearInterval(ticker);
  }, []);

  const action = async (operation: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await operation();
      await refresh();
    } catch (actionError) {
      setError(actionError instanceof Error ? actionError.message : String(actionError));
    } finally {
      setBusy(false);
    }
  };

  const changeRuntime = (id: RuntimeId) => {
    setRuntime(id);
    setSnapshot(null);
    void action(() => window.obpulse.selectRuntime(id));
  };
  const toggleMode = () => {
    const next = mode === 'compact' ? 'expanded' : 'compact';
    void window.obpulse.setWindowMode(next).then(setMode).catch(setError);
  };
  const info = snapshot?.runtime;
  const running = info != null && info.state !== 'stopped';
  const loadedIds = useMemo(() => new Set(info?.loaded.map((model) => model.id) ?? []), [info]);
  const loaded = info?.loaded ?? [];
  const compactModel = loaded[0] ?? null;
  const togglePower = () => {
    if (info?.state === 'managed-running') void action(() => window.obpulse.stop());
    else if (info?.state === 'stopped') void action(() => window.obpulse.start());
  };

  return (
    <div className={`app ${mode}`}>
      <WindowHeader
        mode={mode}
        top={top}
        onMode={toggleMode}
        onTop={() => void window.obpulse.toggleAlwaysOnTop().then(setTop)}
      />
      <main>
        {error && <div className="message error">{error}</div>}
        {info?.error && <div className="message">Runtime read error: {info.error}</div>}

        {mode === 'compact' ? (
          <div className="compact-content">
            <PowerControl snapshot={snapshot} busy={busy} onToggle={togglePower} />
            <section className="loaded-model">
              <span className={`pulse-dot ${compactModel ? 'online' : ''}`} />
              <div>
                <span className="eyebrow">LOADED MODEL</span>
                <strong>
                  {compactModel?.displayName ?? (running ? 'No model loaded' : 'Runtime offline')}
                </strong>
                {loaded.length > 1 && <small>+{loaded.length - 1} additional loaded</small>}
              </div>
            </section>
            <HistoryPanel history={history} runtime={runtime} snapshot={snapshot} />
          </div>
        ) : (
          <div className="expanded-content">
            <section className="expanded-toolbar">
              <div>
                <span className="eyebrow">RUNTIME</span>
                <select
                  aria-label="Active runtime"
                  value={runtime}
                  disabled={busy}
                  onChange={(event) => changeRuntime(event.target.value as RuntimeId)}
                >
                  {(runtimes.length
                    ? runtimes
                    : [{ id: 'ollama' as RuntimeId, name: 'Ollama' }]
                  ).map((entry) => (
                    <option key={entry.id} value={entry.id}>
                      {entry.name}
                    </option>
                  ))}
                </select>
              </div>
              <PowerControl snapshot={snapshot} busy={busy} onToggle={togglePower} />
            </section>

            <InstrumentationPanel
              bridge={bridge}
              instrumentation={instrumentation}
              busy={busy}
              onToggle={() =>
                void action(() => window.obpulse.setInstrumentationEnabled(!bridge.enabled))
              }
            />

            <div className="expanded-grid">
              <div className="expanded-primary">
                <HistoryPanel history={history} runtime={runtime} snapshot={snapshot} />
                <section className="resource-grid">
                  <div>
                    <span>Host CPU</span>
                    <strong>{pct(snapshot?.host.cpuUtilizationPercent ?? null)}</strong>
                    <small>{snapshot?.host.cpuLogicalCores ?? '—'} logical cores</small>
                  </div>
                  <div>
                    <span>Host RAM</span>
                    <strong>{pct(snapshot?.host.memoryUsedPercent ?? null)}</strong>
                    <small>
                      {gib(snapshot?.host.memoryUsedBytes ?? null)} /{' '}
                      {gib(snapshot?.host.memoryTotalBytes ?? null)}
                    </small>
                  </div>
                  <div>
                    <span>Last output test</span>
                    <strong>{fmt(snapshot?.latestBenchmark?.writeTokensPerSecond ?? null)}</strong>
                    <small>tok/s · benchmark only</small>
                  </div>
                </section>
              </div>

              <section className="models-panel">
                <div className="section-title">
                  <div>
                    <span className="eyebrow">MODELS</span>
                    <h2>{info?.loaded.length ?? 0} loaded</h2>
                  </div>
                  <span>{info?.installed.length ?? 0} installed</span>
                </div>
                {!running ? (
                  <div className="empty">Start the runtime to inspect installed models.</div>
                ) : info?.installed.length ? (
                  <div className="models">
                    {info.installed.map((model) => {
                      const isLoaded = loadedIds.has(model.id);
                      const presentedModel =
                        loaded.find((loadedModel) => loadedModel.id === model.id) ?? model;
                      return (
                        <ModelCard
                          key={model.id}
                          model={presentedModel}
                          loaded={isLoaded}
                          busy={busy}
                          enabled={
                            isLoaded ? info.capabilities.unloadModel : info.capabilities.loadModel
                          }
                          canBenchmark={info.capabilities.benchmark}
                          onAction={() =>
                            void action(() =>
                              isLoaded
                                ? window.obpulse.unload(model.id)
                                : window.obpulse.load(model.id),
                            )
                          }
                          onBenchmark={() => void action(() => window.obpulse.benchmark(model.id))}
                        />
                      );
                    })}
                  </div>
                ) : (
                  <div className="empty">No installed models reported by this runtime.</div>
                )}
              </section>
            </div>
          </div>
        )}
      </main>
      <footer>
        <span>Local-first · Last hour only · No telemetry</span>
        <img src={onblankLogo} alt="Powered by onBlank" />
      </footer>
    </div>
  );
}
