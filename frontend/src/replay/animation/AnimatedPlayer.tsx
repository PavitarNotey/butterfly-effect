import { useEffect, useRef, useState } from 'react'
import type { ReactNode } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createCharacter, loadCharacter } from './characterAssets'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { sampleAnimation } from './animationSampler'
import type { Player, Scenario } from '../types'

function SkinnedPlayer({ asset, player, scenario, color, readTime, numberMaterial }: {
  asset: GLTF; player: Player; scenario: Scenario; color: string; readTime: () => number; numberMaterial: THREE.Material
}) {
  const root = useRef<THREE.Group>(null)
  const instance = useRef<ReturnType<typeof createCharacter> | null>(null)
  useEffect(() => {
    const character = createCharacter(asset, color, numberMaterial)
    const group = root.current!
    instance.current = character
    character.evaluate(sampleAnimation(scenario, player, readTime()))
    group.add(character.scene)
    return () => {
      instance.current = null
      group.remove(character.scene)
      character.dispose()
    }
  }, [asset, color, scenario, player, readTime, numberMaterial])
  useFrame(() => instance.current?.evaluate(sampleAnimation(scenario, player, readTime())))
  return <group ref={root} position={[0, .01, 0]} dispose={null} name="Voss-skeletal-prototype" />
}

/** Loading/failure affects only this body; canonical root, selection and match persist. */
export function AnimatedPlayer(props: {
  player: Player; scenario: Scenario; color: string; readTime: () => number; fallback: ReactNode; numberMaterial: THREE.Material
}) {
  const [asset, setAsset] = useState<GLTF | null>(null)
  const gl = useThree(state => state.gl)
  useEffect(() => {
    gl.domElement.setAttribute('data-character-renderer', asset ? 'rigged-voss' : 'procedural')
    return () => { gl.domElement.removeAttribute('data-character-renderer') }
  }, [asset, gl])
  useEffect(() => {
    let active = true
    void loadCharacter().then(model => { if (active) setAsset(model) }).catch(() => {
      // The procedural body remains visible when loading or validation fails.
    })
    return () => { active = false }
  }, [])
  return asset ? <SkinnedPlayer {...props} asset={asset} /> : props.fallback
}
