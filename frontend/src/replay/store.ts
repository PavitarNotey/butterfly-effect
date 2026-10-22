import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { clampTime } from './sample'
import { constrainTacticalView } from './camera'
import { scenario, scenarios } from './scenario'
import type { Scenario } from './types'
import { useTactics } from '../tactics/store'

export type CameraMode = 'broadcast' | 'tactical' | 'overview' | `pov:${string}`
export interface TacticalView { center: [number, number]; height: number }
export type PlaybackSpeed = 0.5 | 1 | 2
export interface ReplayState {
  scenario: Scenario
  setScenario: (id: string) => void
  anchorTime: number
  anchorWall: number
  playing: boolean
  scrubbing: boolean
  resumeAfterScrub: boolean
  speed: PlaybackSpeed
  camera: CameraMode
  tacticalView: TacticalView | null
  setTacticalView: (view: TacticalView) => void
  resetTacticalView: () => void
  selectedId: string
  trails: boolean
  readTime: (now?: number) => number
  play: () => void
  pause: () => void
  restart: () => void
  beginScrub: () => void
  endScrub: () => void
  seek: (t: number) => void
  setSpeed: (speed: PlaybackSpeed) => void
  setCamera: (camera: CameraMode) => void
  selectPlayer: (id: string) => void
  toggleTrails: () => void
}

/** Absolute wall-time anchor. Render frames sample this clock; they never accumulate dt. */
export function createReplayStore(now: () => number = () => performance.now()) {
  return createStore<ReplayState>()((set, get) => ({
    scenario,
    setScenario: id => {
      const next = scenarios.find(s => s.id === id)
      if (!next || next.id === get().scenario.id) return
      useTactics.getState().reset()
      set({ scenario: next, anchorTime: 0, anchorWall: now(), playing: false, scrubbing: false, resumeAfterScrub: false, camera: 'broadcast', tacticalView: null, selectedId: next.relevantPlayerIds[0] ?? next.players[0].id, trails: false })
    },
    anchorTime: 0, anchorWall: now(), playing: false, speed: 1, scrubbing: false, resumeAfterScrub: false,
    camera: 'broadcast', tacticalView: null, selectedId: scenario.relevantPlayerIds[0] ?? scenario.players[0].id, trails: false,
    readTime: (wall = now()) => {
      const s = get()
      return clampTime(s.anchorTime + (s.playing ? Math.max(0, wall - s.anchorWall) / 1000 * s.speed : 0), get().scenario.duration)
    },
    play: () => set({ anchorTime: get().readTime() >= get().scenario.duration ? 0 : get().readTime(), anchorWall: now(), playing: true, scrubbing: false, resumeAfterScrub: false }),
    pause: () => set({ anchorTime: get().readTime(), anchorWall: now(), playing: false, resumeAfterScrub: false }),
    restart: () => set({ anchorTime: 0, anchorWall: now(), playing: get().playing || get().resumeAfterScrub, scrubbing: false, resumeAfterScrub: false }),
    beginScrub: () => {
      if (!get().scrubbing) set({ anchorTime: get().readTime(), anchorWall: now(), resumeAfterScrub: get().playing, playing: false, scrubbing: true })
    },
    endScrub: () => {
      if (get().scrubbing) set({ anchorWall: now(), playing: get().resumeAfterScrub && get().anchorTime < get().scenario.duration, scrubbing: false, resumeAfterScrub: false })
    },
    seek: t => set({ anchorTime: clampTime(t, get().scenario.duration), anchorWall: now() }),
    setSpeed: speed => {
      if ([.5, 1, 2].includes(speed)) set({ anchorTime: get().readTime(), anchorWall: now(), speed })
    },
    setCamera: camera => {
      if (camera === 'broadcast' || camera === 'tactical' || camera === 'overview' || (camera.startsWith('pov:') && get().scenario.players.some(p => p.id === camera.slice(4)))) set({ camera, tacticalView: null })
    },
    setTacticalView: view => {
      if ((get().camera === 'tactical' || get().camera === 'overview') && [...view.center, view.height].every(Number.isFinite)) set({ tacticalView: constrainTacticalView(get().scenario, view) })
    },
    resetTacticalView: () => set({ tacticalView: null }),
    selectPlayer: id => { if (get().scenario.players.some(p => p.id === id)) set({ selectedId: id }) },
    toggleTrails: () => set(s => ({ trails: !s.trails })),
  }))
}
export const replayStore = createReplayStore()
export const useReplay = <T,>(selector: (s: ReplayState) => T) => useStore(replayStore, selector)
