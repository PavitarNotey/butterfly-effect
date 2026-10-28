import { useEffect } from "react";
import { replayStore, useReplay } from "../replay/store";
import { frameAt, loadEvidence, momentAt } from "./data";
import { useTactics } from "./store";
import type { TacticalState } from "./store";
import type { Layer } from "./types";
import {
  formatMetric,
  layerNames,
  presentEvidence,
  presentMoment,
  supportingInsights,
} from "./presentation";

/**
 * Load source-validated evidence with cancellation/retry, independently of paid narrative generation.
 * Read-only data stays available to the AI picker even while tactical layers are disabled.
 */
export function TacticalPanel({
  time,
  onWatch,
}: {
  time: number;
  onWatch?: () => void;
}) {
  const scenario = useReplay((s) => s.scenario);
  const state = useTactics();
  const { bundle, attempt } = state;
  useEffect(() => {
    // Read-only evidence also supplies the four curated AI selector options.
    if (bundle) return;
    let ignore = false;
    const requestAttempt = useTactics.getState().attempt;
    const isCurrent = () =>
      !ignore &&
      replayStore.getState().scenario.id === scenario.id &&
      useTactics.getState().attempt === requestAttempt;
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 8000);
    useTactics.setState({ status: "loading", error: "" });
    void loadEvidence(controller.signal, scenario)
      .then((bundle) => {
        if (isCurrent() && !controller.signal.aborted)
          useTactics.setState({ bundle, status: "ready" });
      })
      .catch((error) => {
        if (isCurrent() && !controller.signal.aborted)
          useTactics.setState({
            status: "error",
            error:
              error instanceof Error ? error.message : "Evidence unavailable.",
          });
      })
      .finally(() => window.clearTimeout(timeout));
    function timedOut() {
      if (isCurrent() && controller.signal.aborted)
        useTactics.setState({
          status: "error",
          error: "Evidence request timed out. Retry when the API is available.",
        });
    }
    controller.signal.addEventListener("abort", timedOut);
    return () => {
      ignore = true;
      controller.signal.removeEventListener("abort", timedOut);
      controller.abort();
      window.clearTimeout(timeout);
    };
  }, [bundle, attempt, scenario]);

  return <TacticalPanelView time={time} state={state} onWatch={onWatch} />;
}

/**
 * Present the active/guided finding before optional measurements and layer controls.
 * Primary Watch actions play whole sequences; supporting details keep their precise evidence interval.
 */
export function TacticalPanelView({
  time,
  state,
  onWatch,
}: {
  time: number;
  state: TacticalState;
  onWatch?: () => void;
}) {
  const scenario = useReplay((s) => s.scenario);
  const guided = useReplay((s) => s.guided);
  const playerById = Object.fromEntries(scenario.players.map((p) => [p.id, p]));
  const { enabled, bundle, status, layers, error } = state;
  const controls = state;
  const moment = bundle
    ? (bundle.moments.find(
        (m) =>
          guided?.scenarioId === scenario.id &&
          guided.sourceHash === bundle.sourceHash &&
          m.id === guided.momentId,
      ) ?? momentAt(bundle, time))
    : null;
  const frame = bundle ? frameAt(bundle, time).a : null;
  const facts =
    bundle && moment
      ? moment.evidenceIds
          .map((id) => bundle.evidence.find((e) => e.id === id)!)
          .filter(Boolean)
      : [];
  const lead = facts.find((f) => f.id === moment?.primaryEvidenceId);
  const editorial = moment ? presentMoment(moment, scenario) : null;
  function watch(id: string, kind: "moment" | "evidence" = "evidence") {
    if (!bundle || !moment) return;
    replayStore.getState().startGuided(bundle, id, moment.id, kind);
    onWatch?.();
  }
  return (
    <section
      className="tactical-panel"
      id="analysis"
      tabIndex={-1}
      aria-label="Tactical analysis"
    >
      <div className="tactical-heading">
        <div>
          <p className="eyebrow">Watch. Understand. Explore.</p>
          <h2>Tactical intelligence</h2>
        </div>
        <button
          className="analysis-toggle"
          aria-pressed={enabled}
          onClick={() => {
            replayStore.getState().closeGuided();
            controls.setEnabled(!enabled);
          }}
        >
          {enabled ? "Return to replay" : "Analyze this moment"}
        </button>
      </div>
      {!enabled && (
        <p className="tactical-intro">
          Follow four connected sequences: the run, the passing move, the
          arrival and the finish. Each replay includes the surrounding play.
        </p>
      )}
      {enabled && (
        <>
          {status === "loading" && (
            <p className="evidence-message" aria-live="polite">
              Loading measured evidence…
            </p>
          )}
          {status === "error" && (
            <div className="evidence-message" role="alert">
              <p>{error} Replay remains available.</p>
              <button onClick={controls.retry}>Retry evidence</button>
            </div>
          )}
          {bundle && moment && frame && editorial && (
            <>
              <div className="tactical-layers">
                {(Object.keys(layerNames) as Layer[]).map((layer) => (
                  <label key={layer}>
                    <input
                      type="checkbox"
                      checked={layers[layer]}
                      onChange={() => controls.toggleLayer(layer)}
                    />
                    {layerNames[layer]}
                  </label>
                ))}
              </div>
              <div className="tactical-moments" aria-label="Tactical moments">
                {bundle.moments.map((m, i) => (
                  <button
                    key={m.id}
                    aria-pressed={m.id === moment.id}
                    onClick={() => {
                      replayStore.getState().pause();
                      replayStore.getState().seek(m.focusTime);
                    }}
                  >
                    <span>0{i + 1}</span>
                    {m.title}
                    <time>
                      {m.start.toFixed(1)}–{m.end.toFixed(1)}s
                    </time>
                  </button>
                ))}
              </div>
              <div className="analysis-content">
                <div className="primary-finding">
                  <p className="finding-context">
                    <span data-testid="tactical-moment-title">
                      {moment.title}
                    </span>{" "}
                    <span>
                      {moment.start.toFixed(1)}–{moment.end.toFixed(1)} s
                    </span>
                  </p>
                  <h3>{editorial.title}</h3>
                  <h4>What happened</h4>
                  <p>{editorial.happened}</p>
                  <h4>Why it matters</h4>
                  <p>{editorial.why}</p>
                  {lead && (
                    <button
                      className="watch-primary"
                      onClick={() => watch(lead.id, "moment")}
                    >
                      <span aria-hidden="true">▶</span> Show me in the replay
                    </button>
                  )}
                  <p className="involved-players">
                    {moment.playerIds
                      .map((id) => playerById[id].name)
                      .join(" · ")}
                  </p>
                  <p className="evidence-qualification">
                    Based on recorded geometry and an authored tactical reading.
                    Intent and alternative outcomes are unknown.
                  </p>
                </div>
                <div className="evidence-list">
                  <h3>Look closer</h3>
                  {supportingInsights(facts, moment.focus).map((f) => {
                    const copy = presentEvidence(f, scenario);
                    return (
                      <details
                        key={f.id}
                        className="evidence-item insight-card"
                        data-evidence-id={f.id}
                      >
                        <summary>
                          <span className="insight-icon" aria-hidden="true">
                            {copy.icon}
                          </span>
                          {copy.title}
                        </summary>
                        <p>{copy.sentence}</p>
                        <p className="involved-players">
                          {f.playerIds
                            .map((id) => playerById[id].name)
                            .join(" · ")}
                        </p>
                        <button onClick={() => watch(f.id)}>
                          Watch this
                          <span className="sr-only">: {copy.title}</span>
                        </button>
                      </details>
                    );
                  })}
                </div>
              </div>
              <details className="measurement-details">
                <summary>How we measured this</summary>
                <p>
                  Source-validated synthetic geometry. Exact observations are
                  separate from authored interpretation.
                </p>
                <p className="provenance">
                  Scenario {bundle.scenarioId} · Version {bundle.version}
                  <br />
                  Validated SHA-256: <code>{bundle.sourceHash}</code>
                </p>
                <div className="live-measures" data-testid="live-metrics">
                  <span>
                    Nearest to receiving point{" "}
                    <b>{frame.space.nearestDistance.toFixed(2)} m</b>
                  </span>
                  <span>
                    Within {frame.space.radius} m{" "}
                    <b>{frame.space.defendersWithinRadius} defenders</b>
                  </span>
                  <span>
                    Measured at <b>{frame.t.toFixed(2)} s</b>
                  </span>
                </div>
                {moment.focus !== "finish" && (
                  <div
                    className={`corridor-state ${frame.corridor.state}`}
                    data-testid="corridor-state"
                  >
                    {frame.corridor.kind === "observed_travel"
                      ? "Recorded pass · full travel interval"
                      : "Proposed corridor · static geometry"}
                    <strong>
                      {frame.corridor.state} under geometric thresholds
                    </strong>
                  </div>
                )}
                {lead && (
                  <p data-testid="primary-observation">{lead.observation}</p>
                )}
                <p>
                  <b>Authored interpretation</b> — {moment.interpretation}
                </p>
                {facts.map((f) => (
                  <details key={f.id} className="evidence-item technical-fact">
                    <summary>{f.title}</summary>
                    <p>{f.observation}</p>
                    <dl>
                      {f.metrics.map((m) => (
                        <div key={m.name}>
                          <dt>
                            {m.name}
                            <small>{m.definition}</small>
                          </dt>
                          <dd>{formatMetric(m)}</dd>
                        </div>
                      ))}
                    </dl>
                    <p>{f.limitations.join(" ")}</p>
                    <small>{f.id}</small>
                    <button onClick={() => watch(f.id)}>
                      Watch this<span className="sr-only">: {f.title}</span>
                    </button>
                  </details>
                ))}
                <h4>Definitions & limitations</h4>
                {bundle.assumptions.map((a) => (
                  <p key={a}>{a}</p>
                ))}
                <p>
                  Corridor half-width {bundle.thresholds.corridorHalfWidth} m;
                  contested margin {bundle.thresholds.contestedMargin} m;
                  coverage radius {bundle.thresholds.coverageRadius} m. Sample
                  step {bundle.sampleStep} s.
                </p>
                <p>
                  A faint route shows the full selected interval; the bright
                  trace follows replay time along recorded positions. A region
                  boundary is a measurement radius. Temporal sequence does not
                  establish causation; no counterfactual or awareness inference.
                </p>
              </details>
            </>
          )}
        </>
      )}
    </section>
  );
}
