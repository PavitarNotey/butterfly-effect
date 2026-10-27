import { afterEach, describe, expect, it } from 'vitest'
import { PerspectiveCamera, Vector3 } from 'three'
import { scenarios } from '../replay/scenario'
import { samplePosition } from '../replay/sample'
import { sampleCamera } from '../replay/camera'
import { createReplayStore } from '../replay/store'
import type { Scenario } from '../replay/types'
import type { EvidenceBundle, TacticalMoment } from './types'
import { useTactics } from './store'
import { writeTrajectory } from './trajectory'

function fixture(s: Scenario): EvidenceBundle {
  const dummy = s.events.some(e => e.id === 'dummy'), missed = s.events.some(e => e.id === 'miss')
  const runner = s.events.find(e => e.id === 'run')!.playerIds[0]
  const specs = [
    ['run','build','run',dummy?'receive':'pass','movement'],
    [dummy?'dummy':'pass',dummy?'collect':'run',dummy?'dummy':'pass','receive','corridor'],
    [missed?'recovery':'receive','pass',missed?'recovery':'receive','shot',missed?'relationships':'space'],
    ['finish',dummy?'dummy':missed?'recovery':'receive','shot',missed?'miss':'goal','finish'],
  ]
  const moments = specs.map(([id, startId, focusId, endId, focus], index): TacticalMoment => {
    const start = s.events.find(e => e.id === startId)!.t, end = s.events.find(e => e.id === endId)!.t
    const player = s.players.find(p => p.id === runner)!
    const path = [{t:start,position:samplePosition(player.positions,start)},...player.positions.filter(k => k.t > start && k.t < end),{t:end,position:samplePosition(player.positions,end)}]
    return {id,title:id,start,focusTime:s.events.find(e => e.id === focusId)!.t,end,focusEventId:focusId,primaryEvidenceId:id,followPlayerId:index===0?runner:null,focus:focus as TacticalMoment['focus'],playerIds:[runner],evidenceIds:[id],interpretation:'Recorded sequence.',interpretationStatus:'authored_interpretation',movements:[{playerId:runner,startTime:start,endTime:end,path,start:path[0].position,end:path.at(-1)!.position,vector:[0,0,0],longitudinal:0,lateral:0,distance:0,pathLength:0,meanSpeed:0}]}
  })
  return {scenarioId:s.id,sourceHash:'verified-source',moments,evidence:moments.map(m => ({id:m.id,category:m.focus,status:'observation',title:m.title,start:m.focusTime,end:m.end,playerIds:m.playerIds,eventIds:[m.focusEventId],observation:'Recorded sequence.',metrics:[],limitations:[]}))} as unknown as EvidenceBundle
}
afterEach(() => useTactics.getState().reset())

describe.each(scenarios)('complete sequences in $id', scenario => {
  it('plays each selected interval on the authoritative clock and restores manual controls', () => {
    const bundle = fixture(scenario)
    let wall = 0
    const store = createReplayStore(() => wall), state = store.getState
    state().setScenario(scenario.id)
    useTactics.setState({bundle,status:'ready',enabled:true})
    state().seek(scenario.duration - 1)
    for (const moment of bundle.moments) {
      state().startGuided(bundle, moment.primaryEvidenceId, moment.id, 'moment')
      const guide = state().guided!
      expect(guide).toMatchObject({kind:'moment',startTime:moment.start,focusTime:moment.focusTime,endTime:moment.end,evidenceId:moment.primaryEvidenceId})
      expect(state().readTime()).toBe(moment.start)
      wall += 250
      expect(state().readTime()).toBeCloseTo(moment.start + .25 * guide.speed)
      state().pause(); const paused = state().readTime(); wall += 300
      expect(state().readTime()).toBe(paused)
      state().play(); wall += 30000
      expect(state().readTime()).toBe(moment.end)
      state().completeGuided(); expect(state().playing).toBe(false)
      state().replayGuided(); expect(state().readTime()).toBe(moment.start)
      state().closeGuided(); expect(state().readTime()).toBe(scenario.duration - 1)
    }
    state().startGuided(bundle, 'run', 'run', 'moment')
    expect(state().camera).toBe(`follow:${bundle.moments[0].followPlayerId}`)
    wall += 400
    const time = state().readTime()
    state().setCamera('tactical')
    expect(state().guided).toBeNull(); expect(state().camera).toBe('tactical')
    expect(state().readTime()).toBe(time)
    state().seek(1); expect(state().readTime()).toBe(1)
  })
})

it('keeps every recorded bend and the opening keys visible after six seconds', () => {
  const s = scenarios.find(s => s.id === 'the-untouched-pass')!, bundle = fixture(s)
  const path = bundle.moments[0].movements[0].path, buffer = new Float32Array((path.length + 1) * 3)
  const count = writeTrajectory(buffer,path,7.2)
  expect(count).toBe(path.length)
  path.forEach((key,i) => {
    expect(buffer[i*3]).toBeCloseTo(key.position[0],4)
    expect(buffer[i*3+2]).toBeCloseTo(key.position[2],4)
  })
  expect(buffer[0]).toBe(22)
  const partial = writeTrajectory(buffer,path,5.65), expected = samplePosition(path,5.65)
  expect(buffer[(partial-1)*3]).toBeCloseTo(expected[0],4)
  expect(buffer[(partial-1)*3+2]).toBeCloseTo(expected[2],4)
  const repeat = new Float32Array(buffer.length)
  expect(writeTrajectory(repeat,path,5.65)).toBe(partial)
  expect([...repeat.slice(0,partial*3)]).toEqual([...buffer.slice(0,partial*3)])
})

it.each([16/9, .75])('follows Merrick and frames the complete selected route at aspect %s', aspect => {
  const s = scenarios.find(s => s.id === 'the-untouched-pass')!, bundle = fixture(s)
  const store = createReplayStore(() => 0), state = store.getState
  state().setScenario(s.id); useTactics.setState({bundle,status:'ready',enabled:true})
  state().startGuided(bundle,'run','run','moment')
  const guide = state().guided!, path = bundle.moments[0].movements[0].path
  const targets: number[] = []
  for (const time of [0,1.2,3.8,5.6,6.65,7.2]) {
    const pose = sampleCamera(s,state().camera,time,{aspect,guided:guide})
    const camera = new PerspectiveCamera(pose.fov,aspect,.1,1000)
    camera.position.set(...pose.position); camera.up.set(...pose.up); camera.lookAt(...pose.target); camera.updateMatrixWorld()
    targets.push(pose.target[0])
    for (const key of path) {
      const point = new Vector3(...key.position).project(camera)
      expect(Math.abs(point.x)).toBeLessThan(1)
      expect(Math.abs(point.y)).toBeLessThan(1)
      expect(point.z).toBeGreaterThan(-1); expect(point.z).toBeLessThan(1)
    }
  }
  expect(targets.at(-1)!).toBeGreaterThan(targets[0])
})
