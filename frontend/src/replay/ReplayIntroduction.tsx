/** A small, optional introduction; no modal, timer, account or stored preference. */
export function ReplayIntroduction({ studio = false }: { studio?: boolean }) {
  return (
    <aside
      className="replay-introduction"
      aria-label="Getting started with the replay"
    >
      <p>
        <strong>Watch a passage. Discover the detail.</strong> This is an
        original synthetic reconstruction, not full-match tracking.
      </p>
      <details>
        <summary>How to explore</summary>
        <ol>
          <li>
            <strong>Watch.</strong> Press Play, pause, or drag the timeline to
            any moment.
          </li>
          <li>
            <strong>Change perspective.</strong>{" "}
            {studio
              ? "Choose a camera or select a player for Follow Player and simulated POV."
              : "Try Overview, or open Replay Studio for player views."}
          </li>
          <li>
            <strong>Understand.</strong> Request a Casual Fan explanation or a
            closer Analyst reading. Commentary starts only when requested.
          </li>
          <li>
            <strong>Explore evidence.</strong> Choose Show me why to watch a
            verified observation. Close the guided replay to return to your
            place.
          </li>
        </ol>
      </details>
    </aside>
  );
}
