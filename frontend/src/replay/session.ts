import { replayStore } from './store'
import { useTactics } from '../tactics/store'
import { neutralLook } from './gaze'

/** Explicit ownership at route boundaries, including re-entry to the same scenario. */
export function resetReplaySession(scenarioId: string, startTime = 0) {
  const state = replayStore.getState()
  state.pause()
  state.closeGuided()
  state.setScenario(scenarioId)
  useTactics.getState().reset()
  replayStore.setState({ playing: false, scrubbing: false, resumeAfterScrub: false, camera: 'broadcast', tacticalView: null, selectedId: null, trails: false, guided: null, freeLook: neutralLook, speed: 1 })
  replayStore.getState().seek(startTime)
}
