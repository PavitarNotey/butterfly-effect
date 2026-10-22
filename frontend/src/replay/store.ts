import { createStore } from 'zustand/vanilla'
import { useStore } from 'zustand'
import { clampTime } from './sample'
import { scenario } from './scenario'

export type CameraMode = 'broadcast' | 'tactical' | `pov:${string}`
export type PlaybackSpeed = 0.5 | 1 | 2
export interface ReplayState {
  anchorTime: number
  anchorWall: number
  playing: boolean
  scrubbing: boolean
  resumeAfterScrub: boolean
  speed: PlaybackSpeed
  camera: CameraMode
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
    anchorTime: 0, anchorWall: now(), playing: false, speed: 1, scrubbing: false, resumeAfterScrub: false,
    camera: 'broadcast', selectedId: 'a7', trails: false,
    readTime: (wall = now()) => {
      const s = get()
      return clampTime(s.anchorTime + (s.playing ? Math.max(0, wall - s.anchorWall) / 1000 * s.speed : 0), scenario.duration)
    },
    play: () => set({ anchorTime: get().readTime() >= scenario.duration ? 0 : get().readTime(), anchorWall: now(), playing: true, scrubbing: false, resumeAfterScrub: false }),
    pause: () => set({ anchorTime: get().readTime(), anchorWall: now(), playing: false, resumeAfterScrub: false }),
    restart: () => set({ anchorTime: 0, anchorWall: now(), playing: get().playing || get().resumeAfterScrub, scrubbing: false, resumeAfterScrub: false }),
    beginScrub: () => {
      if (!get().scrubbing) set({ anchorTime: get().readTime(), anchorWall: now(), resumeAfterScrub: get().playing, playing: false, scrubbing: true })
    },
    endScrub: () => {
      if (get().scrubbing) set({ anchorWall: now(), playing: get().resumeAfterScrub && get().anchorTime < scenario.duration, scrubbing: false, resumeAfterScrub: false })
    },
    seek: t => set({ anchorTime: clampTime(t, scenario.duration), anchorWall: now() }),
    setSpeed: speed => {
      if ([.5, 1, 2].includes(speed)) set({ anchorTime: get().readTime(), anchorWall: now(), speed })
    },
    setCamera: camera => {
      if (camera === 'broadcast' || camera === 'tactical' || (camera.startsWith('pov:') && scenario.players.some(p => p.id === camera.slice(4)))) set({ camera })
    },
    selectPlayer: id => { if (scenario.players.some(p => p.id === id)) set({ selectedId: id }) },
    toggleTrails: () => set(s => ({ trails: !s.trails })),
  }))
}
export const replayStore = createReplayStore()
export const useReplay = <T,>(selector: (s: ReplayState) => T) => useStore(replayStore, selector)
