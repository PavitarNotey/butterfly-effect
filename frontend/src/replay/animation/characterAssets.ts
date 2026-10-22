import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { AnimationSample } from './animationSampler'

export const CHARACTER_URL = '/characters/voss/player.glb'
const clipNames = { idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop' } as const
let assetPromise: Promise<GLTF> | undefined

/** One immutable source asset. Failed requests are retryable on the next mount. */
export function loadCharacter() {
  assetPromise ??= new GLTFLoader().loadAsync(CHARACTER_URL).then(asset => {
    if (!Object.values(clipNames).every(name => asset.animations.some(clip => clip.name === name))) throw new Error('Missing locomotion clips')
    let skinned = false
    asset.scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) skinned = true })
    if (!skinned || !asset.scene.getObjectByName('root') || !asset.scene.getObjectByName('spine_03')) throw new Error('Character must contain the compatible skeletal skin')
    return asset
  }).catch((error: unknown) => { assetPromise = undefined; throw error })
  return assetPromise
}

/** Independent bones, mixer and kit materials; immutable geometry is shared.
 * Creation happens in an effect, so StrictMode cleanup/setup owns fresh instances.
 */
export function createCharacter(asset: GLTF, color: string, numberMaterial?: THREE.Material) {
  const scene = clone(asset.scene)
  const materials = new Map<THREE.Material, THREE.Material>()
  const skeletons = new Set<THREE.Skeleton>()
  scene.traverse(object => {
    if (!(object instanceof THREE.Mesh)) return
    object.castShadow = true
    // Animated bounds must not be inferred from a stale T-pose.
    object.frustumCulled = false
    const ownMaterial = (source: THREE.Material) => {
      let material = materials.get(source)
      if (!material) {
        material = source.clone()
        if (material.name === 'kit') (material as THREE.MeshStandardMaterial).color.set(color)
        materials.set(source, material)
      }
      return material
    }
    object.material = Array.isArray(object.material) ? object.material.map(ownMaterial) : ownMaterial(object.material)
    if (object instanceof THREE.SkinnedMesh) skeletons.add(object.skeleton)
  })
  const numberGeometry = numberMaterial ? new THREE.PlaneGeometry(.23, .26) : null
  if (numberMaterial && numberGeometry) {
    scene.updateMatrixWorld(true)
    const spine = scene.getObjectByName('spine_03')!
    const inverse = spine.getWorldQuaternion(new THREE.Quaternion()).invert()
    for (const side of [1, -1]) {
      const number = new THREE.Mesh(numberGeometry, numberMaterial)
      number.position.copy(spine.worldToLocal(new THREE.Vector3(0, 1.4, side * .19)))
      number.quaternion.copy(inverse).multiply(new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), side === 1 ? 0 : Math.PI))
      spine.add(number)
    }
  }
  const mixer = new THREE.AnimationMixer(scene)
  const actions = Object.entries(clipNames).flatMap(([key, name]) => (key === 'idle' ? [false] : [false, true]).map(backward => {
    const source = asset.animations.find(clip => clip.name === name)!
    // Defence in depth: imported root transforms never control world placement.
    const clip = source.clone()
    clip.name += backward ? ':backward' : ':forward'
    clip.tracks = clip.tracks.filter(track => !/^root\./.test(track.name))
    const action = mixer.clipAction(clip)
    action.play()
    action.paused = true
    return { key: key as keyof AnimationSample['weights'], action, duration: clip.duration, backward }
  }))
  return {
    scene,
    evaluate(sample: AnimationSample) {
      for (const { key, action, duration, backward } of actions) {
        action.enabled = true
        action.setEffectiveWeight(sample.weights[key] * (key === 'idle' ? 1 : backward ? sample.backward : 1 - sample.backward))
        action.time = key === 'idle' ? sample.idleTime % duration : (backward ? 1 - sample.cycles % 1 : sample.cycles % 1) * duration
      }
      // update(0) evaluates explicitly assigned clip times and weights, including
      // paused/backward seeks. No update(delta), fades, warps or accumulated time.
      mixer.update(0)
      scene.updateMatrixWorld(true)
    },
    dispose() {
      mixer.stopAllAction()
      mixer.uncacheRoot(scene)
      skeletons.forEach(skeleton => skeleton.dispose())
      materials.forEach(material => material.dispose())
      numberGeometry?.dispose()
      // Source geometry/materials remain cached; no per-instance textures exist.
    },
  }
}
