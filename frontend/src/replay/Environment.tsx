import { useMemo } from 'react'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import type { Vec3 } from './types'

const white = '#c5dac5'
function rectangle(x0: number, x1: number, z0: number, z1: number): Vec3[] {
  return [[x0,.035,z0],[x1,.035,z0],[x1,.035,z1],[x0,.035,z1],[x0,.035,z0]]
}
function arc(x: number, z: number, radius: number, start = 0, end = Math.PI * 2): Vec3[] {
  return Array.from({ length: 65 }, (_, i) => [x + Math.cos(start + (end-start)*i/64)*radius, .04, z + Math.sin(start + (end-start)*i/64)*radius])
}
function Goal({ side }: { side: number }) {
  const net = useMemo(() => {
    const points: number[] = []
    const add = (a: number[], b: number[]) => points.push(...a, ...b)
    for (let z = -3.66; z <= 3.67; z += .3) {
      add([1.8,0,z],[1.8,2.44,z]); add([0,2.44,z],[1.8,2.44,z])
    }
    for (let y = 0; y <= 2.45; y += .3) {
      add([1.8,y,-3.66],[1.8,y,3.66]); add([0,y,-3.66],[1.8,y,-3.66]); add([0,y,3.66],[1.8,y,3.66])
    }
    return new THREE.BufferGeometry().setAttribute('position', new THREE.Float32BufferAttribute(points,3))
  }, [])
  return <group position={[side*52.5,0,0]} rotation={[0,side === 1 ? 0 : Math.PI,0]}>
    {[-3.66,3.66].map(z => <mesh key={z} position={[0,1.22,z]} castShadow><cylinderGeometry args={[.065,.065,2.44,10]} /><meshStandardMaterial color="#f1f3e6" /></mesh>)}
    <mesh position={[0,2.44,0]} rotation={[Math.PI/2,0,0]} castShadow><cylinderGeometry args={[.065,.065,7.32,10]} /><meshStandardMaterial color="#f1f3e6" /></mesh>
    <lineSegments geometry={net}><lineBasicMaterial color="#dbe6d9" transparent opacity={.32} /></lineSegments>
    <mesh position={[1.8,1.22,0]}><boxGeometry args={[.035,2.44,7.32]} /><meshStandardMaterial color="#adc3b5" transparent opacity={.08} depthWrite={false} /></mesh>
  </group>
}

export function Environment() {
  const markings = [rectangle(-52.5,52.5,-34,34), [[0,.035,-34],[0,.035,34]] as Vec3[], arc(0,0,9.15)]
  for (const side of [-1,1]) {
    const x=side*52.5
    markings.push(rectangle(Math.min(x,x-side*16.5),Math.max(x,x-side*16.5),-20.16,20.16))
    markings.push(rectangle(Math.min(x,x-side*5.5),Math.max(x,x-side*5.5),-9.16,9.16))
    markings.push(arc(side*41.5,0,9.15,side===1 ? Math.PI-.925 : -.925,side===1 ? Math.PI+.925 : .925))
    for(const z of [-34,34]) markings.push(arc(x,z,1,side===1 ? Math.PI : 0,side===1 ? (z>0?1.5*Math.PI:.5*Math.PI) : (z>0?-.5*Math.PI:.5*Math.PI)))
  }
  return <>
    <color attach="background" args={['#101d24']} />
    <fog attach="fog" args={['#101d24',100,200]} />
    <hemisphereLight args={['#d8eef5','#344a31',1.8]} />
    <directionalLight position={[-20,65,30]} intensity={2.7} castShadow shadow-mapSize={[2048,2048]} shadow-camera-left={-65} shadow-camera-right={65} shadow-camera-top={48} shadow-camera-bottom={-48} shadow-camera-far={160} shadow-bias={-.0003} shadow-normalBias={.04} />
    <directionalLight position={[50,35,-40]} intensity={1.2} color="#bbdcff" />
    <mesh rotation={[-Math.PI/2,0,0]} position={[0,-.08,0]} receiveShadow><planeGeometry args={[170,125]} /><meshStandardMaterial color="#152626" roughness={1} /></mesh>
    {Array.from({length:20},(_,i) => <mesh key={i} rotation={[-Math.PI/2,0,0]} position={[-49.875+i*5.25,0,0]} receiveShadow><planeGeometry args={[5.25,68]} /><meshStandardMaterial color={i%2 ? '#2b6c45' : '#30774a'} roughness={.97} /></mesh>)}
    {markings.map((points,i)=><Line key={i} points={points} color={white} lineWidth={1.3} />)}
    {[-41.5,0,41.5].map(x=><mesh key={x} position={[x,.04,0]} rotation={[-Math.PI/2,0,0]}><circleGeometry args={[.17,12]} /><meshBasicMaterial color={white} /></mesh>)}
    <Goal side={1} /><Goal side={-1} />
    {[-1,1].map(side=><group key={side}>
      {[0,1,2,3].map(tier=><mesh key={tier} position={[0,1+tier*1.7,side*(43+tier*3)]} receiveShadow><boxGeometry args={[128,1.5,3]} /><meshStandardMaterial color={tier%2 ? '#243c42' : '#203039'} roughness={.9} /></mesh>)}
      <mesh position={[0,.6,side*38.5]}><boxGeometry args={[116,1.2,.3]} /><meshStandardMaterial color="#17383a" emissive="#30746f" emissiveIntensity={.35} /></mesh>
      {[0,1,2].map(tier=><mesh key={`end${tier}`} position={[side*(61+tier*3),1+tier*1.7,0]}><boxGeometry args={[3,1.5,78]} /><meshStandardMaterial color="#20333b" /></mesh>)}
      {[-45,45].map(x=><group key={x} position={[x,0,side*45]}>
        <mesh position={[0,10,0]}><cylinderGeometry args={[.16,.25,20,8]} /><meshStandardMaterial color="#45575d" /></mesh>
        <mesh position={[0,20,0]} rotation={[side*.3,0,0]}><boxGeometry args={[6,1,.4]} /><meshStandardMaterial color="#e3f8ff" emissive="#a9dbe5" emissiveIntensity={2} /></mesh>
      </group>)}
    </group>)}
  </>
}
