import { describe, expect, it } from 'vitest'
import { scenario, validateScenario } from './scenario'
import { samplePosition, sampleTravel, sampleWorld, sampleYaw } from './sample'
import { createReplayStore } from './store'
import { sampleGaze, gazeTarget } from './gaze'
import { sampleCamera } from './camera'

describe('canonical replay interpolation', () => {
  it('interpolates exact timestamps, midpoints, heights and boundary clamps', () => {
    const keys = [{ t: 0, position: [0,0,0] as [number,number,number] }, { t: 2, position: [8,2,4] as [number,number,number] }]
    expect(samplePosition(keys, 0)).toEqual([0,0,0])
    expect(samplePosition(keys, 1)).toEqual([4,1,2])
    expect(samplePosition(keys, -3)).toEqual([0,0,0])
    expect(samplePosition(keys, 100)).toEqual([8,2,4])
  })
  it('derives ball spin from travel distance, stopping during stationary frames', () => {
    const keys = [{ t: 0, position: [0,0,0] as [number,number,number] }, { t: 2, position: [3,0,4] as [number,number,number] }, { t: 4, position: [3,0,4] as [number,number,number] }]
    expect(sampleTravel(keys, 1)).toBe(2.5)
    expect(sampleTravel(keys, 3)).toBe(5)
    expect(sampleTravel(keys, 4)).toBe(5)
  })
  it('takes the shortest path across the yaw wrap', () => {
    const yaw = sampleYaw([{ t: 0, yaw: 179*Math.PI/180 }, { t: 2, yaw: -179*Math.PI/180 }], 1)
    expect(Math.abs(yaw)).toBeCloseTo(Math.PI)
  })
  it('reproduces the whole world after arbitrary seeks and camera changes', () => {
    const expected = sampleWorld(scenario, 11.25)
    sampleWorld(scenario, 20); sampleWorld(scenario, 2)
    sampleCamera(scenario, 'pov:d4', 15)
    expect(sampleWorld(scenario, 11.25)).toEqual(expected)
    expect(sampleWorld(scenario, 4.4).possession).toBeNull()
    expect(sampleWorld(scenario, 5.6).possession).toBe('a9')
    expect(sampleWorld(scenario, 4).possession).toBe('a8')
    expect(sampleWorld(scenario, 16).event?.type).toBe('goal')
  })
  it('validates the roster and rejects broken event references and unordered tracks', () => {
    expect(validateScenario(scenario).players).toHaveLength(22)
    const bad = structuredClone(scenario)
    bad.events[0].playerIds = ['missing']
    expect(() => validateScenario(bad)).toThrow('Invalid event')
    const unordered = structuredClone(scenario)
    unordered.players[0].positions[1].t = 0
    expect(() => validateScenario(unordered)).toThrow('Unordered track')
  })
})

describe('anchored playback controls', () => {
  function fixture() {
    let wall = 0
    const store = createReplayStore(() => wall)
    return { state: () => store.getState(), advance: (ms: number) => { wall += ms } }
  }
  it('plays by elapsed wall time independently of frame sampling, and pauses', () => {
    const f = fixture(); f.state().play(); f.advance(2500)
    expect(f.state().readTime()).toBe(2.5)
    f.state().pause(); f.advance(40000)
    expect(f.state().readTime()).toBe(2.5)
    f.state().play(); f.advance(1000)
    expect(f.state().readTime()).toBe(3.5)
  })
  it('rebases speed changes without jumping, with half and double speed', () => {
    const f = fixture(); f.state().play(); f.advance(2000)
    f.state().setSpeed(.5); expect(f.state().readTime()).toBe(2)
    f.advance(2000); expect(f.state().readTime()).toBe(3)
    f.state().setSpeed(2); f.advance(1500)
    expect(f.state().readTime()).toBe(6)
  })
  it('clamps seeks and endpoints and restarts from zero', () => {
    const f = fixture(); f.state().seek(-10); expect(f.state().readTime()).toBe(0)
    f.state().seek(30); expect(f.state().readTime()).toBe(scenario.duration)
    f.state().play(); expect(f.state().readTime()).toBe(0)
    f.advance(30000); expect(f.state().readTime()).toBe(scenario.duration)
    f.state().pause(); f.state().restart()
    expect(f.state().readTime()).toBe(0); expect(f.state().playing).toBe(false)
  })
  it('switches cameras and selection without changing time or playback state', () => {
    const f = fixture(); f.state().play(); f.advance(4000)
    f.state().setCamera('pov:d4'); f.state().selectPlayer('d4'); f.state().toggleTrails()
    expect(f.state().readTime()).toBe(4); expect(f.state().playing).toBe(true)
    expect(f.state().camera).toBe('pov:d4'); expect(f.state().selectedId).toBe('d4')
    f.state().selectPlayer('a9'); expect(f.state().camera).toBe('pov:d4'); expect(f.state().selectedId).toBe('a9')
    f.state().setCamera('follow:a9'); expect(f.state().readTime()).toBe(4); expect(f.state().playing).toBe(true)
    f.advance(1000); f.state().setCamera('tactical')
    expect(f.state().readTime()).toBe(5)
    f.state().setCamera('pov:missing'); expect(f.state().camera).toBe('tactical')
  })
})

describe('camera geometry', () => {
  it('anchors defender POV to recorded position with bounded deterministic simulated gaze', () => {
    const p = scenario.players.find(p => p.id === 'd4')!
    const pose = sampleCamera(scenario, 'pov:d4', 8)
    const position = samplePosition(p.positions, 8), gaze = sampleGaze(scenario, p, 8)
    expect(pose.position).toEqual([position[0], gaze.eyeHeight, position[2]])
    expect(Math.abs(pose.position[1] - 1.68)).toBeLessThanOrEqual(.013)
    expect(pose.target).toEqual(gazeTarget(pose.position, gaze.yaw, gaze.pitch))
    expect(pose.hiddenPlayerId).toBe('d4')
    expect(pose.target).not.toEqual(sampleWorld(scenario, 8).ball)
  })
  it('restores identical broadcast and tactical poses regardless of previous modes', () => {
    const before = sampleCamera(scenario, 'broadcast', 9)
    sampleCamera(scenario, 'pov:a7', 14); sampleCamera(scenario, 'tactical', 9)
    expect(sampleCamera(scenario, 'broadcast', 9)).toEqual(before)
    expect(sampleCamera(scenario, 'overview', 0)).toEqual(sampleCamera(scenario, 'overview', 20))
  })
})

describe('scrub sessions', () => {
  it('freezes a playing clock during drag and resumes from the exact release time', () => {
    let wall = 0
    const store = createReplayStore(() => wall)
    const s = () => store.getState()
    s().play(); wall = 2000; s().beginScrub()
    expect(s().readTime()).toBe(2)
    expect(s().playing).toBe(false)
    s().seek(12); wall = 6000
    expect(s().readTime()).toBe(12)
    s().beginScrub() // Duplicate down/capture must not overwrite the original playing state.
    s().setCamera('pov:d4'); s().setSpeed(.5)
    s().seek(4); wall = 10000; s().endScrub()
    expect(s().readTime()).toBe(4)
    expect(s().playing).toBe(true)
    wall += 1000; expect(s().readTime()).toBe(4.5)
    s().endScrub() // Lost capture after pointerup must not rebase again.
    wall += 1000; expect(s().readTime()).toBe(5)
  })
  it('leaves paused scrubbing paused and does not resume at the endpoint', () => {
    let wall = 0
    const store = createReplayStore(() => wall)
    const s = () => store.getState()
    s().beginScrub(); s().seek(7); wall = 5000; s().endScrub()
    expect(s().readTime()).toBe(7); expect(s().playing).toBe(false)
    s().play(); s().beginScrub(); s().seek(20); s().endScrub()
    expect(s().readTime()).toBe(scenario.duration); expect(s().playing).toBe(false)
  })
  it('restart clears an in-flight scrub without a late release restoring old time', () => {
    const store = createReplayStore(() => 0)
    const s = () => store.getState()
    s().play(); s().beginScrub(); s().seek(13); s().restart(); s().endScrub()
    expect(s().readTime()).toBe(0); expect(s().playing).toBe(true)
    expect(s().scrubbing).toBe(false)
  })
})

describe('shared Python/TypeScript parity fixture', () => {
  it('matches independently specified position, heading and speed samples', async () => {
    const { default: fixture } = await import('./interpolation-parity.json')
    const { sampleSpeed } = await import('./sample')
    const keys = fixture.positions.map(p => ({ t:p.t, position:p.position as [number,number,number] }))
    for (const expected of fixture.samples) {
      samplePosition(keys,expected.t).forEach((v,i)=>expect(v).toBeCloseTo(expected.position[i],10))
      expect(sampleYaw(fixture.facing,expected.t)).toBeCloseTo(expected.yaw,10)
      expect(sampleSpeed(keys,expected.t)).toBeCloseTo(expected.speed,10)
    }
  })
})

describe('scenario switching', () => {
  it('resets an active scrub, POV, player, evidence and clock while retaining speed', async () => {
    const { scenarios } = await import('./scenario')
    const { useTactics } = await import('../tactics/store')
    let wall = 0
    const store = createReplayStore(() => wall)
    const s = () => store.getState()
    s().setSpeed(2); s().play(); wall=4000
    s().setCamera('pov:d4'); s().selectPlayer('d4'); s().beginScrub(); s().seek(11)
    useTactics.getState().setEnabled(true); useTactics.getState().reveal('space')
    s().setScenario('the-missed-chance'); s().endScrub()
    expect(s().scenario).toBe(scenarios[1]); expect(s().readTime()).toBe(0)
    expect(s().playing).toBe(false); expect(s().scrubbing).toBe(false)
    expect(s().camera).toBe('broadcast'); expect(s().selectedId).toBeNull(); expect(s().speed).toBe(2)
    expect(useTactics.getState().enabled).toBe(false); expect(useTactics.getState().bundle).toBeNull()
    s().setCamera('pov:d4'); s().selectPlayer('d4')
    expect(s().camera).toBe('broadcast'); expect(s().selectedId).toBeNull()
    s().play(); wall=4500; expect(s().readTime()).toBe(1)
    s().pause(); s().seek(15); s().setCamera('pov:c5'); expect(s().readTime()).toBe(15)
    s().setScenario('the-invisible-run'); expect(s().selectedId).toBeNull(); expect(s().readTime()).toBe(0)
  })
  it('samples the missed chance identically after backwards seeking and POV changes', async () => {
    const { scenarios, outcome } = await import('./scenario')
    const missed=scenarios[1], world=sampleWorld(missed,12.5)
    sampleWorld(missed,20); sampleCamera(missed,'pov:c5',15); sampleWorld(missed,0)
    expect(sampleWorld(missed,12.5)).toEqual(world)
    expect(sampleWorld(missed,20).event?.type).toBe('miss')
    expect(outcome(missed)).toBe('miss')
    expect(() => validateScenario({...missed,duration:NaN})).toThrow('roster')
  })
})
