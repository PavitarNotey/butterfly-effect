import type { Intelligence } from "./client";

/**
 * Map backend/network failure categories to concise viewer-safe retry guidance.
 */
export function analysisErrorMessage(error: Error) {
  if (/budget|allowance|paused|cost protection/i.test(error.message))
    return "New analysis is paused by the application’s usage controls. Saved analysis, replay and measured evidence remain available.";
  if (/quota|rate|limit/i.test(error.message))
    return "Analysis is at its request limit. Try again shortly.";
  if (/timed|too long/i.test(error.message))
    return "Analysis is taking too long. Try again.";
  if (
    /configuration|disabled|credentials|deployment|access/i.test(error.message)
  )
    return "AI analysis is unavailable right now. Try again later.";
  return "Analysis could not be loaded. Check the connection and try again.";
}

/**
 * Derive presentation status while preserving the distinct authored-fallback state.
 */
export function analysisState(
  data: Intelligence | null,
  pending: boolean,
  error: Error | null,
) {
  return pending
    ? "loading"
    : error
      ? "error"
      : data?.provider === "validation_fallback"
        ? "fallback"
        : data
          ? "ready"
          : "idle";
}

const segmenter = new Intl.Segmenter("en", { granularity: "sentence" });
/**
 * Segment prose for response-driven reveals while preserving its exact text when joined.
 */
export function narrativeSentences(text: string) {
  return Array.from(segmenter.segment(text), (part) => part.segment);
}
