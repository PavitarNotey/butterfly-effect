/// <reference types="node" />
import { readFileSync, mkdirSync, writeFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { scenarios } from '../scenario'
import { sampleAnimation } from './animationSampler'
import { footballActions, sampleFootballAction } from './footballActions'
import { createCharacter } from './characterAssets'

async function model() {
  const bytes = readFileSync(new URL('../../../public/characters/football-player.glb', import.meta.url))
  return new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
}
function bones(scene: THREE.Object3D) {
  const result: THREE.Bone[] = []
  scene.traverse(object => { if (object instanceof THREE.Bone) result.push(object) })
  return result
}
function snapshot(scene: THREE.Object3D) {
  return bones(scene).flatMap(bone => [...bone.position.toArray(), ...bone.quaternion.toArray()])
}

describe('canonical football event assignment', () => {
  it('assigns all six contacts from possession, never contextual defenders or outcome events', () => {
    const expected = [[['a8', 'pass', 9], ['a9', 'receive', 10.4], ['a9', 'shot', 14]], [['s8', 'pass', 8.5], ['s9', 'receive', 10.2], ['s9', 'shot', 15]]]
    scenarios.forEach((s, i) => {
      expect(footballActions(s).map(a => [a.actorId, a.kind, a.contact])).toEqual(expected[i])
      for (const action of footballActions(s)) {
        const actors = s.players.filter(p => sampleFootballAction(s, p, action.contact))
        expect(actors.map(p => p.id)).toEqual([action.actorId])
        const actor = actors[0]
        expect(sampleFootballAction(s, actor, action.start)).toBeNull()
        expect(sampleFootballAction(s, actor, action.end)).toBeNull()
        expect(sampleFootballAction(s, actor, action.contact)?.weight).toBe(1)
        expect(sampleFootballAction(s, actor, action.start + 1e-6)?.weight).toBeLessThan(1e-8)
        expect(sampleFootballAction(s, actor, action.end - 1e-6)?.weight).toBeLessThan(1e-8)
      }
      for (const event of s.events.filter(e => e.type === 'goal' || e.type === 'miss')) {
        expect(footballActions(s).some(a => a.eventId === event.id)).toBe(false)
      }
    })
  })
  it('ignores participant order and rejects events without a possession-backed actor', () => {
    const s = structuredClone(scenarios[0])
    s.events.forEach(e => e.playerIds.reverse())
    expect(footballActions(s).map(a => a.actorId)).toEqual(['a8', 'a9', 'a9'])
    const missing = structuredClone(s)
    missing.possession = [{ t: 0, playerId: null }]
    expect(footballActions(missing)).toEqual([])
  })
})

it('restores actual action bones after arbitrary history, repeated contact, camera-independent sampling and remount', async () => {
  const asset = await model(), source = snapshot(asset.scene), clips = JSON.stringify(asset.animations.map(clip => clip.toJSON()))
  for (const s of scenarios) for (const action of footballActions(s)) {
    const player = s.players.find(p => p.id === action.actorId)!, character = createCharacter(asset, '#abcdee')
    const parent = new THREE.Group()
    parent.add(character.scene)
    const expected = new Map<number, number[]>()
    for (const time of [action.start, action.start + .1, action.contact - .25, action.contact, action.contact + .2, action.end - .1, action.end, 20]) {
      character.evaluate(sampleAnimation(s, player, time))
      const pose = snapshot(character.scene)
      expect(pose.every(Number.isFinite)).toBe(true)
      expected.set(time, pose)
    }
    for (const [time, pose] of [...expected].reverse()) {
      for (const other of [0, 19, 3, time, time]) {
        parent.position.set(other * 3, 0, -other)
        parent.rotation.y = other * .2
        parent.updateMatrixWorld(true)
        character.evaluate(sampleAnimation(s, player, other))
      }
      expect(snapshot(character.scene)).toEqual(pose)
      const remount = createCharacter(asset, '#abcdee')
      remount.evaluate(sampleAnimation(s, player, time))
      expect(snapshot(remount.scene)).toEqual(pose)
      remount.dispose()
    }
    character.dispose()
  }
  expect(snapshot(asset.scene)).toEqual(source)
  expect(JSON.stringify(asset.animations.map(clip => clip.toJSON()))).toEqual(clips)
})

it('keeps phase boundaries continuous and all actual action vertices inside the existing culling sphere', async () => {
  const asset = await model(), point = new THREE.Vector3(), records: object[] = []
  for (const s of scenarios) for (const action of footballActions(s)) {
    const player = s.players.find(p => p.id === action.actorId)!, character = createCharacter(asset, '#abcdee')
    let mesh: THREE.SkinnedMesh | undefined
    character.scene.traverse(o => { if (o instanceof THREE.SkinnedMesh) mesh = o })
    const times = new Set([action.start, action.contact, action.end, action.contact - .28, action.contact - .19, action.contact - .14, action.contact + .16, action.contact + .18, action.contact + .20])
    for (let t = action.start; t <= action.end; t += .025) times.add(t)
    let radius = 0, minSole = Infinity, contactGap = Infinity
    for (const time of times) {
      character.evaluate(sampleAnimation(s, player, time))
      character.scene.updateMatrixWorld(true)
      const positions = mesh!.geometry.getAttribute('position')
      for (let i = 0; i < positions.count; i++) {
        mesh!.getVertexPosition(i, point)
        radius = Math.max(radius, point.distanceTo(mesh!.boundingSphere!.center))
        if (positions.getY(i) < .115) {
          minSole = Math.min(minSole, point.y + .01)
          if (time === action.contact && positions.getX(i) * (action.foot === 'l' ? 1 : -1) > .02) contactGap = Math.min(contactGap, point.clone().add(new THREE.Vector3(0, .01, 0)).distanceTo(new THREE.Vector3(...action.ballLocal)) - .16)
        }
      }
      expect(radius).toBeLessThan(mesh!.boundingSphere!.radius)
      for (const boundary of [time - .00001, time + .00001]) {
        character.evaluate(sampleAnimation(s, player, boundary))
        const q = bones(character.scene).map(b => b.quaternion.clone())
        character.evaluate(sampleAnimation(s, player, time))
        bones(character.scene).forEach((bone, i) => expect(bone.quaternion.angleTo(q[i])).toBeLessThan(.003))
      }
    }
    expect(minSole).toBeGreaterThan(-.01)
    expect(Math.abs(contactGap)).toBeLessThan(.02)
    records.push({ contactGap, scenario: s.id, actor: player.id, kind: action.kind, maxVertexRadius: radius, minSoleY: minSole })
    character.dispose()
  }
  const path = new URL('../../../../output/actions/', import.meta.url)
  mkdirSync(path, { recursive: true })
  writeFileSync(new URL('safety.json', path), JSON.stringify(records, null, 2) + '\n')
}, 30000)

it('reduces ordinary boot penetration across both rosters without changing the skeleton root or scale', async () => {
  const asset = await model(), point = new THREE.Vector3()
  let minSole = Infinity
  for (const s of scenarios) for (const player of s.players) {
    const character = createCharacter(asset, '#abcdee'), root = character.scene.getObjectByName('root')!
    const rootPose = [...root.position.toArray(), ...root.quaternion.toArray(), ...root.scale.toArray()]
    let mesh: THREE.SkinnedMesh | undefined
    character.scene.traverse(o => { if (o instanceof THREE.SkinnedMesh) mesh = o })
    const positions = mesh!.geometry.attributes.position
    const boots = Array.from({ length: positions.count }, (_, i) => i).filter(i => positions.getY(i) < .115)
    for (const time of [0, 3, 8.5, 9, 10.2, 10.4, 14, 15, 20]) {
      character.evaluate(sampleAnimation(s, player, time)); character.scene.updateMatrixWorld(true)
      for (const index of boots) minSole = Math.min(minSole, mesh!.getVertexPosition(index, point).y + .01)
      expect([...root.position.toArray(), ...root.quaternion.toArray(), ...root.scale.toArray()]).toEqual(rootPose)
    }
    character.dispose()
  }
  expect(minSole).toBeGreaterThan(-.015)
  mkdirSync(new URL('../../../../output/actions/', import.meta.url), { recursive: true })
  writeFileSync(new URL('../../../../output/actions/ground.json', import.meta.url), JSON.stringify({ sampledPlayerFrames: 396, minSoleY: minSole }) + '\n')
})
