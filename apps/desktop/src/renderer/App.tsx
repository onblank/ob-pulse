import { useEffect, useState } from 'react';
import type { DashboardSnapshot, ModelRecord, RuntimeId } from '@obpulse/contracts';
import logo from './assets/brand/ob-pulse-logo.svg';
import onblankLogo from './assets/brand/powered-by-onblank.svg';
const fmt = (value: number | null, places = 1) => (value == null ? '—' : value.toFixed(places));
const gib = (n: number | null) => (n == null ? '—' : `${(n / 1024 ** 3).toFixed(2)} GiB`);
const pct = (n: number | null) => (n == null ? '—' : `${n.toFixed(1)}%`);
function Meter({ name, value, info }: { name: string; value: number | null; info: string }) {
  return (
    <div className="meter">
      <div className="meter-heading">
        <span>{name}</span>
        <strong>{pct(value)}</strong>
      </div>
      <div className="meter-track">
        <div className="meter-value" style={{ width: `${value ?? 0}%` }} />
      </div>
      <small>{info}</small>
    </div>
  );
}
function Model({
  model,
  enabled,
  loaded,
  onAction,
  onTest,
  busy,
}: {
  model: ModelRecord;
  enabled: boolean;
  loaded: boolean;
  busy: boolean;
  onAction: () => Promise<void>;
  onTest: () => Promise<void>;
}) {
  return (
    <article className="model">
      <div className="model-header">
        <div className={`pulse-dot ${loaded ? 'online' : ''}`} />
        <div className="model-details">
          <strong title={model.id}>{model.displayName}</strong>
          <span>
            {loaded ? 'Loaded' : 'Downloaded'} · {gib(model.sizeBytes)}
          </span>
        </div>
      </div>
      <div className="model-metrics">
        <span>
          GPU-resident bytes <b>{loaded ? gib(model.gpuResidentBytes) : '—'}</b>
        </span>
        <span>
          Context capacity{' '}
          <b>
            {loaded && model.contextCapacityTokens != null
              ? `${model.contextCapacityTokens.toLocaleString()} tok`
              : '—'}
          </b>
        </span>
        <span>
          Context used <b>—</b>
        </span>
      </div>
      <div className="model-actions">
        <button
          className={loaded ? 'quiet' : 'primary'}
          disabled={!enabled || busy}
          onClick={() => void onAction()}
        >
          {loaded ? 'Unload' : 'Load model'}
        </button>
        {loaded && (
          <button className="quiet" disabled={busy} onClick={() => void onTest()}>
            Test speed
          </button>
        )}
      </div>
    </article>
  );
}
export default function App() {
  const [snapshot, setSnapshot] = useState<DashboardSnapshot | null>(null);
  const [runtime, setRuntime] = useState<RuntimeId>('ollama');
  const [availableRuntimes, setAvailableRuntimes] = useState<
    Array<{ id: RuntimeId; name: string }>
  >([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [top, setTop] = useState(false);
  const refresh = async () => {
    try {
      const current = await window.obpulse.snapshot();
      setSnapshot(current);
    } catch (e) {
      setError(String(e));
    }
  };
  useEffect(() => {
    void refresh();
    void window.obpulse
      .runtimes()
      .then(setAvailableRuntimes)
      .catch((e) => setError(String(e)));
    void window.obpulse.isAlwaysOnTop().then(setTop);
    const ticker = setInterval(() => void refresh(), 3000);
    return () => clearInterval(ticker);
  }, []);
  const action = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    setError(null);
    try {
      await fn();
      await refresh();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  };
  const onRuntime = (id: RuntimeId) => {
    setRuntime(id);
    setSnapshot(null);
    void action(() => window.obpulse.selectRuntime(id));
  };
  const info = snapshot?.runtime;
  const host = snapshot?.host;
  const running = info && info.state !== 'stopped';
  const models = info?.installed ?? [];
  const loadedNames = new Set(info?.loaded.map((m) => m.id) ?? []);
  const currentLoaded = info?.loaded[0] ?? null;
  return (
    <div className="app">
      <header className="header">
        <div className="identity">
          <img className="product-logo" src={logo} alt="OB-Pulse logo placeholder" />
          <span>LOCAL AI MONITOR</span>
        </div>
        <div className="window-buttons">
          <button
            className={top ? 'icon active' : 'icon'}
            title={top ? 'Unpin widget' : 'Keep on top'}
            onClick={() => void window.obpulse.toggleAlwaysOnTop().then(setTop)}
          >
            ⌁
          </button>
          <button className="icon" title="Hide to tray" onClick={() => void window.obpulse.hide()}>
            —
          </button>
        </div>
      </header>
      <main>
        <section className="runtime-bar">
          <div>
            <div className="eyebrow">RUNTIME</div>
            <select
              aria-label="Active runtime"
              value={runtime}
              disabled={busy}
              onChange={(e) => onRuntime(e.target.value as RuntimeId)}
            >
              {(availableRuntimes.length
                ? availableRuntimes
                : [{ id: 'ollama' as RuntimeId, name: 'Ollama' }]
              ).map((entry) => (
                <option key={entry.id} value={entry.id}>
                  {entry.name}
                </option>
              ))}
            </select>
          </div>
          <div className="server-controls">
            <span className={running ? 'status online' : 'status'}>
              {running ? 'CONNECTED' : 'OFFLINE'}
            </span>
            {info?.capabilities.startServer && !running && (
              <button
                className="primary compact"
                disabled={busy}
                onClick={() => void action(() => window.obpulse.start())}
              >
                Start
              </button>
            )}
            {info?.state === 'managed-running' && info.capabilities.stopServer && (
              <button
                className="danger compact"
                disabled={busy}
                onClick={() => void action(() => window.obpulse.stop())}
              >
                Stop
              </button>
            )}
            {info?.state === 'external-running' && (
              <small title="This server was started outside OB-Pulse and cannot be stopped safely here">
                External service
              </small>
            )}
          </div>
        </section>
        {error && (
          <div role="alert" className="message error">
            {error}
          </div>
        )}
        {info?.error && (
          <div role="status" className="message">
            Runtime read error: {info.error}
          </div>
        )}
        <section className="section">
          <div className="section-title">
            <h2>Machine resources</h2>
            <span>HOST</span>
          </div>
          <div className="meter-stack">
            <Meter
              name="CPU"
              value={host?.cpuUtilizationPercent ?? null}
              info={
                host
                  ? `${host.cpuUtilizationPercent == null ? '—' : ((host.cpuUtilizationPercent * host.cpuLogicalCores) / 100).toFixed(2)} / ${host.cpuLogicalCores} busy-core equivalents · entire machine`
                  : 'Gathering...'
              }
            />
            <Meter
              name="Memory"
              value={host?.memoryUsedPercent ?? null}
              info={
                host
                  ? `${gib(host.memoryUsedBytes)} / ${gib(host.memoryTotalBytes)} · entire machine`
                  : 'Gathering...'
              }
            />
          </div>
        </section>
        <section className="section">
          <div className="section-title">
            <h2>Models</h2>
            <span>{info?.loaded.length ?? 0} LOADED</span>
          </div>
          {!running ? (
            <div className="empty">
              Runtime is offline. Start Ollama or start your local server to see models.
            </div>
          ) : models.length === 0 ? (
            <div className="empty">No installed models reported by this runtime.</div>
          ) : (
            <div className="models">
              {models.map((model) => (
                <Model
                  key={model.id}
                  model={model}
                  loaded={loadedNames.has(model.id)}
                  enabled={
                    loadedNames.has(model.id)
                      ? !!info?.capabilities.unloadModel
                      : !!info?.capabilities.loadModel
                  }
                  busy={busy}
                  onAction={() =>
                    action(() =>
                      loadedNames.has(model.id)
                        ? window.obpulse.unload(model.id)
                        : window.obpulse.load(model.id),
                    )
                  }
                  onTest={() => action(() => window.obpulse.benchmark(model.id))}
                />
              ))}
            </div>
          )}
        </section>
        <section className="section">
          <div className="section-title">
            <h2>Throughput</h2>
            <span>LAST TEST ONLY</span>
          </div>
          <div className="throughput">
            <div>
              <span>READ · PREFILL</span>
              <strong>{fmt(snapshot?.latestBenchmark?.readTokensPerSecond ?? null)}</strong>
              <small>tok/s</small>
            </div>
            <div>
              <span>WRITE · DECODE</span>
              <strong>{fmt(snapshot?.latestBenchmark?.writeTokensPerSecond ?? null)}</strong>
              <small>tok/s</small>
            </div>
          </div>
          <p className="note">
            Live speeds from other apps require an opt-in client integration. No activity is
            inferred from polling.
          </p>
          {currentLoaded && (
            <p className="note">
              First loaded model: {currentLoaded.displayName} · reported GPU-resident
              {` ${gib(currentLoaded.gpuResidentBytes)}`}. GPU capacity and utilization: <b>—</b>{' '}
              until a supported OS probe is available.
            </p>
          )}
        </section>
      </main>
      <footer>
        <span>Local-first · No telemetry</span>
        <img src={onblankLogo} alt="Powered by onBlank placeholder" />
      </footer>
    </div>
  );
}
