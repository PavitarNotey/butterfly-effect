/** League types follow generated API contracts; replay references distinguish reconstructed passages from metadata-only events. */
import type { components } from "../api/schema";

export type League = components["schemas"]["League"];
export type Club = components["schemas"]["Club"];
export type FixtureSummary = components["schemas"]["FixtureSummary"];
export type Fixture = Omit<FixtureSummary, "analyzedEvent">;
export type MatchDetail = components["schemas"]["MatchDetail"];
export type MatchKeyEvent = components["schemas"]["MatchKeyEvent"];
export type ReplayReference = components["schemas"]["ReplayReference"];
export type StandingsRow = components["schemas"]["StandingsRow"];
