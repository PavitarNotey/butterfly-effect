/// <reference types="node" />
import { readFileSync } from 'node:fs'
import { expect, it } from 'vitest'
import * as THREE from 'three'
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js'
import { scenarios } from '../scenario'
import { samplePosition, sampleYaw } from '../sample'
import { sampleAnimation } from './animationSampler'
import { sampleAttention } from './attention'
import { footballActions } from './footballActions'
import { sampleReaction } from './reactions'
import { createCharacter } from './characterAssets'

const s = scenarios.find(s => s.id === 'the-missed-chance')!
const player = (id: string) => s.players.find(p => p.id === id)!

it('uses a short driven shot with distance-linked jogging and distinct release/recovery phases', () => {
  const shot = footballActions(s).find(a => a.kind === 'shot')!
  expect(shot.technique).toBe('driven')
  expect(shot.start).toBeCloseTo(7.1); expect(shot.contact).toBe(7.65); expect(shot.end).toBeCloseTo(8.43)
  expect(sampleAnimation(s, player('s8'), .5).speed).toBeGreaterThan(2)
  expect(sampleAnimation(s, player('s9'), 6).weights.jog).toBeGreaterThan(.95)
  const running = player('s7')
  for (let t = 1.5; t < 3.1; t += .1) {
    const rate = Math.abs(sampleAnimation(s, running, t + .01).cycles - sampleAnimation(s, running, t).cycles) / .01
    expect(rate).toBeLessThan(2.6)
  }
  const samples = [7.1, 7.35, 7.65, 7.85, 8.43].map(t => sampleAnimation(s, player('s9'), t))
  expect(samples[2].action?.weight).toBe(1)
  expect(samples[0].action?.weight ?? 0).toBe(0)
  expect(samples[4].action?.weight ?? 0).toBeCloseTo(0)
  for (const other of scenarios.filter(other => other !== s)) expect(footballActions(other).every(a => !a.technique)).toBe(true)
})

it('tracks the ball and authored runners with bounded, smooth, deterministic illustrative scans', () => {
  for (const p of s.players) for (let t = .1; t < s.duration - .1; t += .1) {
    const a = sampleAttention(s, p, t), b = sampleAttention(s, p, t + .00001)
    expect(Math.abs(a.yaw)).toBeLessThanOrEqual(.8)
    expect(Math.abs(a.pitch)).toBeLessThanOrEqual(.3)
    expect(Math.abs(a.chest)).toBeLessThanOrEqual(.16 + 1e-12)
    expect(Math.abs(a.yaw - b.yaw)).toBeLessThan(.001)
    expect(Math.abs(a.pitch - b.pitch)).toBeLessThan(.001)
    sampleAttention(s, p, 10); sampleAttention(s, p, 0)
    expect(sampleAttention(s, p, t)).toEqual(a)
  }
  expect(sampleAttention(s, player('s8'), .7).pitch).toBeLessThan(sampleAttention(s, player('s8'), 1.4).pitch)
  for (const other of scenarios.filter(other => other !== s)) expect(sampleAttention(other, other.players[0], 3)).toEqual({ yaw: 0, pitch: 0, chest: 0 })
})

it('keeps the keeper grounded and tracking the wide flight; Finch never celebrates', () => {
  for (let t = 0; t <= s.duration; t += .04) {
    expect(sampleReaction(s, player('s9'), t)?.kind).not.toBe('celebrate')
    expect(sampleReaction(s, player('c1'), t)?.kind).not.toBe('keeper-dive')
  }
  expect(sampleReaction(s, player('c1'), 8.05)?.trackingStride).toBeGreaterThan(0)
  expect(sampleReaction(s, player('s9'), 8.9)?.kind).toBe('disappointed')
  expect(sampleReaction(s, player('c1'), 11)).toBeNull()
})

it('plants the support ankle through contact and reproduces the driving pose without moving canonical roots', async () => {
  const bytes = readFileSync(new URL('../../../public/characters/football-player.glb', import.meta.url))
  const asset = await new GLTFLoader().parseAsync(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength), '')
  const rig = createCharacter(asset, '#ccafff'), parent = new THREE.Group()
  parent.add(rig.scene)
  const p = player('s9'), shot = footballActions(s).find(a => a.kind === 'shot')!
  const foot = rig.scene.getObjectByName(shot.foot === 'l' ? 'foot_r' : 'foot_l')!
  const points: THREE.Vector3[] = []
  for (const t of [7.59, 7.65, 7.71]) {
    parent.position.set(...samplePosition(p.positions, t)); parent.rotation.y = sampleYaw(p.facing, t)
    rig.evaluate(sampleAnimation(s, p, t)); parent.updateMatrixWorld(true)
    points.push(foot.getWorldPosition(new THREE.Vector3()))
  }
  expect(Math.hypot(points[0].x - points[2].x, points[0].z - points[2].z)).toBeLessThan(.025)
  rig.dispose()
})
