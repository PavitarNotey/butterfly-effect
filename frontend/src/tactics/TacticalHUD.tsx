import { replayStore, useReplay } from "../replay/store";
import { frameAt, momentAt } from "./data";
import { useTactics } from "./store";
import type { Layer } from "./types";
import { MomentPicker } from "./MomentPicker";

/** Compact controls stay beside the picture; detailed evidence remains below the replay. */
export function TacticalHUD({ time }: { time: number }) {
  const guided = useReplay((s) => s.guided !== null);
  const selected = useReplay((s) =>
    s.selectedId
      ? s.scenario.players.find((player) => player.id === s.selectedId)
      : null,
  );
  const state = useTactics();
  if (guided || !state.enabled || !state.bundle) return null;
  const moment = momentAt(state.bundle, time),
    frame = frameAt(state.bundle, time).a;
  const labels: [Layer, string][] = [
    ["passing", "Lane"],
    ["movement", "Runs"],
    ["space", "Space"],
    ["relationships", "Links"],
  ];
  return (
    <div className="tactical-hud" aria-label="Replay tactical controls">
      <div className="hud-title">
        <span>TACTICAL VIEW</span>
        <button
          aria-label="Exit tactical view"
          onClick={() => state.setEnabled(false)}
        >
          ×
        </button>
      </div>
      <MomentPicker
        key={state.bundle.scenarioId}
        moments={state.bundle.moments}
        selectedId={moment.id}
        onSelect={(selected) => {
          replayStore.getState().pause();
          replayStore.getState().seek(selected.focusTime);
        }}
      />
      <div className="hud-layers">
        {labels.map(([layer, label]) => (
          <button
            key={layer}
            aria-label={`Toggle ${layer} overlay`}
            aria-pressed={state.layers[layer]}
            onClick={() => state.toggleLayer(layer)}
          >
            {label}
          </button>
        ))}
      </div>
      <p>
        {moment.focus === "finish"
          ? "Recorded shot path"
          : `${frame.corridor.state} · ${frame.corridor.kind === "observed_travel" ? "recorded pass" : "static corridor"}`}
        {selected ? (
          <span data-testid="tactical-selected-player">
            Selected {selected.number} · {selected.name}
          </span>
        ) : null}
        <span>Measured {frame.t.toFixed(2)}s</span>
      </p>
    </div>
  );
}
