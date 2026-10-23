import { describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { scenarios } from './scenario'
import { sampleCamera } from './camera'
import { samplePosition } from './sample'
import { createReplayStore } from './store'
import type { CameraPose } from './camera'
import type { Vec3 } from './types'

function project(pose: CameraPose, aspect: number, point: Vec3) {
  const camera = new PerspectiveCamera(pose.fov, aspect, .1, 240)
  camera.position.set(...pose.position); camera.up.set(...pose.up); camera.lookAt(...pose.target)
  camera.updateMatrixWorld()
  return new Vector3(...point).project(camera)
}

describe.each(scenarios)('$id camera framing', scenario => {
  it('keeps the ball in automatic broadcast and focused tactical views throughout passes and shots', () => {
    for (const aspect of [.85, 1.4, 16 / 9, 2.4]) for (const mode of ['broadcast', 'tactical'] as const) {
      for (let time = 0; time <= scenario.duration; time += .05) {
        const point = project(sampleCamera(scenario, mode, time, { aspect }), aspect, samplePosition(scenario.ball, time))
        expect(Math.abs(point.x), `${mode} t=${time} aspect=${aspect}`).toBeLessThan(.94)
        expect(Math.abs(point.y), `${mode} t=${time} aspect=${aspect}`).toBeLessThan(.94)
        expect(point.z).toBeGreaterThan(-1); expect(point.z).toBeLessThan(1)
      }
    }
  })
  it('frames the authored key actors on desktop, including the wide decoy and marker', () => {
    for (const mode of ['broadcast', 'tactical'] as const) for (const time of scenario.events.map(event => event.t)) {
      const pose = sampleCamera(scenario, mode, time)
      for (const player of scenario.players.filter(p => scenario.relevantPlayerIds.includes(p.id))) {
        const p = samplePosition(player.positions, time)
        const point = project(pose, 16 / 9, [p[0], 1, p[2]])
        expect(Math.abs(point.x), `${mode} ${player.id} t=${time}`).toBeLessThan(.95)
        expect(Math.abs(point.y), `${mode} ${player.id} t=${time}`).toBeLessThan(.95)
      }
    }
  })
  it('retains all pitch corners in the full-pitch overview', () => {
    for (const aspect of [.85, 1.4, 16 / 9, 2.4]) {
      const pose = sampleCamera(scenario, 'overview', 9, { aspect })
      for (const x of [-1, 1]) for (const z of [-1, 1]) {
        const point = project(pose, aspect, [x * scenario.pitch.length / 2, 0, z * scenario.pitch.width / 2])
        expect(Math.abs(point.x)).toBeLessThan(.94); expect(Math.abs(point.y)).toBeLessThan(.94)
      }
    }
  })
  it('is independent of seeks, playback speed, pauses and previous camera modes', () => {
    const store = createReplayStore(() => 0), state = () => store.getState()
    state().setScenario(scenario.id)
    for (const mode of ['broadcast', 'tactical', 'overview'] as const) {
      state().setCamera(mode); state().seek(10.4)
      const expected = sampleCamera(scenario, mode, state().readTime())
      for (const speed of [.5, 2, 1] as const) {
        state().setSpeed(speed); state().play(); state().seek(19); state().pause(); state().seek(3); state().seek(10.4)
        sampleCamera(scenario, `pov:${scenario.players[0].id}`, 14)
        expect(sampleCamera(scenario, mode, state().readTime())).toEqual(expected)
      }
    }
  })
  it('has continuous focus velocity across sampled track and canonical keyframe boundaries', () => {
    const times = new Set([...scenario.ball.map(k => k.t), ...Array.from({ length: 79 }, (_, i) => (i + 1) * .25)])
    for (const t of times) {
      if (t <= 0 || t >= scenario.duration) continue
      const h = .0001
      const before = sampleCamera(scenario, 'broadcast', t - h).target
      const at = sampleCamera(scenario, 'broadcast', t).target
      const after = sampleCamera(scenario, 'broadcast', t + h).target
      for (const axis of [0, 2]) {
        expect(Math.abs((at[axis] - before[axis]) / h - (after[axis] - at[axis]) / h)).toBeLessThan(.025)
      }
    }
    for (const time of [-5, 0, scenario.duration, 100]) {
      const pose = sampleCamera(scenario, 'tactical', time)
      expect([...pose.position, ...pose.target, pose.fov].every(Number.isFinite)).toBe(true)
    }
  })
})

it('bounds explicit manual framing, preserves the clock, and resets on mode/scenario changes', () => {
  const store = createReplayStore(() => 0), s = () => store.getState()
  s().seek(9); s().play(); s().setCamera('tactical')
  s().setTacticalView({ center: [1000, -1000], height: 1000 })
  expect(s().tacticalView).toEqual({ center: [49.5, -31], height: 110 })
  s().setTacticalView({ center: [1, 2], height: -1 })
  expect(s().tacticalView?.height).toBe(16)
  s().setTacticalView({ center: [NaN, 0], height: 30 })
  expect(s().tacticalView).toEqual({ center: [1, 2], height: 16 })
  expect(s().readTime()).toBe(9); expect(s().playing).toBe(true)
  s().seek(14)
  expect(sampleCamera(s().scenario, 'tactical', 9, { tacticalView: s().tacticalView })).toEqual(sampleCamera(s().scenario, 'tactical', 14, { tacticalView: s().tacticalView }))
  s().resetTacticalView(); expect(s().tacticalView).toBeNull(); expect(s().readTime()).toBe(s().scenario.duration)
  s().setTacticalView({ center: [1, 2], height: 30 }); s().setCamera('overview')
  expect(s().tacticalView).toBeNull()
  s().setTacticalView({ center: [1, 2], height: 30 }); s().setScenario('the-missed-chance')
  expect(s().tacticalView).toBeNull(); expect(s().camera).toBe('broadcast')
})
