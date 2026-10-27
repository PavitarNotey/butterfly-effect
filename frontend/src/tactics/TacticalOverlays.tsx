import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import type { Vec3, Scenario } from '../replay/types'
import { samplePosition } from '../replay/sample'
import { useTactics } from './store'
import { replayStore } from '../replay/store'
import { frameAt, momentAt } from './data'
import { writeTrajectory } from './trajectory'

const states = { clear:'#a6dfa0', contested:'#f1c363', obstructed:'#ed8c77' }
const up = new THREE.Vector3(0,1,0)
const direction = new THREE.Vector3()
function interpolate(a: Vec3, b: Vec3, fraction: number): Vec3 {
  return a.map((v,i) => v+(b[i]-v)*fraction) as Vec3
}
function beam(mesh: THREE.Mesh, a: Vec3, b: Vec3, width=.18, height=.1) {
  const dx=b[0]-a[0], dz=b[2]-a[2], length=Math.hypot(dx,dz)
  mesh.visible=length>.01
  mesh.position.set((a[0]+b[0])/2,height,(a[2]+b[2])/2)
  mesh.rotation.y=-Math.atan2(dz,dx)
  mesh.scale.set(length,.025,width)
}

/** Render-only geometry interpolation. Metrics, classifications and evidence are Python output. */
export function TacticalOverlays({ readTime, scenario }: { readTime: () => number; scenario: Scenario }) {
  const objects = useMemo(() => {
    const root=new THREE.Group()
    const box=new THREE.BoxGeometry(1,1,1)
    const mat=(color:string,opacity=1)=>new THREE.MeshBasicMaterial({color,transparent:opacity<1,opacity,depthWrite:opacity===1})
    const add=(geometry:THREE.BufferGeometry,material:THREE.Material)=>{const m=new THREE.Mesh(geometry,material);root.add(m);return m}
    const lane=add(box,mat(states.clear,.16)), center=add(box,mat(states.clear)), borders=[add(box,mat(states.clear,.65)),add(box,mat(states.clear,.65))]
    const cone=new THREE.ConeGeometry(.2,.7,8)
    const capacity = Math.max(...scenario.players.map(p => p.positions.length)) + 2
    const line = (opacity: number) => {
      const geometry = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(capacity * 3), 3))
      const route = new THREE.Line(geometry, new THREE.LineBasicMaterial({ color:'#e7fca2', transparent:true, opacity, depthWrite:false }))
      root.add(route)
      return route
    }
    const arrows=Array.from({length:8},()=>({whole:line(.28),played:line(1),head:add(cone,mat('#e7fca2')),source:null as unknown}))
    const pairs=Array.from({length:2},()=>add(box,mat('#b4e3db',.8)))
    const area=add(new THREE.CircleGeometry(1,64),mat('#9dbff1',.07))
    const boundary=add(new THREE.RingGeometry(.985,1,64),mat('#9dbff1',.8))
    for(const mesh of [area,boundary]) mesh.rotation.x=-Math.PI/2
    const nearest=add(box,mat('#9dbff1',.65))
    const ringGeometry=new THREE.RingGeometry(.78,.94,32)
    const highlights=scenario.players.map(p=>{
      const team=scenario.teams.find(t=>t.id===p.teamId)!
      const mesh=add(ringGeometry,mat(team.color,.95));mesh.rotation.x=-Math.PI/2
      return {id:p.id,mesh}
    })
    const shotGeometry=new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(64*3),3))
    const shot=new THREE.Line(shotGeometry,new THREE.LineBasicMaterial({color:'#f8e2a5'}));root.add(shot)
    root.visible=false
    return {root,lane,center,borders,arrows,pairs,area,boundary,nearest,highlights,shot}
  },[scenario])
  const overlayRef = useRef(objects)
  useLayoutEffect(() => { overlayRef.current = objects }, [objects])
  useEffect(()=>()=>{
    const geometry=new Set<THREE.BufferGeometry>(),material=new Set<THREE.Material>()
    objects.root.traverse(object=>{
      if(object instanceof THREE.Mesh || object instanceof THREE.Line){geometry.add(object.geometry);for(const m of [object.material].flat()) material.add(m)}
    })
    geometry.forEach(g=>g.dispose());material.forEach(m=>m.dispose())
  },[objects])
  useFrame(({gl})=>{
    const objects = overlayRef.current
    const state=useTactics.getState(),bundle=state.bundle,t=readTime()
    objects.root.visible=state.enabled&&!!bundle&&bundle.scenarioId===scenario.id
    gl.domElement.dataset.guidedEvidence = replayStore.getState().guided?.evidenceId ?? ''
    gl.domElement.dataset.tacticalLayers=state.enabled&&bundle ? Object.entries(state.layers).filter(([,value])=>value).map(([name])=>name).join(',') : ''
    if(!state.enabled || !bundle || bundle.scenarioId!==scenario.id) return
    const guide = replayStore.getState().guided
    const validGuide = guide && guide.scenarioId === scenario.id && guide.sourceHash === bundle.sourceHash ? guide : null
    gl.domElement.dataset.guidedEvidence = validGuide?.evidenceId ?? ''
    const {a,b,fraction}=frameAt(bundle,t),moment=validGuide ? bundle.moments.find(m => m.id === validGuide.momentId)! : momentAt(bundle,t)
    const start=interpolate(a.corridor.start,b.corridor.start,fraction),end=interpolate(a.corridor.end,b.corridor.end,fraction)
    const color=states[a.corridor.state]
    for(const mesh of [objects.lane,objects.center,...objects.borders]) (mesh.material as THREE.MeshBasicMaterial).color.set(color)
    const passing=state.layers.passing&&(validGuide ? validGuide.category !== 'finish' : moment.focus!=='finish')
    beam(objects.lane,start,end,bundle.thresholds.corridorHalfWidth*2,.065);objects.lane.visible=passing
    const traceEnd = validGuide?.category === 'corridor' && a.corridor.kind === 'observed_travel' ? samplePosition(scenario.ball,Math.min(a.corridor.arrivalTime,Math.max(a.corridor.releaseTime,t))) : end
    beam(objects.center,start,traceEnd,.16,.095);objects.center.visible=passing&&Math.hypot(traceEnd[0]-start[0],traceEnd[2]-start[2])>.01
    const dx=end[0]-start[0],dz=end[2]-start[2],length=Math.hypot(dx,dz)||1
    objects.borders.forEach((mesh,i)=>{
      const side=i===0?-1:1,w=bundle.thresholds.corridorHalfWidth
      const offset:Vec3=[-dz/length*w*side,0,dx/length*w*side]
      beam(mesh,[start[0]+offset[0],0,start[2]+offset[2]],[end[0]+offset[0],0,end[2]+offset[2]],.08,.09)
      mesh.visible=passing
    })
    const routePlayers = validGuide?.followBounds ? validGuide.relevantPlayerIds.slice(0,1) : validGuide?.kind === 'moment' && validGuide.category === 'corridor' ? [bundle.actualPass.receiverId] : validGuide?.relevantPlayerIds
    const movements = routePlayers ? moment.movements.filter(m => routePlayers.includes(m.playerId)) : moment.movements
    objects.arrows.forEach((arrow,i)=>{
      const m=movements[i]
      arrow.whole.visible=arrow.played.visible=arrow.head.visible=state.layers.movement&&!!m
      if(!arrow.whole.visible||!m) return
      if (arrow.source !== m) {
        arrow.source = m
        const attr = arrow.whole.geometry.getAttribute('position') as THREE.BufferAttribute
        arrow.whole.geometry.setDrawRange(0, writeTrajectory(attr.array as Float32Array, m.path, Infinity))
        attr.needsUpdate = true
        arrow.whole.geometry.computeBoundingSphere()
        arrow.played.geometry.boundingSphere = arrow.whole.geometry.boundingSphere!.clone()
        arrow.whole.name = `RecordedRoute:${m.playerId}`
        arrow.played.name = `MovementProgress:${m.playerId}`
      }
      const attr = arrow.played.geometry.getAttribute('position') as THREE.BufferAttribute
      arrow.played.geometry.setDrawRange(0, writeTrajectory(attr.array as Float32Array, m.path, t))
      attr.needsUpdate = true
      const current=samplePosition(m.path,Math.min(t,m.endTime))
      const previous=samplePosition(m.path,Math.max(m.startTime,Math.min(t,m.endTime)-.2))
      const length=Math.hypot(current[0]-previous[0],current[2]-previous[2])
      arrow.head.visible=length>.01
      if(length>.01){direction.set(current[0]-previous[0],0,current[2]-previous[2]).normalize();arrow.head.quaternion.setFromUnitVectors(up,direction);arrow.head.position.set(current[0],.12,current[2])}
    })
    const pairs=a.relationships.map((r,i)=>({ ...r,a:interpolate(r.a,b.relationships[i].a,fraction),b:interpolate(r.b,b.relationships[i].b,fraction) }))
      .filter(r=>(validGuide?.relevantPlayerIds ?? moment.playerIds).includes(r.aId)&&(validGuide?.relevantPlayerIds ?? moment.playerIds).includes(r.bId)).slice(0,2)
    objects.pairs.forEach((mesh,i)=>{
      mesh.visible=state.layers.relationships&&!!pairs[i]
      if(mesh.visible) beam(mesh,pairs[i].a,pairs[i].b,.11,.16)
    })
    const region=interpolate(a.space.center,b.space.center,fraction)
    for(const mesh of [objects.area,objects.boundary]){mesh.visible=state.layers.space;mesh.position.set(region[0],.06,region[2]);mesh.scale.setScalar(bundle.thresholds.coverageRadius)}
    objects.nearest.visible=state.layers.space
    if(objects.nearest.visible) beam(objects.nearest,region,samplePosition(scenario.players.find(p=>p.id===a.space.nearestDefenderId)!.positions,t),.1,.13)
    objects.highlights.forEach(({id,mesh})=>{
      mesh.visible=validGuide ? validGuide.relevantPlayerIds.includes(id) || (validGuide.category === 'space' && id === a.space.nearestDefenderId) : state.layers.relationships&&moment.playerIds.includes(id)
      if(mesh.visible){const p=scenario.players.find(p=>p.id===id)!;const position=samplePosition(p.positions,t);mesh.position.set(position[0],.08,position[2])}
    })
    objects.shot.visible=state.layers.passing&&(validGuide ? validGuide.category === 'finish' : moment.focus==='finish')
    if(objects.shot.visible){
      const attr=objects.shot.geometry.getAttribute('position') as THREE.BufferAttribute
      const path = bundle.shotPath.filter(p => p.t <= t)
      path.forEach((p,i)=>attr.setXYZ(i,p.position[0],p.position[1]+.05,p.position[2]))
      if (path.length && path.length < bundle.shotPath.length) { const p = samplePosition(scenario.ball,t); attr.setXYZ(path.length,p[0],p[1]+.05,p[2]) }
      attr.needsUpdate=true;objects.shot.geometry.setDrawRange(0,path.length + (path.length > 0 && path.length < bundle.shotPath.length ? 1 : 0));objects.shot.geometry.computeBoundingSphere()
    }
  })
  return <primitive object={objects.root} />
}
