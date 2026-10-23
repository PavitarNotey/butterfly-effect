import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import { sampleCamera } from '../src/replay/camera'
import invisible from '../src/replay/invisible-run.json' with { type: 'json' }
import missed from '../src/replay/missed-chance.json' with { type: 'json' }
import { viewPlayerPov } from './player-picker'
const scenarios = [invisible, missed]

async function inspect(page: Page, playerId?: string) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.cameraSettled === 'true')
  return page.evaluate(async playerId => {
    const entries = performance.getEntriesByType('resource')
    const fiber = await import(entries.find(e => e.name.includes('@react-three_fiber.js'))!.name)
    const THREE = await import(entries.find(e => /\/three\.js\?/.test(e.name))!.name)
    const { replayStore } = await import(entries.find(e => new URL(e.name).pathname === '/src/replay/store.ts')!.name)
    const state = fiber._roots.get(document.querySelector('canvas')).store.getState()
    const replay = replayStore.getState(), camera = state.camera
    camera.updateMatrixWorld()
    const root = state.scene.getObjectByName(`Player:${playerId ?? replay.selectedId ?? replay.scenario.players[0].id}`)
    const point = new THREE.Vector3(root.position.x, 1.2, root.position.z).project(camera)
    const label = new THREE.Vector3(root.position.x, 2.5, root.position.z).project(camera)
    return { position: camera.position.toArray(), up: camera.up.toArray(), quaternion: camera.quaternion.toArray(), fov: camera.fov, aspect: camera.aspect, manual: replay.tacticalView, time: replay.readTime(), selectedId: replay.selectedId, rootVisible: root.visible, point: point.toArray(), label: label.toArray() }
  }, playerId)
}

test('focused cameras, overview, zoom/pan, selection and POV preserve both scenarios', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/')
  await expect(page.locator('canvas')).toHaveAttribute('data-character-renderer', 'skeletal')
  const slider = page.getByRole('slider', { name: 'Replay timeline' }), canvas = page.locator('canvas')
  for (const scenario of scenarios) {
    await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(scenario.id)
    for (const [button, mode] of [['Broadcast', 'broadcast'], ['Tactical', 'tactical'], ['Full pitch', 'overview']] as const) {
      await page.getByRole('button', { name: button, exact: true }).click()
      for (const time of [0, 3, 9, 10.4, 14]) {
        await slider.fill(String(time))
        const camera = await inspect(page)
        const expected = sampleCamera(scenario, mode, time, { aspect: camera.aspect })
        expect(camera.position).toEqual(expected.position); expect(camera.fov).toBe(expected.fov)
        await slider.fill('19'); await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('2'); await slider.fill(String(time))
        expect(await inspect(page)).toEqual(camera)
      }
    }
    await page.getByRole('button', { name: 'Tactical', exact: true }).click()
    await slider.fill('9')
    const automatic = await inspect(page)
    // Click actual meshes on both teams using the mounted camera projection.
    const ids = scenario.id === 'the-invisible-run' ? ['a9', 'd4'] : ['s9', 'c5']
    for (const id of ids) {
      const view = await inspect(page, id), box = (await canvas.boundingBox())!
      await canvas.click({ position: { x: (view.point[0] + 1) * box.width / 2, y: (1 - view.point[1]) * box.height / 2 } })
      expect((await inspect(page)).selectedId).toBe(id)
      const label = await page.locator('.world-player-label').boundingBox()
      const updated = await inspect(page)
      expect(Math.abs(label!.x + label!.width / 2 - (box.x + (updated.label[0] + 1) * box.width / 2))).toBeLessThan(1)
      expect(Math.abs(label!.y + label!.height / 2 - (box.y + (1 - updated.label[1]) * box.height / 2))).toBeLessThan(1)
    }
    const box = (await canvas.boundingBox())!
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2)
    const scrollY = await page.evaluate(() => scrollY)
    await page.mouse.wheel(0, -350)
    await expect.poll(async () => (await inspect(page)).manual?.height).toBeLessThan(48)
    expect(await page.evaluate(() => scrollY)).toBe(scrollY)
    const zoomed = await inspect(page)
    const player = await inspect(page, ids[1])
    await page.mouse.move(box.x + (player.point[0] + 1) * box.width / 2, box.y + (1 - player.point[1]) * box.height / 2)
    await page.mouse.down(); await page.mouse.move(box.x + box.width * .6, box.y + box.height * .6, { steps: 10 }); await page.mouse.up()
    const panned = await inspect(page)
    expect(panned.manual?.center).not.toEqual(zoomed.manual?.center)
    expect(panned.selectedId).toBe(ids[1]); expect(panned.time).toBe(9)
    expect(Math.abs(panned.manual!.center[0])).toBeLessThanOrEqual(49.5)
    expect(Math.abs(panned.manual!.center[1])).toBeLessThanOrEqual(31)
    await slider.fill('14')
    expect((await inspect(page)).position).toEqual(panned.position)
    await page.getByRole('button', { name: 'Follow play', exact: true }).click()
    expect((await inspect(page)).manual).toBeNull()
    await slider.fill('9')
    expect((await inspect(page)).position).toEqual(automatic.position)
    await page.screenshot({ path: `../output/framing/after/${scenario.id}-tactical-studio.png`, fullPage: true })
    await viewPlayerPov(page, ids[1])
    expect((await inspect(page, ids[1])).rootVisible).toBe(false)
    await expect(page.locator('.world-player-label')).toBeHidden()
    await page.getByRole('button', { name: 'Full pitch', exact: true }).click()
    await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2); await page.mouse.wheel(0, -350)
    await expect(page.getByRole('button', { name: 'Reset view', exact: true })).toBeVisible()
    await page.getByRole('button', { name: 'Reset view', exact: true }).click()
    expect((await inspect(page)).position).toEqual(sampleCamera(scenario, 'overview', 9).position)
    await page.getByTestId('replay-viewport').screenshot({ path: `../output/framing/after/${scenario.id}-overview-controls.png` })
  }
  expect(errors).toEqual([])
})
