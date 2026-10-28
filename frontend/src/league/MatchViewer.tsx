import { memo, useEffect } from "react";
import { Link } from "react-router";
import { ReplayScene } from "../replay/ReplayScene";
import { Timeline } from "../replay/Timeline";
import { useReplayTime } from "../replay/useReplayTime";
import { replayStore, useReplay } from "../replay/store";
import { GuidedHUD } from "../tactics/GuidedHUD";
import { ReplayIntroduction } from "../replay/ReplayIntroduction";

// The DOM timer samples at 20 Hz; it must not reconcile all 22 rigs with it.
const MatchScene = memo(ReplayScene);

/**
 * Compose the compact Match Center viewer around the shared scene/store and explicit Studio navigation.
 */
export default function MatchViewer({
  analysisPath,
}: {
  analysisPath: string;
}) {
  const time = useReplayTime();
  const scenario = useReplay((s) => s.scenario);
  const playing = useReplay((s) => s.playing);
  const camera = useReplay((s) => s.camera);
  const guided = useReplay((s) => s.guided !== null);
  const actions = replayStore.getState();
  useEffect(() => {
    const preference = matchMedia("(prefers-reduced-motion: reduce)");
    const sync = () =>
      replayStore.getState().setReducedMotion(preference.matches);
    sync();
    preference.addEventListener("change", sync);
    return () => preference.removeEventListener("change", sync);
  }, []);
  function seek(t: number) {
    actions.pause();
    actions.seek(t);
  }
  return (
    <section className="match-viewer" aria-label="Match replay preview">
      <div className="viewer-topline">
        <span className="section-kicker">INSIDE THE MOMENT</span>
        <span>INTERACTIVE 3D · SYNTHETIC REPLAY</span>
      </div>
      <div
        className={`viewport match-viewport${guided ? " is-guided" : ""}`}
        data-testid="match-viewer"
        data-scenario={scenario.id}
        data-camera={camera}
      >
        <MatchScene />
        <GuidedHUD
          time={time}
          onBack={() => {
            const button = document.querySelector<HTMLElement>(
              '[data-testid="show-me-why"]',
            );
            button?.scrollIntoView({ behavior: "instant", block: "center" });
            button?.focus({ preventScroll: true });
          }}
        />
        {!guided && (
          <div className="viewer-caption">
            <span className="viewer-tag">
              {camera === "broadcast" ? "Broadcast" : "Tactical overview"}
            </span>
            <span>{scenario.title}</span>
          </div>
        )}
      </div>
      <ReplayIntroduction />
      <div className="viewer-controls">
        <div className="viewer-buttons">
          <button
            className="site-button primary compact"
            aria-label={playing ? "Pause preview" : "Play preview"}
            onClick={() => (playing ? actions.pause() : actions.play())}
          >
            {playing ? "Ⅱ Pause" : "▶ Play"}
          </button>
          <button
            className="site-button compact"
            aria-label="Restart preview"
            onClick={actions.restart}
          >
            ↺ Restart
          </button>
          <span className="viewer-time" data-testid="preview-time">
            {time.toFixed(1)} / {scenario.duration.toFixed(1)} s
          </span>
          <div className="viewer-cameras" aria-label="Preview camera">
            <button
              aria-pressed={camera === "broadcast"}
              onClick={() => actions.setCamera("broadcast")}
            >
              Broadcast
            </button>
            <button
              aria-pressed={camera === "overview"}
              onClick={() => actions.setCamera("overview")}
            >
              Overview
            </button>
          </div>
        </div>
        <Timeline time={time} onMoment={seek} showMarkers={false} />
      </div>
      <div className="viewer-footnote">
        <p>
          A short reconstructed passage, separate from the full match result.
        </p>
        <Link className="text-link" to={analysisPath}>
          Open full analysis <span aria-hidden="true">↗</span>
        </Link>
      </div>
    </section>
  );
}
