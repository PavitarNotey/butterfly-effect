import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { Color, PerspectiveCamera, Vector3 } from 'three'
import type { Object3D, Mesh, Material } from 'three'
import invisible from '../src/replay/invisible-run.json' with { type: 'json' }
import missed from '../src/replay/missed-chance.json' with { type: 'json' }
import { sampleCamera } from '../src/replay/camera'
import { selectPlayer, viewPlayerPov } from './player-picker'
import { samplePosition, sampleYaw } from '../src/replay/sample'

async function settle(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.cameraSettled === 'true')
}
async function inspect(page: Page) {
  await settle(page)
  return page.evaluate(async () => {
    const entry = performance.getEntriesByType('resource').find(e => e.name.includes('@react-three_fiber.js'))!
    const fiber = await import(entry.name)
    const state = fiber._roots.get(document.querySelector('canvas')).store.getState()
    const players: { id: string; teamId: string; visible: boolean; position: number[]; yaw: number; bones: number[]; kit: Record<string, unknown> }[] = []
    state.scene.traverse((root: Object3D) => {
      if (!root.name.startsWith('SkeletalPlayer:')) return
      const bones: number[] = []
      let kit: Record<string, unknown> = {}
      root.traverse((object: Object3D) => {
        if (object.type === 'Bone') bones.push(...object.position.toArray(), ...object.quaternion.toArray())
        if (object.type === 'SkinnedMesh') kit = ((object as Mesh).material as Material).userData
      })
      players.push({ id: root.userData.playerId, teamId: root.userData.teamId, visible: root.parent!.visible, position: root.parent!.position.toArray(), yaw: root.parent!.rotation.y, bones, kit })
    })
    return players
  })
}
async function resources(page: Page) {
  return page.evaluate(async () => {
    const entries = performance.getEntriesByType('resource')
    const fiber = await import(entries.find(e => e.name.includes('@react-three_fiber.js'))!.name)
    const kit = await import(entries.find(e => new URL(e.name).pathname === '/src/replay/animation/kitMaterial.ts')!.name)
    const state = fiber._roots.get(document.querySelector('canvas')).store.getState()
    return { ...state.gl.info.memory, ...kit.kitResources() }
  })
}
async function closeup(page: Page, ids: string[], file: string) {
  await page.evaluate(async ids => {
    const entry = performance.getEntriesByType('resource').find(e => e.name.includes('@react-three_fiber.js'))!
    const fiber = await import(entry.name)
    const state = fiber._roots.get(document.querySelector('canvas')).store.getState()
    const positions = ids.map(id => state.scene.getObjectByName(`Player:${id}`).position)
    const x = positions.reduce((sum, p) => sum + p.x, 0) / positions.length
    const z = positions.reduce((sum, p) => sum + p.z, 0) / positions.length
    const distance = Math.max(5, ...positions.map(p => Math.hypot(p.x - x, p.z - z) * 3 + 3))
    state.setFrameloop('never')
    state.camera.position.set(x + distance * .75, 2.8, z + distance * .65)
    state.camera.up.set(0, 1, 0); state.camera.lookAt(x, .95, z)
    state.camera.fov = 35; state.camera.updateProjectionMatrix()
    state.gl.render(state.scene, state.camera)
  }, ids)
  await page.locator('canvas').screenshot({ path: `../output/playwright/3b2/${file}.png` })
  await page.evaluate(async () => {
    const entry = performance.getEntriesByType('resource').find(e => e.name.includes('@react-three_fiber.js'))!
    const fiber = await import(entry.name)
    fiber._roots.get(document.querySelector('canvas')).store.getState().setFrameloop('always')
  })
  await settle(page)
}

test('both full skeletal rosters preserve canonical roots, kit identity and seek/speed determinism', async ({ page }) => {
  const errors: string[] = [], requests: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader/.test(message.text())) errors.push(message.text()) })
  page.on('request', request => { if (request.url().endsWith('/characters/football-player.glb')) requests.push(request.url()) })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await expect(page.locator('canvas')).toHaveAttribute('data-character-renderer', 'skeletal')
  const slider = page.getByRole('slider', { name: 'Replay timeline' })
  for (const scenario of [invisible, missed]) {
    await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(scenario.id)
    await expect.poll(async () => (await inspect(page)).length).toBe(22)
    for (const time of [0, 3, 9, 10.4, 14, 20]) {
      await slider.fill(String(time))
      const expected = await inspect(page)
      expect(expected.map(player => player.id).sort()).toEqual(scenario.players.map(player => player.id).sort())
      for (const player of expected) {
        const canonical = scenario.players.find(p => p.id === player.id)!, team = scenario.teams.find(t => t.id === canonical.teamId)!
        expect(player.bones).toHaveLength(65 * 7)
        expect(player.position).toEqual(samplePosition(canonical.positions, time))
        // Node and Chrome can differ by one ULP in atan2; compare the canonical
        // heading tightly, while repeated in-browser bone snapshots stay exact.
        expect(player.yaw).toBeCloseTo(sampleYaw(canonical.facing, time), 12)
        expect(player.kit).toEqual({ color: new Color(canonical.role === 'Goalkeeper' ? team.goalkeeperColor : team.color).getStyle(), number: canonical.number, goalkeeper: canonical.role === 'Goalkeeper' })
      }
      for (const speed of ['0.5', '2', '1']) {
        await page.getByRole('combobox', { name: 'Playback speed' }).selectOption(speed)
        await slider.fill('19'); await slider.fill(String(time))
        expect(await inspect(page)).toEqual(expected)
      }
      if ([9, 14].includes(time)) await page.getByTestId('replay-viewport').screenshot({ path: `../output/playwright/3b2/${scenario.id}-${time}-broadcast.png` })
    }
    await page.getByRole('button', { name: 'Tactical', exact: true }).click()
    await slider.fill('9')
    await page.getByTestId('replay-viewport').screenshot({ path: `../output/playwright/3b2/${scenario.id}-tactical.png` })
    await page.getByRole('button', { name: 'Broadcast', exact: true }).click()
  }
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(invisible.id)
  await slider.fill('14'); await settle(page)
  await closeup(page, ['a9', 'd4'], 'opposing-kits')
  await closeup(page, ['d1'], 'goalkeeper')
  expect(requests).toHaveLength(1)
  expect(errors).toEqual([])
})

test('skeletal selection, POV, tactics and repeated switches retain identity and release resources', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await expect(page.locator('canvas')).toHaveAttribute('data-character-renderer', 'skeletal')
  const slider = page.getByRole('slider', { name: 'Replay timeline' })
  await slider.fill('9')
  await page.getByRole('button', { name: 'Tactical', exact: true }).click()
  const canvas = page.locator('canvas'), box = (await canvas.boundingBox())!
  const pose = sampleCamera(invisible, 'tactical', 9)
  const camera = new PerspectiveCamera(pose.fov, box.width / box.height, .1, 240)
  camera.position.set(...pose.position); camera.up.set(...pose.up); camera.lookAt(...pose.target); camera.updateMatrixWorld()
  const pixel = new Vector3(30, 1.2, 3).project(camera)
  const point = { x: (pixel.x + 1) * box.width / 2, y: (1 - pixel.y) * box.height / 2 }
  await settle(page); await canvas.hover({ position: point })
  await expect(page.locator('body')).toHaveCSS('cursor', 'pointer')
  await canvas.click({ position: point })
  await expect(page.getByTestId('selected-name')).toHaveText('Leon Voss')
  const expected = await inspect(page)
  for (const id of ['a9', 'd1']) {
    await viewPlayerPov(page, id)
    const current = await inspect(page)
    expect(current.filter(player => !player.visible).map(player => player.id)).toEqual([id])
  }
  await page.getByRole('button', { name: 'Broadcast', exact: true }).click()
  expect(await inspect(page)).toEqual(expected)
  await page.getByRole('checkbox', { name: 'Movement trail' }).check()
  await page.getByRole('button', { name: 'Analyze this moment' }).click()
  await expect(page.getByTestId('tactical-moment-title')).toBeVisible()
  await page.getByRole('combobox', { name: 'Analytical moment' }).selectOption('receive')
  await expect(slider).toHaveValue('10.4')
  await page.getByRole('button', { name: 'Restart replay' }).click()
  await expect(slider).toHaveValue('0')
  const baseline = await resources(page)
  for (let i = 0; i < 5; i++) for (const scenario of [missed, invisible]) {
    await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(scenario.id)
    const players = await inspect(page)
    expect(players).toHaveLength(22)
    expect(players.map(player => player.id).sort()).toEqual(scenario.players.map(player => player.id).sort())
    const current = await resources(page)
    expect(current.references).toBe(22)
    expect(current.materials).toBe(22)
    expect(current.geometries).toBeLessThanOrEqual(baseline.geometries + 1)
    expect(current.textures).toBeLessThanOrEqual(baseline.textures + 1)
  }
  expect(errors).toEqual([])
})

for (const invalid of [false, true]) test(`whole-team fallback survives ${invalid ? 'invalid' : 'missing'} assets without retry storms`, async ({ page }) => {
  const errors: string[] = []
  let requests = 0
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/characters/football-player.glb', route => {
    requests++
    return route.fulfill({ status: invalid ? 200 : 404, body: invalid ? 'not a valid GLB' : 'missing asset' })
  })
  await page.goto('/')
  await expect(page.getByTestId('scene-ready')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('canvas')).toHaveAttribute('data-character-renderer', 'procedural')
  for (const scenario of [invisible, missed, invisible]) {
    await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(scenario.id)
    expect(await inspect(page)).toHaveLength(0)
    await selectPlayer(page, scenario.players[0].id)
    await page.getByRole('slider', { name: 'Replay timeline' }).fill('14')
  }
  await page.getByRole('button', { name: 'Play replay', exact: true }).click()
  await expect.poll(async () => Number(await page.getByRole('slider', { name: 'Replay timeline' }).inputValue())).toBeGreaterThan(14.2)
  expect(requests).toBe(1)
  expect(errors).toEqual([])
})
