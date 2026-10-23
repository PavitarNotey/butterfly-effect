import { afterEach, describe, expect, it, vi } from 'vitest'
import { createElement } from 'react'
import { renderToStaticMarkup } from 'react-dom/server'
import { frameAt, loadEvidence, momentAt, validateEvidence } from './data'
import { useTactics } from './store'
import { replayStore } from '../replay/store'
import { TacticalPanelView } from './TacticalPanel'
import type { EvidenceBundle, TacticalFrame, TacticalMoment } from './types'

function fixture(): EvidenceBundle {
  const thresholds = { corridorHalfWidth:.9, contestedMargin:.6, coverageRadius:6 }
  const corridor: TacticalFrame['corridor'] = { kind:'observed_travel',passerId:'a8',receiverId:'a9',releaseTime:9,arrivalTime:10.4,
    start:[14.65,.16,0],end:[33.65,.16,4.5],staticDistance:3,staticDefenderId:'d4',sweptCorridorDistance:2.6,
    movingClosest:{playerId:'d8',distance:2.7,t:9.2,playerPosition:[18,0,-2],ballPosition:[18,.2,.8]},state:'clear',thresholds,
    path:[{t:9,position:[14.65,.16,0]},{t:10.4,position:[33.65,.16,4.5]}] }
  const frame = (t: number, nearestDistance: number): TacticalFrame => ({ t,relationships:[
    {aId:'a7',bId:'d4',a:[25,0,4],b:[29,0,3],distance:4.1,defenderGoalSide:true},
    {aId:'a9',bId:'d5',a:[23,0,-1],b:[30,0,-6],distance:8.6,defenderGoalSide:true},
  ],corridor,
    space:{center:[33.65,0,4.5],radius:6,nearestDefenderId:'d5',nearestDefenderPosition:[36,0,.5],nearestDistance,defendersWithinRadius:2} })
  const moment = (id: string, start: number, end: number): TacticalMoment => ({ id,focus:id==='finish'?'finish':'corridor',title:id,start,end,playerIds:['a8','a9'],
    evidenceIds:['fact'],interpretation:'A plausible contribution; no causal proof.',interpretationStatus:'authored_interpretation',movements:[] })
  return { version:1,scenarioId:'the-invisible-run',sourceHash:'test-hash',thresholds,sampleStep:.25,
    frames:[frame(0,8),frame(10,2),frame(13.2,6)],actualPass:corridor,
    shotPath:[{t:12,position:[37,.16,4.5]},{t:13.2,position:[52.7,.62,-2.4]}],
    chain:[{fromMomentId:'shape',toMomentId:'pass',evidenceIds:['fact'],relation:'precedes_not_proven_cause'}],assumptions:['No counterfactual.'],
    moments:[moment('shape',0,9),moment('pass',9,12),moment('finish',12,13.2)],
    evidence:[{id:'fact',category:'corridor',status:'observation',title:'Exact travel clearance',start:9,end:10.4,playerIds:['a8','a9'],eventIds:['pass','receive'],
      observation:'The measured moving-defender clearance is 2.70 m.',metrics:[{name:'Moving clearance',value:2.7,unit:'m',definition:'Simultaneous closest approach.'}],limitations:['Not a success probability.']}] }
}
function addMovement(bundle: EvidenceBundle) {
  bundle.moments[0].movements = [{playerId:'a8',startTime:0,endTime:1,
    path:[{t:0,position:[8,0,0]},{t:1,position:[10,0,0]}],start:[8,0,0],end:[10,0,0],vector:[2,0,0],
    longitudinal:2,lateral:0,distance:2,pathLength:2,meanSpeed:2}]
}
afterEach(()=>{vi.unstubAllGlobals();useTactics.setState({enabled:false,bundle:null,status:'idle',error:'',layers:{passing:true,movement:false,space:false,relationships:false}})})

describe('evidence boundary and time selection',()=>{
  it('accepts matched evidence and rejects stale sources, bad references and invalid metrics',()=>{
    const b=fixture()
    expect(validateEvidence(b,'test-hash')).toBe(b)
    expect(()=>validateEvidence(b,'different')).toThrow('match')
    const bad=fixture();bad.evidence[0].playerIds=['missing']
    expect(()=>validateEvidence(bad,'test-hash')).toThrow('references')
    const invalid=fixture();invalid.evidence[0].metrics[0].value=NaN
    expect(()=>validateEvidence(invalid,'test-hash')).toThrow('measurements')
    const invalidTime=fixture();invalidTime.moments[0].start=NaN
    expect(()=>validateEvidence(invalidTime,'test-hash')).toThrow('moment references')
    const invalidMovement=fixture()
    invalidMovement.moments[0].movements.push({playerId:'missing'} as EvidenceBundle['moments'][number]['movements'][number])
    expect(()=>validateEvidence(invalidMovement,'test-hash')).toThrow('movement geometry')
  })
  it('rewinds moments and measured frames from canonical time',()=>{
    const b=fixture()
    expect(momentAt(b,15).id).toBe('finish');expect(momentAt(b,3).id).toBe('shape')
    expect(momentAt(b,9).id).toBe('pass')
    expect(frameAt(b,11.28).a.t).toBe(10);expect(frameAt(b,11.28).fraction).toBeCloseTo(.4)
    expect(frameAt(b,4).a.t).toBe(0);expect(frameAt(b,20).fraction).toBe(0)
  })
  it('shows an API failure rather than synthesizing evidence',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:503}))
    await expect(loadEvidence(new AbortController().signal)).rejects.toThrow('503')
  })
  const invalidPayloads: [string, (bundle: EvidenceBundle) => void][] = [
    ['unknown evidence event', b => { b.evidence[0].eventIds = ['missing'] }],
    ['unknown evidence category', b => { b.evidence[0].category = 'invented' as never }],
    ['duplicate evidence identity', b => { b.evidence.push(structuredClone(b.evidence[0])) }],
    ['empty evidence actors', b => { b.evidence[0].playerIds = [] }],
    ['unknown moment actor', b => { b.moments[0].playerIds = ['missing'] }],
    ['unknown moment evidence', b => { b.moments[0].evidenceIds = ['missing'] }],
    ['duplicate moment identity', b => { b.moments[1].id = b.moments[0].id }],
    ['unordered moments', b => { b.moments.reverse() }],
    ['unknown focus', b => { b.moments[0].focus = 'invented' as never }],
    ['unknown chain origin', b => { b.chain[0].fromMomentId = 'missing' }],
    ['unknown chain destination', b => { b.chain[0].toMomentId = 'missing' }],
    ['unknown chain evidence', b => { b.chain[0].evidenceIds = ['missing'] }],
    ['causal chain claim', b => { b.chain[0].relation = 'causes' as never }],
    ['unknown nearest defender', b => { b.frames[0].space.nearestDefenderId = 'missing' }],
    ['nonfinite coverage radius', b => { b.frames[0].space.radius = Infinity }],
    ['nonfinite nearest distance', b => { b.frames[0].space.nearestDistance = NaN }],
    ['unknown relationship actor', b => { b.frames[0].relationships[0].aId = 'missing' }],
    ['unknown relationship partner', b => { b.frames[0].relationships[0].bId = 'missing' }],
    ['reordered relationships', b => { b.frames[1].relationships.reverse() }],
    ['changed relationship identity', b => { b.frames[1].relationships[0].aId = 'a8' }],
    ['missing adjacent relationship', b => { b.frames[1].relationships.pop() }],
    ['duplicate relationship', b => { b.frames[0].relationships.push(b.frames[0].relationships[0]) }],
    ['invalid relationship position', b => { b.frames[0].relationships[0].a[0] = Infinity }],
    ['unknown corridor passer', b => { b.actualPass.passerId = 'missing' }],
    ['unknown corridor receiver', b => { b.actualPass.receiverId = 'missing' }],
    ['unknown static defender', b => { b.actualPass.staticDefenderId = 'missing' }],
    ['unknown moving defender', b => { b.actualPass.movingClosest.playerId = 'missing' }],
    ['closest time outside travel interval', b => { b.actualPass.movingClosest.t = 0 }],
    ['invalid corridor state', b => { b.frames[0].corridor.state = 'invented' as never }],
    ['nonfinite corridor path', b => { b.actualPass.path[0].position[0] = NaN }],
    ['unmatched pass path interval', b => { b.actualPass.path[0].t = 0 }],
    ['unmatched pass path endpoint', b => { b.actualPass.path[0].position[0] += 1 }],
    ['equal-time observed pass', b => { b.actualPass.arrivalTime = b.actualPass.releaseTime }],
    ['nonfinite shot coordinate', b => { b.shotPath[0].position[0] = Infinity }],
    ['null shot coordinate', b => { b.shotPath[0].position[0] = null as never }],
    ['nonfinite shot timestamp', b => { b.shotPath[0].t = NaN }],
    ['shot timestamp outside replay', b => { b.shotPath[1].t = 14 }],
    ['unordered shot path', b => { b.shotPath.reverse() }],
    ['empty shot path', b => { b.shotPath = [] }],
    ['unknown movement actor', b => { addMovement(b); b.moments[0].movements[0].playerId = 'missing' }],
    ['movement actor outside moment', b => { addMovement(b); b.moments[0].movements[0].playerId = 'd4' }],
    ['movement endpoint outside interval', b => { addMovement(b); b.moments[0].movements[0].path[1].t = 2 }],
    ['nonfinite movement start', b => { addMovement(b); b.moments[0].movements[0].start[0] = NaN }],
    ['unmatched movement endpoint', b => { addMovement(b); b.moments[0].movements[0].end[0] += 1 }],
    ['nonfinite movement vector', b => { addMovement(b); b.moments[0].movements[0].vector[0] = Infinity }],
    ['nonfinite movement metric', b => { addMovement(b); b.moments[0].movements[0].meanSpeed = NaN }],
    ['unordered movement path', b => { addMovement(b); b.moments[0].movements[0].path.reverse() }],
    ['invalid threshold', b => { b.thresholds.coverageRadius = 0 }],
    ['invalid sample step', b => { b.sampleStep = NaN }],
    ['duplicate frame timestamp', b => { b.frames[1].t = 0 }],
  ]
  it.each(invalidPayloads)('rejects %s before accepting the bundle', (_name, mutate) => {
    const bundle = structuredClone(fixture())
    mutate(bundle)
    expect(() => validateEvidence(bundle, 'test-hash')).toThrow()
  })
  it.each([null, undefined, [], {}, {version:1}])('rejects malformed top-level JSON: %j', value => {
    expect(() => validateEvidence(value, 'test-hash')).toThrow()
  })
  it.each(['chain', 'frames', 'moments', 'shotPath', 'actualPass', 'thresholds'] as const)('rejects missing/null %s', key => {
    const bundle = {...fixture(), [key]:null}
    expect(() => validateEvidence(bundle, 'test-hash')).toThrow()
  })
  it('accepts proposed static corridors with distinct spatial endpoints at the same timestamp', () => {
    const b = fixture(), c = structuredClone(b.actualPass)
    Object.assign(c, {kind:'proposed_static',releaseTime:0,arrivalTime:0,
      path:[{t:0,position:c.start},{t:0,position:c.end}],movingClosest:{...c.movingClosest,t:0}})
    b.frames[0].corridor = c
    addMovement(b)
    expect(validateEvidence(b, 'test-hash')).toBe(b)
    c.path[1].t = .1
    expect(() => validateEvidence(b, 'test-hash')).toThrow('corridor')
  })
})

describe('tactical controls and presentation',()=>{
  it('toggles layers without mutating the replay clock, camera or player selection',()=>{
    replayStore.getState().pause();replayStore.getState().seek(6);replayStore.getState().setCamera('pov:d4')
    const before=replayStore.getState()
    useTactics.getState().setEnabled(true);useTactics.getState().toggleLayer('space');useTactics.getState().reveal('movement')
    expect(useTactics.getState().layers.space).toBe(true);expect(useTactics.getState().layers.movement).toBe(true)
    useTactics.getState().setEnabled(false)
    expect(replayStore.getState().readTime()).toBe(6);expect(replayStore.getState().camera).toBe(before.camera)
    expect(replayStore.getState().selectedId).toBe(before.selectedId)
  })
  it('renders returned measurements separately from authored interpretation',()=>{
    useTactics.setState({enabled:true,status:'ready',bundle:fixture()})
    const html=renderToStaticMarkup(createElement(TacticalPanelView,{time:9,state:useTactics.getState()}))
    expect(html).toContain('2.70 m');expect(html).toContain('Authored interpretation')
    expect(html).toContain('A plausible contribution');expect(html).toContain('Exact travel clearance')
    expect(html).toContain('Theo Linden');expect(html).toContain('Leon Voss')
  })
  it('renders the unavailable-evidence state while retaining replay access',()=>{
    useTactics.setState({enabled:true,status:'error',error:'API unavailable'})
    const html=renderToStaticMarkup(createElement(TacticalPanelView,{time:6,state:useTactics.getState()}))
    expect(html).toContain('Replay remains available');expect(html).toContain('Retry evidence')
  })
})

it('rejects an original-scenario bundle against the missed-chance source even with the same expected hash',async()=>{
  const { scenarios }=await import('../replay/scenario')
  expect(()=>validateEvidence(fixture(),'test-hash',scenarios[1])).toThrow('does not match')
})
