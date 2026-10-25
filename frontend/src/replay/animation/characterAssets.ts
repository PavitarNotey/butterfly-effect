import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import type { GLTF } from 'three/addons/loaders/GLTFLoader.js'
import { clone } from 'three/addons/utils/SkeletonUtils.js'
import type { AnimationSample } from './animationSampler'
import { acquireKit } from './kitMaterial'
import { createFootballPose } from './footballPose'

export const CHARACTER_URL = '/characters/football-player.glb'
const clipNames = { idle: 'Idle_Loop', walk: 'Walk_Loop', jog: 'Jog_Fwd_Loop' } as const
let assetPromise: Promise<GLTF> | undefined
const clipCache = new WeakMap<GLTF, { key: keyof AnimationSample['weights']; clip: THREE.AnimationClip }[]>()

export function validateCharacter(asset: GLTF) {
  if (!Object.values(clipNames).every(name => asset.animations.some(clip => clip.name === name && Number.isFinite(clip.duration) && clip.duration > 0))) throw new Error('Missing locomotion clips')
  const skins: THREE.SkinnedMesh[] = []
  asset.scene.traverse(object => { if (object instanceof THREE.SkinnedMesh) skins.push(object) })
  const requiredBones = ['root', 'pelvis', 'spine_01', 'spine_02', 'spine_03', 'neck_01', ...['l', 'r'].flatMap(side => ['thigh', 'calf', 'foot', 'ball', 'upperarm', 'lowerarm', 'hand'].map(name => `${name}_${side}`))]
  if (skins.length !== 1 || skins[0].skeleton.bones.length !== 65 || requiredBones.some(name => !asset.scene.getObjectByName(name))) throw new Error('Incompatible skeletal asset')
  if (['position', 'normal', 'skinIndex', 'skinWeight', 'color'].some(name => !skins[0].geometry.getAttribute(name))) throw new Error('Missing character geometry attributes')
  return asset
}

/** One immutable source and one request, including across StrictMode and scenarios.
 * A rejected load stays failed until page reload; switching cannot cause retry storms.
 */
export function loadCharacter() {
  assetPromise ??= new GLTFLoader().loadAsync(CHARACTER_URL).then(validateCharacter)
  return assetPromise
}

/** Independent bones, skeleton, mixer and actions. Geometry, clips, atlas and
 * identical kit materials are shared. The caller owns one acquire/release pair.
 */
export function createCharacter(asset: GLTF, color: string, number = 9, goalkeeper = false) {
  const scene = clone(asset.scene)
  const kit = acquireKit(color, number, goalkeeper)
  const skeletons = new Set<THREE.Skeleton>()
  scene.traverse(object => {
    if (!(object instanceof THREE.SkinnedMesh)) return
    object.material = kit.material
    object.castShadow = true
    object.frustumCulled = true
    // Conservative local envelope verified for locomotion and football actions.
    // Tests check deformed vertices, rather than using T-pose bounds.
    object.boundingSphere = new THREE.Sphere(new THREE.Vector3(0, .95, 0), 2.35)
    skeletons.add(object.skeleton)
  })
  let clips = clipCache.get(asset)
  if (!clips) {
    clips = Object.entries(clipNames).map(([key, name]) => {
      const clip = asset.animations.find(clip => clip.name === name)!.clone()
      clip.tracks = clip.tracks.filter(track => !/^root\./.test(track.name))
      return { key: key as keyof AnimationSample['weights'], clip }
    })
    clipCache.set(asset, clips)
  }
  const footballPose = createFootballPose(scene)
  const rawBones: { bone: THREE.Object3D; q: THREE.Quaternion; p: THREE.Vector3 }[] = []
  scene.traverse(bone => { if (bone instanceof THREE.Bone) rawBones.push({ bone, q: bone.quaternion.clone(), p: bone.position.clone() }) })
  const mixer = new THREE.AnimationMixer(scene)
  const actions = clips.map(({ key, clip }) => {
    const action = mixer.clipAction(clip)
    action.play(); action.paused = true
    return { key, action, duration: clip.duration }
  })
  const pelvis = scene.getObjectByName('pelvis')!, spine = scene.getObjectByName('spine_01')!
  const twist = new THREE.Quaternion(), rootUp = new THREE.Vector3(0, 0, 1), spineUp = new THREE.Vector3(0, 1, 0), leanAxis = new THREE.Vector3(1, 0, 0)
  let disposed = false
  return {
    scene,
    evaluate(sample: AnimationSample) {
      for (const { key, action, duration } of actions) {
        action.enabled = true
        action.setEffectiveWeight(sample.weights[key])
        action.time = key === 'idle' ? sample.idleTime % duration : ((sample.cycles % 1 + 1) % 1) * duration
      }
      // Explicit clip times + update(0): never accumulated frame/wall time.
      // Restore the last unmapped pose first: Three may skip writing an unchanged
      // binding, so an external cosmetic twist must never accumulate on that pose.
      rawBones.forEach(p => { p.bone.quaternion.copy(p.q); p.bone.position.copy(p.p) })
      mixer.update(0)
      rawBones.forEach(p => { p.q.copy(p.bone.quaternion); p.p.copy(p.bone.position) })
      // Modest lower-body turning cue; canonical root yaw is never changed.
      pelvis.quaternion.premultiply(twist.setFromAxisAngle(rootUp, sample.lowerBodyYaw))
      spine.quaternion.multiply(twist.setFromAxisAngle(spineUp, -sample.lowerBodyYaw))
      // Faster authored runs use the existing jog rig with a restrained lean;
      // distance-indexed stride length handles cadence without a new clip.
      spine.quaternion.multiply(twist.setFromAxisAngle(leanAxis, Math.max(0, Math.min(1, (sample.speed - 3.2) / 2.3)) * .12))
      footballPose.apply(sample.action, sample.reaction, sample.dummy)
    },
    dispose() {
      if (disposed) return
      disposed = true
      mixer.stopAllAction(); mixer.uncacheRoot(scene)
      skeletons.forEach(skeleton => skeleton.dispose())
      kit.release()
      // Shared source geometry, clips and number atlas live for the page lifetime.
    },
  }
}
