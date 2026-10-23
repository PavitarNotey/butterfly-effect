import { describe, expect, it } from 'vitest'
import { scenarios } from './scenario'
import { sampleGaze, constrainFreeLook } from './gaze'
import { sampleCamera } from './camera'
import { createReplayStore } from './store'
import { samplePosition, sampleYaw } from './sample'

describe.each(scenarios)('$id simulated gaze', s => {
  it('reproduces automatic gaze for all 22 players after arbitrary seeks and bounds motion', () => {
    for(const p of s.players)for(const time of [0,3,6,9,10.4,14,15,20]) {
      const expected = sampleGaze(s,p,time)
      sampleGaze(s,p,19);sampleGaze(s,p,0)
      expect(sampleGaze(s,p,time)).toEqual(expected)
      expect(Math.abs(Math.atan2(Math.sin(expected.yaw-sampleYaw(p.facing,time)),Math.cos(expected.yaw-sampleYaw(p.facing,time))))).toBeLessThan(1.5)
      expect(Math.abs(expected.eyeHeight-1.68)).toBeLessThanOrEqual(.013)
      expect(sampleGaze(s,p,time,true).eyeHeight).toBe(1.68)
    }
  })
  it('tracks the ball before reception within its bounded neck range', () => {
    const receive = s.events.find(e=>e.type==='receive')!, p=s.players.find(p=>p.id===receive.playerIds[0])!
    const t=receive.t-.5, position=samplePosition(p.positions,t),ball=samplePosition(s.ball,t),heading=sampleYaw(p.facing,t)
    const desired = Math.atan2(ball[0]-position[0],ball[2]-position[2]), gaze=sampleGaze(s,p,t)
    const difference = (a:number,b:number)=>Math.abs(Math.atan2(Math.sin(a-b),Math.cos(a-b)))
    expect(difference(gaze.yaw,desired)).toBeLessThan(difference(heading,desired))
  })
  it('anchors free-look while paused, keeps inspection separate, resets on camera/scenario change and resume, and survives seeking', () => {
    const store=createReplayStore(()=>0),state=store.getState
    state().setScenario(s.id);const p=s.players[8]
    state().setCamera(`pov:${p.id}`);state().seek(10.4)
    const base=sampleCamera(s,state().camera,10.4)
    state().setFreeLook({yaw:1,pitch:.3})
    const manual=sampleCamera(s,state().camera,10.4,{freeLook:state().freeLook})
    expect(manual.position).toEqual(base.position);expect(manual.target).not.toEqual(base.target)
    state().seek(9);expect(state().freeLook.yaw).toBe(1)
    state().resetFreeLook();expect(state().freeLook).toEqual({yaw:0,pitch:0})
    state().setFreeLook({yaw:1,pitch:.3});state().play();expect(state().freeLook).toEqual({yaw:0,pitch:0})
    state().setFreeLook({yaw:2,pitch:1});expect(state().freeLook.yaw).toBe(0)
    state().pause();state().setFreeLook({yaw:1,pitch:.3});state().selectPlayer(s.players[9].id)
    expect(state().camera).toBe(`pov:${p.id}`);expect(state().selectedId).toBe(s.players[9].id);expect(state().freeLook.yaw).toBe(1)
    state().setCamera(`pov:${s.players[9].id}`);expect(state().freeLook.yaw).toBe(0)
    state().setFreeLook({yaw:1,pitch:.3});state().setScenario(scenarios.find(other=>other.id!==s.id)!.id)
    expect(state().freeLook).toEqual({yaw:0,pitch:0})
  })
})
it('constrains invalid and excessive free-look angles',()=>{
  expect(constrainFreeLook({yaw:100,pitch:-100})).toEqual({yaw:Math.PI,pitch:-1.05})
  expect(constrainFreeLook({yaw:NaN,pitch:Infinity})).toEqual({yaw:0,pitch:0})
})
