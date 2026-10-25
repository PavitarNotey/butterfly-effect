import { Component, Suspense, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { Environment } from './Environment'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { AnimatedPlayer } from './animation/AnimatedPlayer'
import { useCharacterAsset } from './animation/useCharacterAsset'
import { TacticalOverlays } from '../tactics/TacticalOverlays'
import { samplePosition, sampleSpeed, sampleTravel, sampleYaw } from './sample'
import { replayStore, useReplay } from './store'
import { sampleCamera } from './camera'
import { TacticalCameraControls } from './TacticalCameraControls'
import type { Player, Scenario } from './types'

// One sample per rendered frame, shared by players, ball, trails and camera.
const frameTime = { current: 0 }
const readFrameTime = () => frameTime.current
function FrameClock() {
  useFrame(() => {
    const state = replayStore.getState()
    frameTime.current = state.readTime()
    if (state.playing && state.guided && frameTime.current >= state.guided.endTime) state.completeGuided()
    else if (state.playing && frameTime.current >= state.scenario.duration) state.pause()
  }, -100)
  return null
}

// Shared procedural fallback geometry and selection resources.
const headGeometry = new THREE.SphereGeometry(1,12,10)
const bodyGeometry = new THREE.CapsuleGeometry(.24,.42,4,10)
const limbGeometry = new THREE.CapsuleGeometry(.085,.23,3,8)
const boxGeometry = new THREE.BoxGeometry(1,1,1)
const skin = new THREE.MeshStandardMaterial({color:'#d7b394',roughness:.9})
const shorts = new THREE.MeshStandardMaterial({color:'#17252d',roughness:.9})
const boots = new THREE.MeshStandardMaterial({color:'#e8efde',roughness:.7})
const numberGeometry = new THREE.PlaneGeometry(.31,.31)
const selectionGeometry = new THREE.RingGeometry(.65,.76,40)
const selectionMaterial = new THREE.MeshBasicMaterial({color:'#e7fca2',transparent:true,opacity:.95,depthTest:false})
const hoverMaterial = new THREE.MeshBasicMaterial({color:'#f2f6ed',transparent:true,opacity:.5,depthTest:false})

function Team({ scenario }: { scenario: Scenario }) {
  // Full-team profiling passed; comparison/fallback modes remain reproducible.
  const requested = new URLSearchParams(location.search).get('characters')
  const characterMode = requested === 'procedural' || requested === 'single' ? requested : 'skeletal'
  const asset = useCharacterAsset(characterMode !== 'procedural')
  const gl = useThree(state => state.gl)
  useEffect(() => {
    gl.domElement.setAttribute('data-character-renderer', asset ? 'skeletal' : 'procedural')
    gl.domElement.setAttribute('data-character-mode', characterMode)
    return () => { gl.domElement.removeAttribute('data-character-renderer'); gl.domElement.removeAttribute('data-character-mode') }
  }, [asset, characterMode, gl])
  const materials = useMemo(() => Object.fromEntries(scenario.teams.flatMap(t => [
    [t.id,new THREE.MeshStandardMaterial({color:t.color,roughness:.8})],
    [`${t.id}:gk`,new THREE.MeshStandardMaterial({color:t.goalkeeperColor,roughness:.8})],
  ])), [scenario])
  useEffect(() => () => Object.values(materials).forEach(m => m.dispose()), [materials])
  return <>{scenario.players.map(p => <PlayerFigure key={`${scenario.id}:${p.id}`} asset={asset} rigged={characterMode === 'skeletal' || (characterMode === 'single' && scenario.id === 'the-invisible-run' && p.id === 'a9')} scenario={scenario} player={p} material={materials[`${p.teamId}${p.role === 'Goalkeeper' ? ':gk' : ''}`]} />)}</>
}

function useNumber(number: number) {
  return useMemo(()=>{
    const c=document.createElement('canvas'); c.width=128;c.height=128
    const ctx=c.getContext('2d')!
    ctx.clearRect(0,0,128,128);ctx.fillStyle='#14232b';ctx.font='bold 92px Arial';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(String(number),64,68)
    return new THREE.CanvasTexture(c)
  },[number])
}

function ProceduralMannequin({ player, material }: { player: Player; material: THREE.Material }) {
  const leftLeg=useRef<THREE.Group>(null),rightLeg=useRef<THREE.Group>(null)
  const leftArm=useRef<THREE.Group>(null),rightArm=useRef<THREE.Group>(null)
  const number=useNumber(player.number)
  const numberMaterial = useMemo(() => new THREE.MeshBasicMaterial({map:number,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1}), [number])
  useEffect(() => () => { number.dispose(); numberMaterial.dispose() }, [number,numberMaterial])
  useFrame(()=>{
    const t=frameTime.current
    const amplitude=Math.min(.65,sampleSpeed(player.positions,t)*.12)
    const stride=Math.sin(t*9+player.number)*amplitude
    if(leftLeg.current) leftLeg.current.rotation.x=stride
    if(rightLeg.current) rightLeg.current.rotation.x=-stride
    if(leftArm.current) leftArm.current.rotation.x=-stride*.7
    if(rightArm.current) rightArm.current.rotation.x=stride*.7
  })
  const shirtNumbers = [1,-1].map(side=><mesh key={side} position={[0,1.19,side*.18]} rotation={[0,side===1?0:Math.PI,0]}><primitive object={numberGeometry} attach="geometry" /><primitive object={numberMaterial} attach="material" /></mesh>)
  return <>
    <mesh geometry={bodyGeometry} material={material} position={[0,1.14,0]} scale={[1,.94,.74]} castShadow />
    <mesh geometry={boxGeometry} material={shorts} position={[0,.78,0]} scale={[.43,.25,.3]} castShadow />
    <mesh geometry={headGeometry} material={skin} position={[0,1.7,0]} scale={[.185,.215,.18]} castShadow />
    <mesh geometry={limbGeometry} material={skin} position={[0,1.48,0]} scale={[.75,.45,.75]} />
    {[-1,1].map(side=><group key={side} ref={side===-1?leftArm:rightArm} position={[side*.32,1.4,0]} rotation={[0,0,side*.13]}>
      <mesh geometry={limbGeometry} material={material} position={[0,-.12,0]} scale={[1,.85,1]} castShadow />
      <mesh geometry={limbGeometry} material={skin} position={[0,-.39,.035]} scale={[.85,.88,.85]} castShadow />
    </group>)}
    {[-1,1].map(side=><group key={side} ref={side===-1?leftLeg:rightLeg} position={[side*.14,.73,0]}>
      <mesh geometry={limbGeometry} material={skin} position={[0,-.14,0]} scale={[1.18,.85,1.18]} castShadow />
      <mesh geometry={limbGeometry} material={material} position={[0,-.46,0]} scale={[.9,.9,.9]} castShadow />
      <mesh geometry={boxGeometry} material={boots} position={[0,-.66,.07]} scale={[.17,.12,.32]} castShadow />
    </group>)}
    {shirtNumbers}
  </>
}

function PlayerFigure({ player, material, scenario, rigged, asset }: {
  player: Player; material: THREE.Material; scenario: Scenario; rigged: boolean; asset: GLTF | null
}) {
  const root=useRef<THREE.Group>(null)
  const selected=useReplay(s=>s.selectedId===player.id)
  const camera=useReplay(s=>s.camera)
  const [hovered,setHovered]=useState(false)
  useEffect(() => () => { document.body.style.cursor = '' }, [])
  useEffect(() => { if (camera.startsWith('pov:')) document.body.style.cursor = '' }, [camera])
  useFrame(()=>{
    if(!root.current) return
    const t=frameTime.current
    root.current.position.set(...samplePosition(player.positions,t))
    root.current.rotation.y=sampleYaw(player.facing,t)
  })
  return <group name={`Player:${player.id}`} userData={{playerId:player.id,scenarioId:scenario.id}} ref={root} visible={camera!==`pov:${player.id}`} dispose={null}
    onClick={event => { event.stopPropagation(); if (event.delta <= 6) replayStore.getState().selectPlayer(player.id) }}
    onPointerOver={event => { event.stopPropagation(); setHovered(true); document.body.style.cursor='pointer' }}
    onPointerOut={() => { setHovered(false); document.body.style.cursor='' }}>
    {rigged && asset
      ? <AnimatedPlayer asset={asset} player={player} scenario={scenario} color={(material as THREE.MeshStandardMaterial).color.getStyle()} readTime={readFrameTime} />
      : <ProceduralMannequin player={player} material={material} />}
    {(selected || hovered) && <mesh name={`PlayerMarker:${player.id}`} rotation={[-Math.PI/2,0,0]} position={[0,.06,0]} scale={selected ? 1 : .86} renderOrder={10}><primitive object={selectionGeometry} attach="geometry" /><primitive object={selected ? selectionMaterial : hoverMaterial} attach="material" /></mesh>}
  </group>
}

/** Keep the existing selected-player label in the outer DOM root. Drei Html's nested
 * root synchronously unmounts during selection/StrictMode cleanup in this version. */
type LabelPose = { x: number; y: number; scale: number } | null
function PlayerLabel({ update }: { update: (pose: LabelPose) => void }) {
  const point = useMemo(() => new THREE.Vector3(), [])
  useFrame(({ camera, size }) => {
    const state = replayStore.getState()
    if (state.camera.startsWith('pov:')) { update(null); return }
    const player = state.selectedId ? state.scenario.players.find(p => p.id === state.selectedId) : null
    if (!player) { update(null); return }
    const position = samplePosition(player.positions, frameTime.current)
    point.set(position[0], 2.5, position[2])
    const distance = camera.position.distanceTo(point)
    camera.updateMatrixWorld()
    point.project(camera)
    if (point.z < -1 || point.z > 1 || Math.abs(point.x) > 1 || Math.abs(point.y) > 1) { update(null); return }
    const scale = Math.min(1, 38 / (2 * Math.tan((camera as THREE.PerspectiveCamera).fov * Math.PI / 360) * distance))
    update({ x: (point.x + 1) * size.width / 2, y: (1 - point.y) * size.height / 2, scale })
  })
  return null
}

function Ball() {
  const scenario = useReplay(s => s.scenario)
  const ref=useRef<THREE.Mesh>(null)
  const texture=useMemo(()=>{
    const c=document.createElement('canvas');c.width=128;c.height=64
    const ctx=c.getContext('2d')!;ctx.fillStyle='#fffbe9';ctx.fillRect(0,0,128,64);ctx.fillStyle='#142d39'
    for(let y=0;y<3;y++) for(let x=0;x<5;x++){ctx.beginPath();ctx.arc(x*32+(y%2)*16,y*32,7,0,Math.PI*2);ctx.fill()}
    return new THREE.CanvasTexture(c)
  },[])
  useEffect(() => () => texture.dispose(), [texture])
  useFrame(()=>{if(ref.current){const t=frameTime.current;ref.current.position.set(...samplePosition(scenario.ball,t));ref.current.rotation.set(0,0,-sampleTravel(scenario.ball,t)/.16)}})
  return <mesh ref={ref} castShadow><sphereGeometry args={[.16,20,16]} /><meshStandardMaterial map={texture} roughness={.6} /></mesh>
}

function Trails() {
  const scenario = useReplay(s => s.scenario)
  const geometry=useMemo(()=>new THREE.BufferGeometry().setAttribute('position',new THREE.BufferAttribute(new Float32Array(3*49),3)),[])
  const selected=useReplay(s=>s.selectedId)
  const enabled=useReplay(s=>s.trails)
  useFrame(()=>{
    if(!enabled) return
    const player=selected ? scenario.players.find(p=>p.id===selected) : null
    if (!player) return
    const t=frameTime.current
    const attr=geometry.getAttribute('position') as THREE.BufferAttribute
    for(let i=0;i<49;i++) {
      const p=samplePosition(player.positions,Math.max(0,t-6)+Math.min(t,6)*i/48)
      attr.setXYZ(i,p[0],.08,p[2])
    }
    attr.needsUpdate=true;geometry.computeBoundingSphere()
  })
  const trail=useMemo(()=>new THREE.Line(geometry,new THREE.LineBasicMaterial({color:'#e7fca2',transparent:true,opacity:.8})),[geometry])
  useEffect(() => () => { geometry.dispose(); trail.material.dispose() }, [geometry,trail])
  return <primitive object={trail} visible={enabled&&!!selected} />
}

function CameraRig() {
  const transition = useRef<{ key: string; start: number; from: THREE.Vector3; rotation: THREE.Quaternion; fov: number } | null>(null)
  const target = useMemo(() => new THREE.PerspectiveCamera(), [])
  const povReturn = useRef<{ start: number; rotation: THREE.Quaternion } | null>(null)
  const wasPlaying = useRef(false)
  useFrame(({ camera, gl })=>{
    const state=replayStore.getState(),t=frameTime.current
    const pose=sampleCamera(state.scenario,state.camera,t,{ aspect: (camera as THREE.PerspectiveCamera).aspect, tacticalView: state.tacticalView, freeLook: state.freeLook, reducedMotion: state.reducedMotion, guided: state.guided })
    const perspective=camera as THREE.PerspectiveCamera
    const key = `${state.scenario.id}:${state.camera}:${state.guided?.evidenceId ?? ''}`
    const previous = transition.current
    if (previous?.key !== key || state.reducedMotion || !state.camera.startsWith('pov:') || state.freeLook.yaw !== 0 || state.freeLook.pitch !== 0) povReturn.current = null
    if (state.camera.startsWith('pov:') && state.playing && !wasPlaying.current && previous?.key === key && !state.reducedMotion) povReturn.current = { start: performance.now(), rotation: camera.quaternion.clone() }
    wasPlaying.current = state.playing
    if (!previous || previous.key !== key) {
      // A deliberate mode change gets one short presentation transition. POV
      // remains anchored immediately; no fly-through or history-based gaze.
      transition.current = { key, start: previous && !state.reducedMotion && !state.camera.startsWith('pov:') && !previous.key.includes(':pov:') ? performance.now() : -Infinity, from: camera.position.clone(), rotation: camera.quaternion.clone(), fov: perspective.fov }
    }
    const current = transition.current!
    target.position.set(...pose.position); target.up.set(...pose.up); target.lookAt(...pose.target)
    const amount = state.reducedMotion ? 1 : Math.max(0, Math.min(1, (performance.now() - current.start) / 280)), blend = amount * amount * (3 - 2 * amount)
    gl.domElement.dataset.cameraSettled = String(amount === 1)
    if (blend === 1) { camera.position.copy(target.position); camera.quaternion.copy(target.quaternion) }
    else { camera.position.copy(current.from).lerp(target.position, blend); camera.quaternion.copy(current.rotation).slerp(target.quaternion, blend) }
    if (povReturn.current) {
      const fraction = Math.min(1, (performance.now() - povReturn.current.start) / 220), eased = fraction * fraction * (3 - 2 * fraction)
      camera.quaternion.copy(povReturn.current.rotation).slerp(target.quaternion, eased)
      gl.domElement.dataset.cameraSettled = String(fraction === 1)
      if (fraction === 1) povReturn.current = null
    }
    camera.up.set(...pose.up)
    const fov = current.fov + (pose.fov - current.fov) * blend
    if(perspective.fov!==fov){perspective.fov=fov;perspective.updateProjectionMatrix()}
  }, -50)
  return null
}

function ContextMonitor({ setLost }: { setLost: (lost: boolean) => void }) {
  const gl = useThree(s => s.gl)
  useEffect(() => {
    const canvas = gl.domElement
    function lost(event: Event) { event.preventDefault(); setLost(true) }
    function restored() { setLost(false) }
    canvas.addEventListener('webglcontextlost', lost)
    canvas.addEventListener('webglcontextrestored', restored)
    return () => {
      canvas.removeEventListener('webglcontextlost', lost)
      canvas.removeEventListener('webglcontextrestored', restored)
    }
  }, [gl, setLost])
  return null
}

class SceneBoundary extends Component<{children:ReactNode},{failed:boolean}> {
  state={failed:false}
  static getDerivedStateFromError(){return {failed:true}}
  render(){return this.state.failed?<div className="scene-message" role="alert">The replay could not render. Reload in a browser with WebGL enabled.</div>:this.props.children}
}

export function ReplayScene() {
  const scenario = useReplay(s => s.scenario)
  const selectedId = useReplay(s => s.selectedId)
  const selected = selectedId ? scenario.players.find(p => p.id === selectedId) : null
  const label = useRef<HTMLDivElement>(null)
  const updateLabel = useCallback((pose: LabelPose) => {
    const element = label.current
    if (!element) return
    element.style.display = pose ? 'block' : 'none'
    if (pose) element.style.transform = `translate(${pose.x}px,${pose.y}px) translate(-50%,-50%) scale(${pose.scale})`
  }, [])
  const [ready,setReady]=useState(false)
  const [lost,setLost]=useState(false)
  return <SceneBoundary>
    {!ready&&<div className="scene-message">Preparing the pitch…</div>}
    {lost&&<div className="scene-message" role="alert">Graphics connection lost. Reload to restore the replay.</div>}
    <Canvas shadows dpr={[1,1.5]} camera={{position:[10,38,53],fov:49,near:.1,far:240}} gl={{antialias:true,powerPreference:'high-performance'}} onCreated={({gl})=>{setReady(true);setLost(false);gl.domElement.setAttribute('aria-label','Interactive 3D football replay')}} fallback={<div className="scene-message">WebGL is required for the 3D replay.</div>}>
      <Suspense fallback={null}><FrameClock /><ContextMonitor setLost={setLost} /><Environment /><Team scenario={scenario} /><Ball /><Trails /><TacticalOverlays key={scenario.id} scenario={scenario} readTime={readFrameTime} /><CameraRig /><TacticalCameraControls /><PlayerLabel update={updateLabel} /></Suspense>
    </Canvas>
    <div ref={label} className="world-player-label" style={{position:'absolute',left:0,top:0,pointerEvents:'none',display:'none'}}>{selected ? <span className="player-label">{selected.number} · {selected.name}</span> : null}</div>
    <span className="scene-ready" data-testid="scene-ready" data-ready={ready&&!lost} aria-hidden="true" />
  </SceneBoundary>
}
