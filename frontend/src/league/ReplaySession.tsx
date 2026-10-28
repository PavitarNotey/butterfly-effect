import { lazy, Suspense, useLayoutEffect } from "react";
import { Link } from "react-router";
import ReplayStudio from "../ReplayStudio";
import { scenarios } from "../replay/scenario";
import { resetReplaySession } from "../replay/session";
import { replayStore } from "../replay/store";
import { resolveReplay } from "./replayReference";
import type { MatchDetail } from "./types";

const MatchViewer = lazy(() => import("./MatchViewer"));

/**
 * Reset route-owned replay state before paint and dispose it when ownership changes.
 */
function OwnedReplay({
  scenarioId,
  startTime,
  studio,
  analysisPath,
}: {
  scenarioId: string;
  startTime: number;
  studio: boolean;
  analysisPath: string;
}) {
  // Layout effects run before the canvas is displayed. Only this route owns it.
  useLayoutEffect(() => {
    resetReplaySession(scenarioId, startTime);
    return () => resetReplaySession(scenarioId);
  }, [scenarioId, startTime]);
  return studio ? (
    <ReplayStudio embedded />
  ) : (
    <Suspense
      fallback={<div className="viewer-loading">Preparing the 3D viewer…</div>}
    >
      <MatchViewer analysisPath={analysisPath} />
    </Suspense>
  );
}

/**
 * Resolve the exact league-to-canonical link before mounting its keyed viewer/studio session.
 */
export default function ReplaySession({
  match,
  eventId,
  studio,
  analysisPath,
}: {
  match: MatchDetail;
  eventId: string;
  studio: boolean;
  analysisPath: string;
}) {
  const resolved = resolveReplay(match, eventId, scenarios);
  if (!resolved)
    return (
      <div className="data-state" role="alert">
        <h2>This replay reference could not be verified.</h2>
        <p>Return to the match to explore its recorded events.</p>
        <Link to={`/matches/${match.id}`}>Return to Match Center →</Link>
      </div>
    );
  return (
    <OwnedReplay
      key={`${match.id}:${eventId}:${studio}`}
      scenarioId={resolved.scenario.id}
      startTime={studio ? resolved.reference.startTime : 0}
      studio={studio}
      analysisPath={analysisPath}
    />
  );
}

/**
 * Own library-level replay initialization and cleanup while ordinary scenario switches retain the canvas.
 */
export function ScenarioLibrary() {
  useLayoutEffect(() => {
    resetReplaySession("the-invisible-run");
    return () => resetReplaySession(replayStore.getState().scenario.id);
  }, []);
  return <ReplayStudio withinShell />;
}
