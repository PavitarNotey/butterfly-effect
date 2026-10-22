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
  const frame = (t: number, nearestDistance: number): TacticalFrame => ({ t,relationships:[],corridor,
    space:{center:[33.65,0,4.5],radius:6,nearestDefenderId:'d5',nearestDefenderPosition:[36,0,.5],nearestDistance,defendersWithinRadius:2} })
  const moment = (id: string, start: number, end: number): TacticalMoment => ({ id,title:id,start,end,playerIds:['a8','a9'],
    evidenceIds:['fact'],interpretation:'A plausible contribution; no causal proof.',interpretationStatus:'authored_interpretation',movements:[] })
  return { version:1,scenarioId:'the-invisible-run',sourceHash:'test-hash',thresholds,sampleStep:.25,
    frames:[frame(0,8),frame(10,2),frame(20,6)],actualPass:corridor,shotPath:[],chain:[],assumptions:['No counterfactual.'],
    moments:[moment('shape',0,9),moment('pass',9,14),moment('finish',14,14.67)],
    evidence:[{id:'fact',category:'corridor',status:'observation',title:'Exact travel clearance',start:9,end:10.4,playerIds:['a8','a9'],eventIds:['pass','receive'],
      observation:'The measured moving-defender clearance is 2.70 m.',metrics:[{name:'Moving clearance',value:2.7,unit:'m',definition:'Simultaneous closest approach.'}],limitations:['Not a success probability.']}] }
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
  })
  it('rewinds moments and measured frames from canonical time',()=>{
    const b=fixture()
    expect(momentAt(b,15).id).toBe('finish');expect(momentAt(b,3).id).toBe('shape')
    expect(momentAt(b,9).id).toBe('pass')
    expect(frameAt(b,14).a.t).toBe(10);expect(frameAt(b,14).fraction).toBe(.4)
    expect(frameAt(b,4).a.t).toBe(0);expect(frameAt(b,20).fraction).toBe(0)
  })
  it('shows an API failure rather than synthesizing evidence',async()=>{
    vi.stubGlobal('fetch',vi.fn().mockResolvedValue({ok:false,status:503}))
    await expect(loadEvidence(new AbortController().signal)).rejects.toThrow('503')
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
