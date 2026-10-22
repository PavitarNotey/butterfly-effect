import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { PerspectiveCamera, Vector3 } from 'three'
import type { Object3D } from 'three'
import scenario from '../src/replay/invisible-run.json' with { type: 'json' }
import { sampleCamera } from '../src/replay/camera'
import { samplePosition, sampleYaw } from '../src/replay/sample'

async function settle(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

// Inspect the real mounted scene, not a second independently evaluated test rig.
async function inspect(page: Page) {
  await settle(page)
  return page.evaluate(async () => {
    const entry = performance.getEntriesByType('resource').find(e => e.name.includes('@react-three_fiber.js'))!
    const fiber = await import(entry.name)
    const state = fiber._roots.get(document.querySelector('canvas')).store.getState()
    const root = state.scene.getObjectByName('Voss-skeletal-prototype')
    const bones: number[] = []
    let skins = 0
    root?.traverse((object: Object3D) => {
      if (object.type === 'Bone') bones.push(...object.position.toArray(), ...object.quaternion.toArray())
      if (object.type === 'SkinnedMesh') skins++
    })
    return root ? { bones, skins, visible: root.parent.visible, position: root.parent.position.toArray(), yaw: root.parent.rotation.y } : null
  })
}

async function captureCloseup(page: Page, time: number) {
  await page.evaluate(async () => {
    const entry = performance.getEntriesByType('resource').find(e => e.name.includes('@react-three_fiber.js'))!
    const fiber = await import(entry.name)
    const state = fiber._roots.get(document.querySelector('canvas')).store.getState()
    const root = state.scene.getObjectByName('Voss-skeletal-prototype').parent
    const { x, z } = root.position, yaw = root.rotation.y
    // Evidence capture only: temporarily stop rendering and frame the actual live
    // player. The application camera rig resumes immediately after the screenshot.
    state.setFrameloop('never')
    state.camera.position.set(x + Math.sin(yaw) * 4 + Math.cos(yaw) * 2, 2.2, z + Math.cos(yaw) * 4 - Math.sin(yaw) * 2)
    state.camera.up.set(0, 1, 0)
    state.camera.lookAt(x, .9, z)
    state.camera.fov = 32
    state.camera.updateProjectionMatrix()
    state.gl.render(state.scene, state.camera)
  })
  await page.locator('canvas').screenshot({ path: `../output/playwright/3b/${time}-closeup.png` })
  await page.evaluate(async () => {
    const entry = performance.getEntriesByType('resource').find(e => e.name.includes('@react-three_fiber.js'))!
    const fiber = await import(entry.name)
    fiber._roots.get(document.querySelector('canvas')).store.getState().setFrameloop('always')
  })
  await settle(page)
}

test('Voss is genuinely skinned, selectable, deterministic and hidden in his POV', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  const canvas = page.locator('canvas')
  await expect(canvas).toHaveAttribute('data-character-renderer', 'rigged-voss')
  const slider = page.getByRole('slider', { name: 'Replay timeline' })
  await page.getByRole('combobox', { name: 'Selected player', exact: true }).selectOption('a9')
  for (const time of [0, 3, 9, 10.4, 14]) {
    await slider.fill(String(time))
    const actual = (await inspect(page))!
    expect(actual.skins).toBeGreaterThan(0)
    expect(actual.bones).toHaveLength(65 * 7)
    const voss = scenario.players.find(player => player.id === 'a9')!
    expect(actual.position).toEqual(samplePosition(voss.positions, time))
    expect(actual.yaw).toBe(sampleYaw(voss.facing, time))
    for (const speed of ['0.5', '2', '1']) {
      await page.getByRole('combobox', { name: 'Playback speed' }).selectOption(speed)
      await slider.fill('19')
      await slider.fill(String(time))
      expect(await inspect(page)).toEqual(actual)
    }
    await page.getByTestId('replay-viewport').screenshot({ path: `../output/playwright/3b/${time}-broadcast.png` })
    await captureCloseup(page, time)
  }
  await slider.fill('9')
  await page.getByRole('button', { name: 'Tactical', exact: true }).click()
  await page.getByRole('combobox', { name: 'Selected player', exact: true }).selectOption('a7')
  const box = (await canvas.boundingBox())!
  const pose = sampleCamera(scenario, 'tactical', 9)
  const camera = new PerspectiveCamera(pose.fov, box.width / box.height, .1, 240)
  camera.position.set(...pose.position); camera.up.set(...pose.up); camera.lookAt(...pose.target); camera.updateMatrixWorld()
  const pixel = new Vector3(30, 1.2, 3).project(camera)
  const point = { x: (pixel.x + 1) * box.width / 2, y: (1 - pixel.y) * box.height / 2 }
  await settle(page)
  await canvas.hover({ position: point })
  await expect(page.locator('body')).toHaveCSS('cursor', 'pointer')
  await canvas.click({ position: point })
  await expect(page.getByTestId('selected-name')).toHaveText('Leon Voss')
  const expected = await inspect(page)
  await page.getByRole('button', { name: "View from Leon's eyes" }).click()
  expect((await inspect(page))!.visible).toBe(false)
  await page.getByRole('button', { name: 'Broadcast', exact: true }).click()
  expect(await inspect(page)).toEqual(expected)
  await page.getByRole('button', { name: 'Analyze this moment' }).click()
  await expect(page.getByTestId('tactical-moment-title')).toBeVisible()
  await page.getByRole('combobox', { name: 'Analytical moment' }).selectOption('receive')
  await expect(slider).toHaveValue('10.4')
  await page.getByRole('button', { name: 'Restart replay' }).click()
  await expect(slider).toHaveValue('0')
  for (let i = 0; i < 3; i++) {
    await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('the-missed-chance')
    expect(await inspect(page)).toBeNull()
    await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('the-invisible-run')
    await expect(canvas).toHaveAttribute('data-character-renderer', 'rigged-voss')
    expect((await inspect(page))!.skins).toBeGreaterThan(0)
  }
  expect(errors).toEqual([])
})

test('a missing character asset leaves the procedural match usable', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.route('**/characters/voss/player.glb', route => route.fulfill({ status: 404, body: 'missing asset' }))
  await page.goto('/')
  await expect(page.getByTestId('scene-ready')).toHaveAttribute('data-ready', 'true')
  await expect(page.locator('canvas')).toHaveAttribute('data-character-renderer', 'procedural')
  await page.getByRole('combobox', { name: 'Selected player', exact: true }).selectOption('a9')
  await page.getByRole('slider', { name: 'Replay timeline' }).fill('14')
  await expect(page.getByTestId('selected-name')).toHaveText('Leon Voss')
  expect(await inspect(page)).toBeNull()
  await page.getByRole('button', { name: 'Play replay', exact: true }).click()
  await expect.poll(async () => Number(await page.getByRole('slider', { name: 'Replay timeline' }).inputValue())).toBeGreaterThan(14.2)
  await page.getByTestId('replay-viewport').screenshot({ path: '../output/playwright/3b/missing-asset-fallback.png' })
  expect(errors).toEqual([])
})
