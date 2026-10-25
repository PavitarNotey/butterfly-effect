/// <reference types="node" />
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { afterAll, describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { scenarios, validateScenario } from '../scenario'
import { samplePosition, sampleYaw } from '../sample'
import { createCharacter } from './characterAssets'
import { sampleAnimation } from './animationSampler'
import { sampleDummy } from './dummy'
import { footballActions, sampleFootballAction } from './footballActions'

const s = scenarios[2], event = s.events.find(e => e.type === 'dummy')!
const player = s.players.find(p => p.id === event.actorId)!
const actionMeasurements: object[] = []
afterAll(()=>{
  const directory=new URL('../../../../output/phase3d/',import.meta.url)
  mkdirSync(directory,{recursive:true})
  writeFileSync(new URL('short-contacts.json',directory),JSON.stringify(actionMeasurements,null,2)+'\n')
})
async function model() {
  const bytes = readFileSync(new URL('../../../public/characters/football-player.glb', import.meta.url))
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
}
function snapshot(scene: THREE.Object3D) {
  const values: number[] = []
  scene.traverse(o => { if (o instanceof THREE.Bone) values.push(...o.position.toArray(), ...o.quaternion.toArray()) })
  return values
}
function expectContinuous(before: number[], after: number[], label = '') {
  // q and -q describe the same rotation: continuity is an angular property.
  for(let i=0;i<before.length;i+=7) {
    expect(new THREE.Vector3(...before.slice(i,i+3) as [number,number,number]).distanceTo(new THREE.Vector3(...after.slice(i,i+3) as [number,number,number])), `${label} bone ${i/7} position ${before.slice(i,i+3)} -> ${after.slice(i,i+3)}`).toBeLessThan(.003)
    expect(new THREE.Quaternion(...before.slice(i+3,i+7) as [number,number,number,number]).angleTo(new THREE.Quaternion(...after.slice(i+3,i+7) as [number,number,number,number]))).toBeLessThan(.003)
  }
}
it('registers the fictional third showcase and rejects contact/possession disguised as a dummy', () => {
  expect(scenarios.map(s => s.id)).toEqual(['the-invisible-run','the-missed-chance','the-untouched-pass'])
  expect(s.players).toHaveLength(22)
  expect(new Set(s.players.map(p => p.name)).size).toBe(22)
  expect(footballActions(s).map(a => [a.actorId,a.kind,a.contact])).toEqual([['v8','pass',3.2],['v7','receive',3.8],['v7','pass',5.6],['v10','receive',7.2],['v10','shot',7.42]])
  expect(footballActions(s).some(a => a.actorId === event.actorId)).toBe(false)
  for (let t = 6.12; t < 7.02; t += .005) expect(s.possession.findLast(p => p.t <= t)?.playerId).toBeNull()
  for (const mutation of [ {nonContact:false}, {possessionTransfer:true}, {actorId:'v10'}, {passEventId:'shot'}, {start:7}, {t:NaN}, {end:8} ]) {
    const changed = structuredClone(s)
    Object.assign(changed.events.find(e => e.type === 'dummy')!, mutation)
    expect(() => validateScenario(changed)).toThrow()
  }
  const owned = structuredClone(s)
  owned.possession.splice(4,0,{t:6.65,playerId:'v9'})
  expect(() => validateScenario(owned)).toThrow('non-contact')
})

it('reproduces exact dummy bones under arbitrary seeks, parent transforms and remounts', async () => {
  const asset = await model(), character = createCharacter(asset,'#e7b454'), parent = new THREE.Group()
  parent.add(character.scene)
  for (const t of [event.start,event.start+.1,6.5,event.t,6.8,event.end,7.1]) {
    const direct = createCharacter(asset,'#e7b454')
    direct.evaluate(sampleAnimation(s,player,t))
    for (const other of [13,0,7.42,6.4,9,t,t]) {
      parent.position.set(other,0,-other);parent.rotation.y=other;parent.updateMatrixWorld(true)
      character.evaluate(sampleAnimation(s,player,other))
    }
    expect(snapshot(character.scene)).toEqual(snapshot(direct.scene))
    expect(sampleDummy(s,player,t)).toEqual(sampleAnimation(s,player,t).dummy)
    direct.dispose()
  }
  for(const t of [event.start,event.start+.22,event.t,event.end-.18,event.end]) {
    character.evaluate(sampleAnimation(s,player,t-1e-6));const before=snapshot(character.scene)
    character.evaluate(sampleAnimation(s,player,t+1e-6));const after=snapshot(character.scene)
    expectContinuous(before,after,String(t))
  }
  character.dispose()
})

it('measures the ball sphere against ALL deformed body triangles between authored keys, including both legs/boots', async () => {
  const asset = await model(), character = createCharacter(asset,'#e7b454')
  let mesh!: THREE.SkinnedMesh
  character.scene.traverse(o => { if (o instanceof THREE.SkinnedMesh) mesh = o })
  const attr=mesh.geometry.attributes.position, index=mesh.geometry.index!, points=Array.from({length:attr.count},()=>new THREE.Vector3())
  const tri=new THREE.Triangle(), closest=new THREE.Vector3(), center=new THREE.Vector3()
  const minima={body:Infinity,leftLeg:Infinity,rightLeg:Infinity,leftBoot:Infinity,rightBoot:Infinity}
  let minSole=Infinity,maxRadius=0,maxPlantDrift=0,maxAnkleWidth=0
  const anchors=new Map<string,THREE.Vector3>(), frames: object[]=[]
  const times = new Set([event.start,event.t,event.end,...s.ball.map(k=>k.t).filter(t=>t>=event.start&&t<=event.end)])
  for(let i=0;i<=180;i++) times.add(event.start+i*(event.end-event.start)/180)
  for(const t of [...times].sort((a,b)=>a-b)) {
    character.evaluate(sampleAnimation(s,player,t));character.scene.updateMatrixWorld(true)
    const root=samplePosition(player.positions,t),ball=samplePosition(s.ball,t),yaw=sampleYaw(player.facing,t)
    const x=ball[0]-root[0],z=ball[2]-root[2]
    center.set(x*Math.cos(yaw)-z*Math.sin(yaw),ball[1]-.01,x*Math.sin(yaw)+z*Math.cos(yaw))
    for(let i=0;i<points.length;i++) {
      mesh.getVertexPosition(i,points[i])
      maxRadius=Math.max(maxRadius,points[i].distanceTo(mesh.boundingSphere!.center))
      if(attr.getY(i)<.115) minSole=Math.min(minSole,points[i].y+.01)
    }
    const gaps={body:Infinity,leftLeg:Infinity,rightLeg:Infinity,leftBoot:Infinity,rightBoot:Infinity}
    for(let i=0;i<index.count;i+=3) {
      const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)]
      tri.set(points[ids[0]],points[ids[1]],points[ids[2]]).closestPointToPoint(center,closest)
      const gap=closest.distanceTo(center)-.16
      gaps.body=Math.min(gaps.body,gap)
      for(const [key,sign,top] of [['leftLeg',1,.96],['rightLeg',-1,.96],['leftBoot',1,.115],['rightBoot',-1,.115]] as const) {
        if(ids.every(id=>attr.getX(id)*sign>0&&attr.getY(id)<top)) gaps[key]=Math.min(gaps[key],gap)
      }
    }
    for(const key of Object.keys(minima) as (keyof typeof minima)[]) minima[key]=Math.min(minima[key],gaps[key])
    if(t>=6.4&&t<=6.8) {
      const ankles=['l','r'].map(side=>new THREE.Vector3().setFromMatrixPosition(character.scene.getObjectByName(`foot_${side}`)!.matrixWorld))
      maxAnkleWidth=Math.max(maxAnkleWidth,ankles[0].distanceTo(ankles[1]))
      for(let i=0;i<points.length;i++) if(attr.getY(i)<.02) {
        const key=String(i),p=points[i],anchor=anchors.get(key)
        if(!anchor) anchors.set(key,p.clone())
        else maxPlantDrift=Math.max(maxPlantDrift,Math.hypot(p.x-anchor.x,p.z-anchor.z))
      }
    }
    frames.push({t,...gaps})
  }
  expect(minima.body).toBeGreaterThan(.035)
  expect(minima.leftLeg).toBeGreaterThan(.035);expect(minima.rightLeg).toBeGreaterThan(.035)
  expect(minSole).toBeGreaterThan(-.01)
  expect(maxRadius).toBeLessThan(mesh.boundingSphere!.radius)
  expect(maxPlantDrift).toBeLessThan(.012)
  expect(maxAnkleWidth).toBeLessThan(.8)
  const directory=new URL('../../../../output/phase3d/',import.meta.url)
  mkdirSync(directory,{recursive:true})
  writeFileSync(new URL('dummy-clearance.json',directory),JSON.stringify({stepSeconds:.005,frames:frames.length,minima,minSole,maxRadius,maxPlantDrift,maxAnkleWidth,samples:frames},null,2)+'\n')
  character.dispose()
},30000)

describe('AUD-03 close contact windows',()=>{
  it.each([.1,.2,.4,1.2])('reaches both contact peaks and exact poses at %s second separation',async separation=>{
    const fixture=structuredClone(scenarios[0]),receive=fixture.events.find(e=>e.type==='receive')!,shot=fixture.events.find(e=>e.type==='shot')!
    shot.t=receive.t+separation
    fixture.possession.find(p=>p.t===6.8)!.t=shot.t
    const actor=fixture.players.find(p=>p.id==='a9')!,asset=await model(),character=createCharacter(asset,'#abcdef')
    for(const action of footballActions(fixture).filter(a=>a.actorId===actor.id)) {
      expect(sampleFootballAction(fixture,actor,action.contact)?.weight).toBe(1)
      character.evaluate(sampleAnimation(fixture,actor,action.contact));const direct=snapshot(character.scene)
      character.evaluate(sampleAnimation(fixture,actor,12));character.evaluate(sampleAnimation(fixture,actor,0));character.evaluate(sampleAnimation(fixture,actor,action.contact))
      expect(snapshot(character.scene)).toEqual(direct)
      character.scene.updateMatrixWorld(true)
      let mesh!:THREE.SkinnedMesh
      character.scene.traverse(o=>{if(o instanceof THREE.SkinnedMesh)mesh=o})
      const attr=mesh.geometry.attributes.position,index=mesh.geometry.index!,center=new THREE.Vector3(...action.ballLocal)
      center.y-=.01
      const points=Array.from({length:attr.count},(_,i)=>mesh.getVertexPosition(i,new THREE.Vector3())),triangle=new THREE.Triangle(),closest=new THREE.Vector3()
      let gap=Infinity,minSole=Infinity
      for(let i=0;i<points.length;i++)if(attr.getY(i)<.115)minSole=Math.min(minSole,points[i].y+.01)
      for(let i=0;i<index.count;i+=3) {
        const ids=[index.getX(i),index.getX(i+1),index.getX(i+2)]
        if(!ids.every(id=>attr.getY(id)<.115))continue
        triangle.set(points[ids[0]],points[ids[1]],points[ids[2]]).closestPointToPoint(center,closest)
        gap=Math.min(gap,closest.distanceTo(center)-.16)
      }
      expect(Math.abs(gap)).toBeLessThan(.025);expect(minSole).toBeGreaterThan(-.01)
      actionMeasurements.push({separation,kind:action.kind,weight:sampleFootballAction(fixture,actor,action.contact)!.weight,meshSurfaceGap:gap,minSole})
      for(const t of [action.start+1e-8,action.end-1e-8]) expect(sampleFootballAction(fixture,actor,t)?.weight??0).toBeLessThan(1e-8)
      for(const t of [action.start,action.end]) {
        character.evaluate(sampleAnimation(fixture,actor,t-1e-6));const before=snapshot(character.scene)
        character.evaluate(sampleAnimation(fixture,actor,t+1e-6));const after=snapshot(character.scene)
        expectContinuous(before,after)
      }
    }
    character.dispose()
  })
  it('resolves simultaneous and sub-10-microsecond contacts by stable kind priority',()=>{
    for(const offset of [0,.000001]) {
      const fixture=structuredClone(scenarios[0]),receive=fixture.events.find(e=>e.type==='receive')!,shot=fixture.events.find(e=>e.type==='shot')!
      shot.t=receive.t+offset
      // A same-time receive/shot is one rendered strike under the priority rule.
      fixture.events.push({...shot,id:'duplicate-shot'})
      expect(footballActions(fixture).filter(a=>a.actorId==='a9')).toHaveLength(1)
      expect(footballActions(fixture).find(a=>a.actorId==='a9')?.kind).toBe('shot')
    }
  })
})
