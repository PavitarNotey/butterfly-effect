import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { clampTime } from './sample'
import { constrainTacticalView } from './camera'
import { scenario, scenarios } from './scenario'
import type { Scenario } from './types'
import { useTactics } from '../tactics/store'
import { guidedFraming, resolveGuided } from '../tactics/guided'
import type { GuidedReplay } from '../tactics/guided'
import type { EvidenceBundle } from '../tactics/types'
import { constrainFreeLook, neutralLook } from './gaze'
import type { FreeLook } from './gaze'

export type CameraMode = 'broadcast' | 'tactical' | 'overview' | `pov:${string}` | `follow:${string}`
export interface TacticalView { center: [number, number]; height: number }
export type PlaybackSpeed = 0.5 | 1 | 2
export interface ReplayState {
  scenario: Scenario
  guided: GuidedReplay | null
  startGuided: (bundle: EvidenceBundle, evidenceId: string, momentId: string, kind?: GuidedReplay['kind']) => void
  replayGuided: () => void
  closeGuided: () => void
  completeGuided: () => void
  freeLook: FreeLook
  setFreeLook: (look: FreeLook) => void
  resetFreeLook: () => void
  reducedMotion: boolean
  setReducedMotion: (enabled: boolean) => void
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
  selectedId: string | null
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
  selectPlayer: (id: string | null) => void
  toggleTrails: () => void
}

/** Absolute wall-time anchor. Render frames sample this clock; they never accumulate dt. */
export function createReplayStore(now: () => number = () => performance.now()) {
  return createStore<ReplayState>()((set, get) => {
    function releaseGuided() {
      const guide = get().guided
      if (!guide) return
      const currentTime = get().readTime()
      useTactics.setState({ enabled: guide.restoration.enabled, layers: guide.restoration.layers })
      set({ guided: null, anchorTime: currentTime, anchorWall: now(), speed: guide.restoration.speed, playing: false })
    }
    return ({
    scenario,
    guided: null, freeLook: neutralLook, reducedMotion: false,
    setReducedMotion: reducedMotion => set({ reducedMotion }),
    setFreeLook: look => { if (!get().playing && get().camera.startsWith('pov:')) set({ freeLook: constrainFreeLook(look) }) },
    resetFreeLook: () => set({ freeLook: neutralLook }),
    startGuided: (bundle, evidenceId, momentId, kind) => {
      const current = get(), tactics = useTactics.getState()
      if (tactics.bundle !== bundle || tactics.status !== 'ready') return
      const restoration = current.guided?.restoration ?? { time: current.readTime(), camera: current.camera, tacticalView: current.tacticalView, selectedId: current.selectedId, speed: current.speed, enabled: tactics.enabled, layers: { ...tactics.layers } }
      const guided = resolveGuided(bundle, current.scenario, evidenceId, momentId, restoration, kind)
      useTactics.setState({ enabled: true, layers: guided.layers })
      set({ guided, anchorTime: guided.startTime, anchorWall: now(), playing: true, scrubbing: false, resumeAfterScrub: false, speed: guided.speed, camera: guided.preferredCamera, tacticalView: guidedFraming(guided, current.scenario), selectedId: guided.relevantPlayerIds[0], freeLook: neutralLook })
    },
    replayGuided: () => {
      const guided = get().guided, bundle = useTactics.getState().bundle
      if (guided && bundle?.sourceHash === guided.sourceHash && bundle.scenarioId === get().scenario.id) set({ anchorTime: guided.startTime, anchorWall: now(), playing: true, guided: { ...guided, status: 'playing' } })
    },
    completeGuided: () => {
      const guided = get().guided
      if (guided) set({ anchorTime: guided.endTime, anchorWall: now(), playing: false, guided: { ...guided, status: 'complete' } })
    },
    closeGuided: () => {
      const restore = get().guided?.restoration
      if (!restore) return
      releaseGuided()
      set({ anchorTime: restore.time, camera: restore.camera, tacticalView: restore.tacticalView, selectedId: restore.selectedId, freeLook: neutralLook })
    },
    setScenario: id => {
      const next = scenarios.find(s => s.id === id)
      if (!next || next.id === get().scenario.id) return
      releaseGuided()
      useTactics.getState().reset()
      set({ scenario: next, anchorTime: 0, anchorWall: now(), playing: false, scrubbing: false, resumeAfterScrub: false, camera: 'broadcast', tacticalView: null, selectedId: null, trails: false, guided: null, freeLook: neutralLook })
    },
    anchorTime: 0, anchorWall: now(), playing: false, speed: 1, scrubbing: false, resumeAfterScrub: false,
    camera: 'broadcast', tacticalView: null, selectedId: null, trails: false,
    readTime: (wall = now()) => {
      const s = get()
      return Math.min(s.guided?.endTime ?? s.scenario.duration, clampTime(s.anchorTime + (s.playing ? Math.max(0, wall - s.anchorWall) / 1000 * s.speed : 0), s.scenario.duration))
    },
    play: () => { if (get().guided?.status === 'complete') { get().replayGuided(); return }; set({ freeLook: neutralLook, guided: get().guided ? { ...get().guided!, status: 'playing' } : null, anchorTime: get().readTime() >= get().scenario.duration ? 0 : get().readTime(), anchorWall: now(), playing: true, scrubbing: false, resumeAfterScrub: false }) },
    pause: () => set({ guided: get().guided ? { ...get().guided!, status: 'paused' } : null, anchorTime: get().readTime(), anchorWall: now(), playing: false, resumeAfterScrub: false }),
    restart: () => { releaseGuided(); set({ freeLook: neutralLook, anchorTime: 0, anchorWall: now(), playing: get().playing || get().resumeAfterScrub, scrubbing: false, resumeAfterScrub: false }) },
    beginScrub: () => {
      releaseGuided()
      if (!get().scrubbing) set({ anchorTime: get().readTime(), anchorWall: now(), resumeAfterScrub: get().playing, playing: false, scrubbing: true })
    },
    endScrub: () => {
      if (get().scrubbing) set({ anchorWall: now(), playing: get().resumeAfterScrub && get().anchorTime < get().scenario.duration, scrubbing: false, resumeAfterScrub: false })
    },
    seek: t => { releaseGuided(); set({ anchorTime: clampTime(t, get().scenario.duration), anchorWall: now() }) },
    setSpeed: speed => {
      releaseGuided()
      if ([.5, 1, 2].includes(speed)) set({ anchorTime: get().readTime(), anchorWall: now(), speed })
    },
    setCamera: camera => {
      releaseGuided()
      const playerCamera = camera.startsWith('pov:') || camera.startsWith('follow:')
      if (camera === 'broadcast' || camera === 'tactical' || camera === 'overview' || (playerCamera && get().scenario.players.some(p => p.id === camera.slice(camera.indexOf(':') + 1)))) set({ camera, tacticalView: null, freeLook: neutralLook })
    },
    setTacticalView: view => {
      releaseGuided()
      if ((get().camera === 'tactical' || get().camera === 'overview') && [...view.center, view.height].every(Number.isFinite)) set({ tacticalView: constrainTacticalView(get().scenario, view) })
    },
    resetTacticalView: () => { releaseGuided(); set({ tacticalView: null }) },
    selectPlayer: id => {
      if (id !== null && !get().scenario.players.some(p => p.id === id)) return
      releaseGuided()
      // Selection is inspection state. Camera changes remain explicit actions.
      set({ selectedId: id })
    },
    toggleTrails: () => set(s => ({ trails: !s.trails })),
  }) })
}
export const replayStore = createReplayStore()
export const useReplay = <T,>(selector: (s: ReplayState) => T) => useStore(replayStore, selector)
