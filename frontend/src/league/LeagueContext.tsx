import { createContext, useContext } from "react";
import type { League } from "./types";

export const LeagueContext = createContext<League | null>(null);
/**
 * Read the validated league provided by the shell; fail explicitly when the provider is missing.
 */
export function useLeague() {
  const league = useContext(LeagueContext);
  if (!league) throw new Error("League page requires a verified competition");
  return league;
}
