import { afterEach, describe, expect, it } from 'vitest'
import { scenarios } from '../replay/scenario'
import { createReplayStore } from '../replay/store'
import { useTactics } from './store'
import { resolveGuided } from './guided'
import { evidenceLayer, formatMetric, presentEvidence } from './presentation'
import type { Evidence, EvidenceBundle } from './types'

const fact: Evidence = { id:'move',category:'movement',status:'observation',title:'movement',start:3,end:6,playerIds:['a7'],eventIds:['run','shift'],observation:'Recorded movement.',metrics:[],limitations:[] }
const bundle = { version:1,scenarioId:scenarios[0].id,sourceHash:'validated-hash',evidence:[fact],moments:[{id:'run',start:3,end:6,playerIds:['a7'],evidenceIds:['move'],movements:[]}] } as unknown as EvidenceBundle
function setup() {
  let wall = 0
  const store = createReplayStore(() => wall)
  useTactics.setState({bundle,status:'ready',enabled:true})
  return { state:store.getState, advance: (ms: number) => { wall += ms } }
}
afterEach(() => useTactics.getState().reset())

describe('guided evidence replay', () => {
  it('resolves the exact fact interval and players, bounds padding, and binds source identity', () => {
    const {state} = setup()
    state().startGuided(bundle,'move','run')
    expect(state().guided).toMatchObject({scenarioId:scenarios[0].id,sourceHash:'validated-hash',evidenceId:'move',momentId:'run',startTime:2.35,endTime:6.65,relevantPlayerIds:['a7'],layer:'movement',speed:1})
    expect(state().camera).toBe('tactical')
    expect(state().playing).toBe(true)
    expect(useTactics.getState().layers).toEqual({movement:true,passing:false,space:false,relationships:false})
  })
  it('uses the shared absolute clock, stops exactly at the boundary, replays and restores context', () => {
    const {state,advance} = setup()
    state().seek(8);state().setCamera('pov:a9');state().setSpeed(2)
    state().startGuided(bundle,'move','run')
    advance(1000);expect(state().readTime()).toBeCloseTo(3.35)
    state().pause();advance(1000);expect(state().readTime()).toBeCloseTo(3.35)
    state().play();advance(10000);expect(state().readTime()).toBe(6.65)
    state().completeGuided();expect(state().playing).toBe(false);expect(state().guided?.status).toBe('complete')
    state().replayGuided();expect(state().readTime()).toBe(2.35)
    state().closeGuided();expect(state().guided).toBeNull();expect(state().camera).toBe('pov:a9');expect(state().readTime()).toBe(8);expect(state().speed).toBe(2)
  })
  it.each(['seek','camera','scenario','speed','scrub'] as const)('cleans up when interrupted by %s', action => {
    const {state} = setup();state().startGuided(bundle,'move','run')
    if(action==='seek')state().seek(12)
    if(action==='camera')state().setCamera('broadcast')
    if(action==='scenario')state().setScenario(scenarios[1].id)
    if(action==='speed')state().setSpeed(.5)
    if(action==='scrub')state().beginScrub()
    expect(state().guided).toBeNull();expect(state().playing).toBe(false)
    if(action==='scenario')expect(useTactics.getState().bundle).toBeNull()
  })
  it('Follow play interrupts a tactical guide at its current time and restores manual analysis settings', () => {
    const {state,advance} = setup()
    const layers = {passing:true,movement:false,space:true,relationships:false}
    useTactics.setState({layers})
    state().setSpeed(2)
    state().startGuided(bundle,'move','run')
    expect(state().tacticalView).not.toBeNull()
    advance(400)
    const interruptedAt = state().readTime()
    state().resetTacticalView()
    expect(state().guided).toBeNull()
    expect(state().readTime()).toBe(interruptedAt)
    expect(state().playing).toBe(false)
    expect(state().speed).toBe(2)
    expect(state().camera).toBe('tactical')
    expect(state().tacticalView).toBeNull()
    expect(useTactics.getState().layers).toEqual(layers)
    advance(1000)
    expect(state().readTime()).toBe(interruptedAt)
  })
  it('rejects mismatched scenarios, unknown evidence and unrelated moments', () => {
    const {state} = setup();state().startGuided(bundle,'move','run')
    const restore = state().guided!.restoration
    expect(() => resolveGuided(bundle,scenarios[1],'move','run',restore)).toThrow('match')
    expect(() => resolveGuided(bundle,scenarios[0],'missing','run',restore)).toThrow('match')
    expect(() => resolveGuided({...bundle,sourceHash:''},scenarios[0],'move','run',restore)).toThrow('match')
    expect(() => resolveGuided(bundle,scenarios[0],'move','missing',restore)).toThrow('match')
    useTactics.setState({bundle:{...bundle,sourceHash:'new-hash'}})
    state().replayGuided();expect(state().guided?.sourceHash).toBe('validated-hash')
    // No playback can be restarted against a replacement source.
    state().pause();state().replayGuided();expect(state().playing).toBe(false)
  })
})

it('maps all evidence categories and translates only supported comparisons', () => {
  expect(evidenceLayer).toEqual({movement:'movement',relationships:'relationships',corridor:'passing',space:'space',finish:'passing'})
  const relationship: Evidence = {...fact,category:'relationships',playerIds:['a9','d5'],metrics:[{name:'Separation change',value:-2,unit:'m',definition:'End minus start.'}]}
  expect(presentEvidence(relationship,scenarios[0]).sentence).toContain('closer together')
  relationship.metrics[0].value=2
  expect(presentEvidence(relationship,scenarios[0]).sentence).toContain('farther apart')
  relationship.metrics=[]
  expect(presentEvidence(relationship,scenarios[0]).sentence).not.toMatch(/closer|farther/)
  expect(formatMetric({name:'Clearance',value:2.701,unit:'m',definition:'Centre separation.'})).toBe('2.701 m')
  const corridor = {...fact,category:'corridor',metrics:[{name:'Start clearance',value:2,unit:'m',definition:''},{name:'Later clearance',value:1,unit:'m',definition:''}]} as Evidence
  expect(presentEvidence(corridor,scenarios[0]).sentence).toContain('narrower')
  expect(presentEvidence(corridor,scenarios[0]).sentence).toContain('proposed route')
})
