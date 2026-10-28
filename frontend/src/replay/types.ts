/** Generated Pydantic/OpenAPI contracts. X length, Y up, Z width; metres/seconds/radians. */
import type { components } from "../api/schema";
export type Scenario = components["schemas"]["Scenario"];
export type Player = components["schemas"]["Player"];
export type PositionKey = components["schemas"]["PositionKey"];
export type FacingKey = components["schemas"]["FacingKey"];
// The event union includes a typed non-contact dummy; it is not a foot-contact action.
export type MatchEvent = Scenario["events"][number];
export type Vec3 = PositionKey["position"];
