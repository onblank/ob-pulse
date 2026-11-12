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
  RuntimeCatalogEntry,
  RuntimeCredentialStatus,
  RuntimeId,
  RuntimePreferences,
  RuntimeSnapshot,
  WidgetPosition,
  WidgetPreferences,
} from '@obpulse/contracts';
import logo from './assets/brand/ob-pulse-logo.svg';
import onblankLogo from './assets/brand/onblank-logo.png';
import {
  receiveWindowMode,
  toggleSettings,
  toggleWindowMode,
  type PanelNavigation,
  type PanelSurface,
  type WindowMode,
} from './panel-navigation';
import {
  runtimeActionLabel,
  runtimePrimaryAction,
  type RuntimePrimaryAction,
} from './runtime-control';

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
  const runtimeSamples = samples.filter((sample) => sample.runtimeId === runtime);
  const runtimeValues = (pick: (sample: MetricHistorySample) => number | null) =>
    runtimeSamples.map(pick);
  const ram = runtimeValues((sample) => sample.hostMemoryUsedPercent);
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
      {(snapshot?.host.gpus ?? []).map((gpu) => {
        const values = runtimeValues(
          (sample) =>
            sample.hostGpus.find(
              (entry) => entry.source === gpu.source && entry.index === gpu.index,
            )?.utilizationPercent ?? null,
        );
        return (
          <MetricChart
            key={`${gpu.source}:${gpu.index}`}
            label={`${gpu.name} utilization`}
            value={pct(gpu.utilizationPercent)}
            unit=""
            values={values}
            color="#67c9ed"
            unavailable="GPU utilization is unavailable"
          />
        );
      })}
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
  onTakeControl,
  onReleaseControl,
}: {
  snapshot: DashboardSnapshot | null;
  busy: boolean;
  onToggle: () => void;
  onTakeControl: () => void;
  onReleaseControl: () => void;
}) {
  const runtime = snapshot?.runtime;
  const state = runtime?.state ?? 'stopped';
  const capabilities = runtime?.manifest?.capabilities;
  const running = state !== 'stopped';
  const canStart = state === 'stopped' && !!capabilities?.startServer;
  const canStop = state === 'managed-running' && !!capabilities?.stopServer;
  const external = state === 'external-running';
  const canTakeControl = external && !!capabilities?.takeControl;
  const canReleaseControl = state === 'managed-running' && !!capabilities?.releaseControl;
  const enabled = !busy && (canStart || canStop);
  const stateLabel = external
    ? 'Server managed externally'
    : state === 'managed-running'
      ? runtime?.controlAuthority === 'delegated'
        ? 'Control delegated to OB-Pulse'
        : runtime?.controlAuthority === 'process-owned'
          ? 'Process owned by OB-Pulse'
          : 'Server started by OB-Pulse'
      : canStart
        ? 'Server ready to start'
        : 'Observation only';
  return (
    <div className="power-control">
      <button
        className={`power-button ${running ? 'running' : ''} ${external ? 'external' : ''}`}
        disabled={!enabled}
        onClick={onToggle}
        aria-label={
          canStop ? `Stop ${runtime?.displayName} server` : `Start ${runtime?.displayName} server`
        }
        title={
          external
            ? canTakeControl
              ? 'Take explicit control before stopping this external server'
              : 'This runtime server was started outside OB-Pulse and cannot be stopped here'
            : ''
        }
      >
        <span className="power-symbol">⏻</span>
      </button>
      <div className="power-copy">
        <strong>{runtime?.displayName ?? 'Local runtime'}</strong>
        <span className={running ? 'state online' : 'state'}>{stateLabel}</span>
        {canTakeControl && (
          <button className="take-control" disabled={busy} onClick={onTakeControl}>
            Take control
          </button>
        )}
        {canReleaseControl && (
          <button className="release-control" disabled={busy} onClick={onReleaseControl}>
            Release control
          </button>
        )}
      </div>
    </div>
  );
}

function authorityLabel(runtime: RuntimeSnapshot): string {
  switch (runtime.controlAuthority) {
    case 'process-owned':
      return 'Process owned';
    case 'session-managed':
      return 'Session managed';
    case 'delegated':
      return 'Delegated';
    case 'service-managed':
      return 'Service managed';
    case 'observer':
      return 'Observer';
  }
}

function RuntimeControlCenter({
  runtimes,
  selectedRuntime,
  busy,
  onSelect,
  onAction,
}: {
  runtimes: readonly RuntimeSnapshot[];
  selectedRuntime: RuntimeId;
  busy: boolean;
  onSelect: (runtime: RuntimeId) => void;
  onAction: (runtime: RuntimeSnapshot, action: RuntimePrimaryAction) => void;
}) {
  return (
    <section className="runtime-center" aria-labelledby="runtime-center-title">
      <div className="runtime-center-heading">
        <div>
          <span className="eyebrow">LOCAL AI CONTROL CENTER</span>
          <h2 id="runtime-center-title">Runtime overview</h2>
        </div>
        <span>{runtimes.filter((runtime) => runtime.state !== 'stopped').length} online</span>
      </div>
      <div className="runtime-cards">
        {runtimes.map((runtime) => {
          const selected = runtime.id === selectedRuntime;
          const action = runtimePrimaryAction(runtime);
          const state = runtime.error
            ? 'Read error'
            : runtime.state === 'stopped'
              ? 'Offline'
              : runtime.state === 'managed-running'
                ? 'Managed'
                : 'External';
          const loadedModel = runtime.loaded[0]?.displayName ?? null;
          return (
            <article
              key={runtime.id}
              className={selected ? 'runtime-card selected' : 'runtime-card'}
            >
              <button
                className="runtime-card-select"
                disabled={busy}
                aria-pressed={selected}
                onClick={() => onSelect(runtime.id)}
              >
                <span className="runtime-card-title">
                  <span className={`pulse-dot ${runtime.state !== 'stopped' ? 'online' : ''}`} />
                  <strong>{runtime.displayName}</strong>
                  <small className={runtime.error ? 'error' : ''}>{state}</small>
                </span>
                <span className="runtime-card-model">
                  {loadedModel ??
                    (runtime.state === 'stopped'
                      ? 'No server detected'
                      : 'No loaded model reported')}
                </span>
                <span className="runtime-card-facts">
                  <small>{authorityLabel(runtime)}</small>
                  <small>
                    {runtime.loaded.length} loaded · {runtime.installed.length} available
                  </small>
                  <small>
                    CPU {pct(runtime.ownedProcess?.cpuUtilizationPercent ?? null)} · RAM{' '}
                    {gib(runtime.ownedProcess?.memoryResidentBytes ?? null)}
                  </small>
                </span>
              </button>
              {action && (
                <button
                  className="runtime-card-action"
                  disabled={busy}
                  onClick={() => onAction(runtime, action)}
                >
                  {runtimeActionLabel(action)}
                </button>
              )}
            </article>
          );
        })}
      </div>
    </section>
  );
}

function RuntimeAccessPanel({ snapshot }: { snapshot: DashboardSnapshot | null }) {
  const runtime = snapshot?.runtime;
  if (!runtime?.manifest) return null;
  const { manifest, controlAuthority } = runtime;
  const capabilities = [
    ['Installed models', manifest.capabilities.listInstalled],
    ['Loaded models', manifest.capabilities.listLoaded],
    ['Start server', manifest.capabilities.startServer],
    ['Stop controlled server', manifest.capabilities.stopServer],
    ['Take control', manifest.capabilities.takeControl],
    ['Release control', manifest.capabilities.releaseControl],
    ['Load model', manifest.capabilities.loadModel],
    ['Unload model', manifest.capabilities.unloadModel],
    ['Benchmark', manifest.capabilities.benchmark],
  ] as const;
  const authorityLabel =
    controlAuthority === 'process-owned'
      ? 'Process owned'
      : controlAuthority === 'session-managed'
        ? 'Session managed'
        : controlAuthority === 'delegated'
          ? 'Delegated control'
          : controlAuthority === 'service-managed'
            ? 'Service managed'
            : 'Observer only';
  const serverControlLabel =
    manifest.permissions.serverControl === 'none'
      ? 'Observation only'
      : manifest.permissions.serverControl === 'owned-process-only'
        ? 'Owned child process only'
        : 'Provider server toggle';
  const credentialLabel =
    manifest.permissions.credentialMode === 'os-protected-write-only'
      ? 'OS-protected, write-only'
      : 'No credential storage';
  return (
    <section className="access-panel" aria-labelledby="runtime-access-title">
      <div className="access-heading">
        <div>
          <span className="eyebrow">ACCESS & CAPABILITIES</span>
          <h2 id="runtime-access-title">{runtime.displayName} adapter</h2>
        </div>
        <span className="contract-badge">CONTRACT {manifest.contractVersion}</span>
      </div>
      <div className="permission-summary">
        <div>
          <span>Current authority</span>
          <strong>{authorityLabel}</strong>
        </div>
        <div>
          <span>Network</span>
          <strong>Loopback only</strong>
        </div>
        <div>
          <span>Server control</span>
          <strong>{serverControlLabel}</strong>
        </div>
        <div>
          <span>Credentials</span>
          <strong>{credentialLabel}</strong>
        </div>
        <div>
          <span>Inference content</span>
          <strong>{manifest.permissions.inferenceContentAccess ? 'Allowed' : 'No access'}</strong>
        </div>
        <div>
          <span>External processes</span>
          <strong>
            {manifest.permissions.externalProcessTermination ? 'Can terminate' : 'Never terminate'}
          </strong>
        </div>
        <div>
          <span>Model deletion</span>
          <strong>{manifest.permissions.modelFileDeletion ? 'Allowed' : 'Never'}</strong>
        </div>
      </div>
      <div className="capability-list">
        {capabilities.map(([label, supported]) => (
          <span key={label} className={supported ? 'supported' : 'unsupported'}>
            {supported ? '✓' : '—'} {label}
          </span>
        ))}
      </div>
      <small>
        Adapter {manifest.adapterVersion} · capabilities describe support; current authority decides
        whether a control action is available now.
      </small>
    </section>
  );
}

function WindowHeader({
  mode,
  surface,
  top,
  onMode,
  onSettings,
  onTop,
}: {
  mode: WindowMode;
  surface: PanelSurface;
  top: boolean;
  onMode: () => void;
  onSettings: () => void;
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
        <button
          className={surface === 'settings' ? 'icon active' : 'icon'}
          title={surface === 'settings' ? 'Back to monitor' : 'Settings'}
          aria-label={surface === 'settings' ? 'Back to monitor' : 'Open settings'}
          aria-pressed={surface === 'settings'}
          onClick={onSettings}
        >
          ⚙
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

function WidgetSettings({
  preferences,
  busy,
  onChange,
}: {
  preferences: WidgetPreferences | null;
  busy: boolean;
  onChange: (next: WidgetPreferences) => void;
}) {
  if (!preferences) return null;
  return (
    <section className="widget-settings" aria-labelledby="widget-settings-title">
      <div>
        <span className="eyebrow">WIDGET</span>
        <h2 id="widget-settings-title">Appearance & position</h2>
      </div>
      <label>
        <span>Position</span>
        <select
          value={preferences.position}
          disabled={busy}
          onChange={(event) =>
            onChange({ ...preferences, position: event.target.value as WidgetPosition })
          }
        >
          <option value="tray">Next to tray</option>
          <option value="top-left">Top left</option>
          <option value="top-right">Top right</option>
          <option value="bottom-left">Bottom left</option>
          <option value="bottom-right">Bottom right</option>
        </select>
      </label>
      <label>
        <span>Opacity</span>
        <select
          value={preferences.opacity}
          disabled={busy}
          onChange={(event) => onChange({ ...preferences, opacity: Number(event.target.value) })}
        >
          <option value="1">100%</option>
          <option value="0.95">95%</option>
          <option value="0.85">85%</option>
          <option value="0.75">75%</option>
        </select>
      </label>
      <label className="contrast-setting">
        <input
          type="checkbox"
          checked={preferences.highContrast}
          disabled={busy}
          onChange={(event) => onChange({ ...preferences, highContrast: event.target.checked })}
        />
        <span>High contrast</span>
      </label>
    </section>
  );
}

function RuntimeSettings({
  catalog,
  preferences,
  busy,
  onChange,
}: {
  catalog: readonly RuntimeCatalogEntry[];
  preferences: RuntimePreferences | null;
  busy: boolean;
  onChange: (next: RuntimePreferences) => void;
}) {
  if (!preferences || !catalog.length) return null;
  const enabled = new Set(preferences.enabledRuntimeIds);
  const toggle = (id: RuntimeId, checked: boolean) => {
    const next = catalog
      .filter((entry) => (entry.id === id ? checked : enabled.has(entry.id)))
      .map((entry) => entry.id);
    onChange({ enabledRuntimeIds: next });
  };
  return (
    <section className="runtime-settings" aria-labelledby="runtime-settings-title">
      <div className="runtime-settings-copy">
        <span className="eyebrow">BUILT-IN ADAPTERS</span>
        <h2 id="runtime-settings-title">Runtime visibility</h2>
        <p>Disabling an adapter never stops its service or removes model files.</p>
      </div>
      <div className="runtime-options">
        {catalog.map((entry) => {
          const checked = enabled.has(entry.id);
          const lastEnabled = checked && enabled.size === 1;
          return (
            <label key={entry.id}>
              <input
                type="checkbox"
                checked={checked}
                disabled={busy || lastEnabled}
                onChange={(event) => toggle(entry.id, event.target.checked)}
              />
              <span>
                <strong>{entry.name}</strong>
                <small>{checked ? 'Available in OB-Pulse' : 'Disabled'}</small>
              </span>
            </label>
          );
        })}
      </div>
    </section>
  );
}

function LMStudioAuthentication({
  status,
  busy,
  onSave,
  onClear,
}: {
  status: RuntimeCredentialStatus | null;
  busy: boolean;
  onSave: (token: string) => void;
  onClear: () => void;
}) {
  const [token, setToken] = useState('');
  if (!status) return null;
  const submit = () => {
    const submitted = token;
    setToken('');
    onSave(submitted);
  };
  return (
    <section className="credential-settings" aria-labelledby="lmstudio-auth-title">
      <div>
        <span className="eyebrow">LM STUDIO</span>
        <h2 id="lmstudio-auth-title">API authentication</h2>
        <p>
          The token is encrypted with the operating system credential store and is never displayed
          again by OB-Pulse.
        </p>
      </div>
      <div className="credential-controls">
        <span className={status.configured ? 'credential-state configured' : 'credential-state'}>
          {status.configured ? 'TOKEN CONFIGURED' : 'NO TOKEN'}
        </span>
        <label>
          <span>API token</span>
          <input
            type="password"
            value={token}
            autoComplete="off"
            spellCheck={false}
            placeholder={status.configured ? 'Replace configured token' : 'Paste LM Studio token'}
            disabled={busy || !status.secureStorageAvailable}
            onChange={(event) => setToken(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter' && token.trim()) submit();
            }}
          />
        </label>
        <div className="credential-actions">
          <button
            disabled={busy || !status.secureStorageAvailable || !token.trim()}
            onClick={submit}
          >
            {status.configured ? 'Replace token' : 'Save token'}
          </button>
          {(status.configured || status.storedCredentialPresent) && (
            <button
              className="quiet"
              disabled={busy}
              onClick={() => {
                if (window.confirm('Remove the saved LM Studio API token from this device?'))
                  onClear();
              }}
            >
              Remove
            </button>
          )}
        </div>
        {!status.secureStorageAvailable && (
          <small>
            Protected OS credential storage is unavailable; Pulse will not save a token.
          </small>
        )}
        {status.error && <small className="credential-error">{status.error}</small>}
      </div>
    </section>
  );
}

export default function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [history, setHistory] = useState<MetricHistoryWindow | null>(null);
  const [runtime, setRuntime] = useState<RuntimeId>('ollama');
  const [runtimeCatalog, setRuntimeCatalog] = useState<RuntimeCatalogEntry[]>([]);
  const [runtimePreferences, setRuntimePreferences] = useState<RuntimePreferences | null>(null);
  const [lmStudioCredential, setLMStudioCredential] = useState<RuntimeCredentialStatus | null>(
    null,
  );
  const [mode, setMode] = useState<WindowMode>('compact');
  const [surface, setSurface] = useState<PanelSurface>('monitor');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [top, setTop] = useState(false);
  const [bridge, setBridge] = useState<InstrumentationBridgeStatus>(DISABLED_BRIDGE);
  const [instrumentation, setInstrumentation] =
    useState<InstrumentationSnapshot>(EMPTY_INSTRUMENTATION);
  const [preferences, setPreferences] = useState<WidgetPreferences | null>(null);

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
    void window.obpulse.runtimeCatalog().then(setRuntimeCatalog).catch(setError);
    void window.obpulse.runtimePreferences().then(setRuntimePreferences).catch(setError);
    void window.obpulse.isAlwaysOnTop().then(setTop);
    void window.obpulse.getWindowMode().then(setMode);
    window.obpulse.onWindowModeChanged((nextMode) => {
      setMode(nextMode);
      setSurface(
        (currentSurface) =>
          receiveWindowMode({ mode: nextMode, surface: currentSurface }, nextMode).surface,
      );
    });
    window.obpulse.onOpenSettings(() => {
      setMode('expanded');
      setSurface('settings');
    });
    void window.obpulse.widgetPreferences().then(setPreferences).catch(setError);
    const ticker = setInterval(() => void refresh(), 3000);
    return () => clearInterval(ticker);
  }, []);

  useEffect(() => {
    if (surface !== 'settings' || runtime !== 'lmstudio') return;
    void window.obpulse
      .lmStudioCredentialStatus()
      .then(setLMStudioCredential)
      .catch((credentialError) =>
        setError(
          credentialError instanceof Error ? credentialError.message : String(credentialError),
        ),
      );
  }, [surface, runtime]);

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
    void action(() => window.obpulse.selectRuntime(id));
  };
  const navigate = (next: PanelNavigation) => {
    if (next.mode === mode) {
      setSurface(next.surface);
      return;
    }
    void window.obpulse
      .setWindowMode(next.mode)
      .then((savedMode) => {
        setMode(savedMode);
        setSurface(savedMode === 'compact' ? 'monitor' : next.surface);
      })
      .catch(setError);
  };
  const toggleMode = () => navigate(toggleWindowMode({ mode, surface }));
  const toggleSettingsPanel = () => navigate(toggleSettings({ mode, surface }));
  const info = snapshot?.runtime;
  const running = info != null && info.state !== 'stopped';
  const loadedIds = useMemo(() => new Set(info?.loaded.map((model) => model.id) ?? []), [info]);
  const loaded = info?.loaded ?? [];
  const presentedModels = [
    ...(info?.installed ?? []),
    ...loaded.filter((model) => !(info?.installed ?? []).some((entry) => entry.id === model.id)),
  ];
  const compactModel = loaded[0] ?? null;
  const observedRuntimes = snapshot?.runtimes ?? [];
  const onlineRuntimeCount = observedRuntimes.filter((entry) => entry.state !== 'stopped').length;
  const loadedModelCount = observedRuntimes.reduce(
    (total, entry) => total + entry.loaded.length,
    0,
  );
  const togglePower = () => {
    if (info?.state === 'managed-running') {
      if (
        info.controlAuthority === 'delegated' &&
        !window.confirm(
          'Stop the delegated LM Studio server? This may interrupt active requests in other applications.',
        )
      )
        return;
      void action(() => window.obpulse.stop(info.id));
    } else if (info?.state === 'stopped') void action(() => window.obpulse.start(info.id));
  };
  const takeControl = () => {
    if (
      !window.confirm(
        'Give OB-Pulse control of this LM Studio server for the current session? Stopping it later may interrupt active requests.',
      )
    )
      return;
    if (!info) return;
    void action(() => window.obpulse.takeControl(info.id));
  };
  const releaseControl = () => {
    if (
      !window.confirm(
        'Release OB-Pulse control of this LM Studio server? The server will remain running and return to observation-only mode.',
      )
    )
      return;
    if (!info) return;
    void action(() => window.obpulse.releaseControl(info.id));
  };
  const runRuntimeAction = (runtimeSnapshot: RuntimeSnapshot, intent: RuntimePrimaryAction) => {
    if (
      intent === 'take-control' &&
      !window.confirm(
        `Give OB-Pulse control of ${runtimeSnapshot.displayName} for this session? Stopping it later may interrupt other applications.`,
      )
    )
      return;
    if (
      intent === 'stop' &&
      runtimeSnapshot.controlAuthority === 'delegated' &&
      !window.confirm(
        `Stop the delegated ${runtimeSnapshot.displayName} server? This may interrupt active requests in other applications.`,
      )
    )
      return;
    void action(() =>
      intent === 'start'
        ? window.obpulse.start(runtimeSnapshot.id)
        : intent === 'stop'
          ? window.obpulse.stop(runtimeSnapshot.id)
          : intent === 'take-control'
            ? window.obpulse.takeControl(runtimeSnapshot.id)
            : window.obpulse.releaseControl(runtimeSnapshot.id),
    );
  };
  const updatePreferences = async (next: WidgetPreferences) => {
    setBusy(true);
    setError(null);
    try {
      setPreferences(await window.obpulse.setWidgetPreferences(next));
    } catch (preferencesError) {
      setError(
        preferencesError instanceof Error ? preferencesError.message : String(preferencesError),
      );
    } finally {
      setBusy(false);
    }
  };
  const updateRuntimePreferences = async (next: RuntimePreferences) => {
    setBusy(true);
    setError(null);
    try {
      const saved = await window.obpulse.setRuntimePreferences(next);
      const [current, catalog] = await Promise.all([
        window.obpulse.snapshot(),
        window.obpulse.runtimeCatalog(),
      ]);
      setRuntimePreferences(saved);
      setSnapshot(current);
      setRuntime(current.selectedRuntime);
      setRuntimeCatalog(catalog);
    } catch (preferencesError) {
      setError(
        preferencesError instanceof Error ? preferencesError.message : String(preferencesError),
      );
    } finally {
      setBusy(false);
    }
  };
  const saveLMStudioToken = async (token: string) => {
    setBusy(true);
    setError(null);
    try {
      setLMStudioCredential(await window.obpulse.setLMStudioApiToken(token));
      await refresh();
    } catch (credentialError) {
      setError(
        credentialError instanceof Error ? credentialError.message : String(credentialError),
      );
    } finally {
      setBusy(false);
    }
  };
  const clearLMStudioToken = async () => {
    setBusy(true);
    setError(null);
    try {
      setLMStudioCredential(await window.obpulse.clearLMStudioApiToken());
      await refresh();
    } catch (credentialError) {
      setError(
        credentialError instanceof Error ? credentialError.message : String(credentialError),
      );
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className={`app ${mode}${preferences?.highContrast ? ' high-contrast' : ''}`}>
      <WindowHeader
        mode={mode}
        surface={surface}
        top={top}
        onMode={toggleMode}
        onSettings={toggleSettingsPanel}
        onTop={() => void window.obpulse.toggleAlwaysOnTop().then(setTop)}
      />
      <main>
        {error && <div className="message error">{error}</div>}
        {info?.error && <div className="message">Runtime read error: {info.error}</div>}

        {mode === 'compact' ? (
          <div className="compact-content">
            <PowerControl
              snapshot={snapshot}
              busy={busy}
              onToggle={togglePower}
              onTakeControl={takeControl}
              onReleaseControl={releaseControl}
            />
            <section className="loaded-model">
              <span className={`pulse-dot ${compactModel ? 'online' : ''}`} />
              <div>
                <span className="eyebrow">LOADED MODEL</span>
                <strong>
                  {compactModel?.displayName ??
                    (running ? 'No loaded model reported' : 'Runtime offline')}
                </strong>
                {loaded.length > 1 && <small>+{loaded.length - 1} additional loaded</small>}
                <small>
                  {onlineRuntimeCount} runtime{onlineRuntimeCount === 1 ? '' : 's'} online ·{' '}
                  {loadedModelCount} model{loadedModelCount === 1 ? '' : 's'} loaded
                </small>
              </div>
            </section>
            <HistoryPanel history={history} runtime={runtime} snapshot={snapshot} />
          </div>
        ) : surface === 'settings' ? (
          <div className="settings-content">
            <section className="settings-heading">
              <div>
                <span className="eyebrow">SETTINGS</span>
                <h1>Preferences & access</h1>
                <p>Local configuration, credentials and adapter permissions.</p>
              </div>
              <button className="quiet" onClick={toggleSettingsPanel}>
                Back to monitor
              </button>
            </section>

            <WidgetSettings
              preferences={preferences}
              busy={busy}
              onChange={(next) => void updatePreferences(next)}
            />

            <RuntimeSettings
              catalog={runtimeCatalog}
              preferences={runtimePreferences}
              busy={busy}
              onChange={(next) => void updateRuntimePreferences(next)}
            />

            <RuntimeAccessPanel snapshot={snapshot} />

            {runtime === 'lmstudio' && (
              <LMStudioAuthentication
                status={lmStudioCredential}
                busy={busy}
                onSave={(token) => void saveLMStudioToken(token)}
                onClear={() => void clearLMStudioToken()}
              />
            )}

            <InstrumentationPanel
              bridge={bridge}
              instrumentation={instrumentation}
              busy={busy}
              onToggle={() =>
                void action(() => window.obpulse.setInstrumentationEnabled(!bridge.enabled))
              }
            />
          </div>
        ) : (
          <div className="expanded-content">
            <RuntimeControlCenter
              runtimes={observedRuntimes}
              selectedRuntime={runtime}
              busy={busy}
              onSelect={changeRuntime}
              onAction={runRuntimeAction}
            />

            <section className="expanded-toolbar">
              <div>
                <span className="eyebrow">SELECTED RUNTIME</span>
                <strong className="selected-runtime-name">
                  {info?.displayName ?? 'Loading runtime…'}
                </strong>
              </div>
              <PowerControl
                snapshot={snapshot}
                busy={busy}
                onToggle={togglePower}
                onTakeControl={takeControl}
                onReleaseControl={releaseControl}
              />
            </section>

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
                  {(snapshot?.host.gpus.length ? snapshot.host.gpus : [null]).map((gpu, index) => (
                    <div key={gpu?.index ?? index}>
                      <span>{gpu ? `GPU ${gpu.index} · ${gpu.name}` : 'Host GPU'}</span>
                      <strong>{pct(gpu?.utilizationPercent ?? null)}</strong>
                      <small>
                        {gpu
                          ? `${gib(gpu.memoryUsedBytes)} / ${gib(gpu.memoryTotalBytes)} VRAM · NVIDIA`
                          : 'No supported GPU reading available'}
                      </small>
                    </div>
                  ))}
                  <div>
                    <span>Last output test</span>
                    <strong>{fmt(snapshot?.latestBenchmark?.writeTokensPerSecond ?? null)}</strong>
                    <small>
                      tok/s · TTFT {fmt(snapshot?.latestBenchmark?.timeToFirstTokenMs ?? null)} ms
                    </small>
                  </div>
                  <div>
                    <span>Owned process CPU</span>
                    <strong>
                      {pct(snapshot?.runtime.ownedProcess?.cpuUtilizationPercent ?? null)}
                    </strong>
                    <small>
                      {snapshot?.runtime.ownedProcess
                        ? `PID ${snapshot.runtime.ownedProcess.pid} · core-equivalent`
                        : 'Managed runtime only'}
                    </small>
                  </div>
                  <div>
                    <span>Owned process RAM</span>
                    <strong>
                      {gib(snapshot?.runtime.ownedProcess?.memoryResidentBytes ?? null)}
                    </strong>
                    <small>Resident memory · not model-specific</small>
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
                  <div className="empty">
                    {info?.manifest.capabilities.startServer
                      ? 'Start the runtime to inspect its models.'
                      : 'Runtime unavailable. Start it outside OB-Pulse to inspect its models.'}
                  </div>
                ) : presentedModels.length ? (
                  <div className="models">
                    {presentedModels.map((model) => {
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
                            (isLoaded
                              ? info.manifest?.capabilities.unloadModel
                              : info.manifest?.capabilities.loadModel) ?? false
                          }
                          canBenchmark={info.manifest?.capabilities.benchmark ?? false}
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
                  <div className="empty">No models reported by this runtime.</div>
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
