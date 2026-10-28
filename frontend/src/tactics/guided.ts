import type { CameraMode, PlaybackSpeed, TacticalView } from "../replay/store";
import { samplePosition } from "../replay/sample";
import type { Scenario } from "../replay/types";
import type { EvidenceBundle, Layer } from "./types";
import { evidenceLayer, presentEvidence } from "./presentation";

export interface RestorationContext {
  time: number;
  camera: CameraMode;
  tacticalView: TacticalView | null;
  selectedId: string | null;
  speed: PlaybackSpeed;
  enabled: boolean;
  layers: Record<Layer, boolean>;
}
export interface GuidedReplay {
  kind: "moment" | "evidence";
  scenarioId: string;
  sourceHash: string;
  evidenceId: string;
  momentId: string;
  startTime: number;
  endTime: number;
  focusTime: number;
  relevantPlayerIds: string[];
  layer: Layer;
  category: EvidenceBundle["evidence"][number]["category"];
  preferredCamera: CameraMode;
  title: string;
  caption: string;
  status: "playing" | "paused" | "complete";
  speed: PlaybackSpeed;
  restoration: RestorationContext;
  dummyEventId?: string;
  layers: Record<Layer, boolean>;
  followBounds?: { minX: number; maxX: number; minZ: number; maxZ: number };
}

/** Input must be the current hash-validated bundle, never an arbitrary fact object.
 *
 * @param bundle - Already source-hash-validated evidence for the active scenario.
 * @param scenario - Canonical identities and replay bounds.
 * @param evidenceId - Exact observation owned by momentId.
 * @param momentId - Curated sequence containing the observation.
 * @param restoration - Original user context retained across guide changes.
 * @param kind - Whole sequence bounds or a padded evidence-detail interval.
 * @returns Playback/overlay/camera instructions without mutating any store.
 * @throws If identities, membership or timeline bounds do not match.
 */
export function resolveGuided(
  bundle: EvidenceBundle,
  scenario: Scenario,
  evidenceId: string,
  momentId: string,
  restoration: RestorationContext,
  kind: GuidedReplay["kind"] = "evidence",
): GuidedReplay {
  const evidence = bundle.evidence.find((e) => e.id === evidenceId);
  const moment = bundle.moments.find((m) => m.id === momentId);
  if (
    bundle.scenarioId !== scenario.id ||
    !bundle.sourceHash ||
    !evidence ||
    !moment?.evidenceIds.includes(evidenceId) ||
    evidence.playerIds.some((id) => !scenario.players.some((p) => p.id === id))
  )
    throw new Error("Guided evidence does not match this replay");
  if (
    ![evidence.start, evidence.end].every(Number.isFinite) ||
    evidence.start < 0 ||
    evidence.end > scenario.duration ||
    evidence.end < evidence.start
  )
    throw new Error("Invalid guided interval");
  const copy = presentEvidence(evidence, scenario);
  const dummy =
    evidence.category === "corridor"
      ? scenario.events.find(
          (e) => e.type === "dummy" && evidence.eventIds.includes(e.id),
        )
      : undefined;
  const sequence = kind === "moment";
  const layer = evidenceLayer[evidence.category];
  const layers = {
    passing: false,
    movement: false,
    space: false,
    relationships: false,
    [layer]: true,
  };
  if (sequence && moment.focus === "corridor") layers.movement = true;
  if (sequence && moment.focus === "space") layers.relationships = true;
  const follow = sequence && moment.followPlayerId;
  const route = follow
    ? moment.movements.find((m) => m.playerId === follow)?.path
    : undefined;
  if (
    sequence &&
    (![moment.start, moment.focusTime, moment.end].every(Number.isFinite) ||
      moment.start < 0 ||
      moment.start >= moment.end ||
      moment.focusTime < moment.start ||
      moment.focusTime > moment.end ||
      moment.end > scenario.duration)
  )
    throw new Error("Invalid guided sequence");
  return {
    kind,
    layers,
    scenarioId: scenario.id,
    sourceHash: bundle.sourceHash,
    evidenceId,
    momentId,
    startTime: sequence ? moment.start : Math.max(0, evidence.start - 0.65),
    endTime: sequence
      ? moment.end
      : Math.min(
          scenario.duration,
          evidence.end + (evidence.category === "finish" ? 1.1 : 0.65),
        ),
    focusTime: sequence
      ? moment.focusTime
      : (evidence.start + evidence.end) / 2,
    relevantPlayerIds: sequence
      ? moment.playerIds
      : evidence.category === "corridor" || evidence.category === "finish"
        ? [...new Set([...evidence.playerIds, ...moment.playerIds])]
        : evidence.playerIds,
    layer,
    category: evidence.category,
    preferredCamera: follow
      ? `follow:${follow}`
      : evidence.category === "finish" || dummy
        ? "broadcast"
        : "tactical",
    ...(route
      ? {
          followBounds: {
            minX: Math.min(...route.map((p) => p.position[0])),
            maxX: Math.max(...route.map((p) => p.position[0])),
            minZ: Math.min(...route.map((p) => p.position[2])),
            maxZ: Math.max(...route.map((p) => p.position[2])),
          },
        }
      : {}),
    ...(dummy ? { dummyEventId: dummy.id } : {}),
    title: sequence ? moment.title : copy.title,
    caption: sequence ? moment.interpretation : copy.sentence,
    status: "playing",
    speed:
      evidence.category === "finish" || evidence.category === "corridor"
        ? 0.5
        : 1,
    restoration,
  };
}
/**
 * Fit an overhead view around relevant players across the full validated guided interval.
 * Interior canonical bends matter as well as endpoints; non-tactical guides return null.
 */
export function guidedFraming(
  guided: GuidedReplay,
  scenario: Scenario,
): TacticalView | null {
  if (guided.preferredCamera !== "tactical") return null;
  const points = guided.relevantPlayerIds.flatMap((id) => {
    const p = scenario.players.find((p) => p.id === id)!;
    return [
      samplePosition(p.positions, guided.startTime),
      ...p.positions
        .filter((k) => k.t > guided.startTime && k.t < guided.endTime)
        .map((k) => k.position),
      samplePosition(p.positions, guided.endTime),
    ];
  });
  if (guided.category === "space" || guided.category === "corridor")
    points.push(samplePosition(scenario.ball, guided.focusTime));
  const xs = points.map((p) => p[0]),
    zs = points.map((p) => p[2]);
  const x = (Math.min(...xs) + Math.max(...xs)) / 2,
    z = (Math.min(...zs) + Math.max(...zs)) / 2;
  return {
    center: [x, z],
    height: Math.min(
      90,
      Math.max(
        34,
        (Math.max(...xs) - Math.min(...xs) + 20) * 0.95,
        (Math.max(...zs) - Math.min(...zs) + 22) * 1.2,
      ),
    ),
  };
}
