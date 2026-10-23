import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import invisible from '../src/replay/invisible-run.json' with { type: 'json' }

async function settle(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.cameraSettled === 'true')
}

async function sceneState(page: Page, playerId = 'd4') {
  await settle(page)
  return page.evaluate(async id => {
    const entries = performance.getEntriesByType('resource')
    const fiber = await import(entries.find(entry => entry.name.includes('@react-three_fiber.js'))!.name)
    const THREE = await import(entries.find(entry => /\/three\.js\?/.test(entry.name))!.name)
    const { replayStore } = await import(entries.find(entry => new URL(entry.name).pathname === '/src/replay/store.ts')!.name)
    const state = fiber._roots.get(document.querySelector('canvas')).store.getState(), replay = replayStore.getState()
    const root = state.scene.getObjectByName(`Player:${id}`), point = new THREE.Vector3(root.position.x, 1.2, root.position.z)
    state.camera.updateMatrixWorld(); point.project(state.camera)
    return { point: point.toArray(), selectedId: replay.selectedId, camera: replay.camera, time: replay.readTime(), memory: { ...state.gl.info.memory }, calls: state.gl.info.render.calls }
  }, playerId)
}

async function clickProjectedPlayer(page: Page, id: string, touch = false) {
  const canvas = page.locator('canvas'), box = (await canvas.boundingBox())!, state = await sceneState(page, id)
  const x = box.x + (state.point[0] + 1) * box.width / 2, y = box.y + (1 - state.point[1]) * box.height / 2
  if (touch) await page.touchscreen.tap(x, y)
  else await canvas.click({ position: { x: x - box.x, y: y - box.y } })
}

test('pitch selection, explicit POV, seeking, follow camera, scenario cleanup, and drag priority share one state', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 }); await page.goto('/')
  await expect(page.getByTestId('scene-ready')).toHaveAttribute('data-ready', 'true')
  const timeline = page.getByRole('slider', { name: 'Replay timeline' })
  await timeline.fill('9'); await page.getByRole('button', { name: 'Tactical', exact: true }).click()
  await clickProjectedPlayer(page, 'd4')
  await expect(page.getByTestId('selected-name')).toHaveText('Dane Mercer')
  expect((await sceneState(page)).selectedId).toBe('d4')
  await timeline.fill('12'); expect((await sceneState(page)).selectedId).toBe('d4')
  await page.getByRole('button', { name: "View Dane Mercer's POV" }).click()
  const pov = await sceneState(page); expect(pov.camera).toBe('pov:d4'); expect(pov.time).toBe(12)
  await page.getByRole('button', { name: 'Follow Player', exact: true }).click()
  const follow = await sceneState(page); expect(follow.camera).toBe('follow:d4'); expect(follow.time).toBe(12)

  await page.getByRole('button', { name: 'Tactical', exact: true }).click(); await timeline.fill('9')
  const canvas = page.locator('canvas'), box = (await canvas.boundingBox())!, other = await sceneState(page, 'a9')
  const x = box.x + (other.point[0] + 1) * box.width / 2, y = box.y + (1 - other.point[1]) * box.height / 2
  await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + 90, y + 60, { steps: 10 }); await page.mouse.up()
  expect((await sceneState(page)).selectedId).toBe('d4')
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('the-missed-chance')
  expect((await sceneState(page, 'c5')).selectedId).toBeNull(); await expect(page.getByTestId('selected-name')).toHaveCount(0)
})

test('one picker exposes 22 grouped players and supports search, keyboard navigation, Escape, and click outside', async ({ page }) => {
  await page.goto('/'); await page.getByRole('button', { name: 'Open player picker' }).click()
  const popover = page.getByRole('dialog', { name: 'Choose a player' })
  await expect(popover).toBeVisible()
  for (const team of invisible.teams) await expect(popover.getByRole('heading', { name: new RegExp(team.name) })).toBeVisible()
  await expect(popover.locator('[data-player-option]')).toHaveCount(22)
  const search = popover.getByRole('searchbox', { name: 'Search Players' })
  await search.fill('goalkeeper'); await expect(popover.locator('[data-player-option]')).toHaveCount(2)
  await search.fill('Mercer'); await expect(popover.locator('[data-player-option]')).toHaveCount(1)
  await search.press('ArrowDown'); await expect(page.getByTestId('player-option-d4')).toBeFocused()
  await page.keyboard.press('Enter'); await expect(page.getByTestId('selected-name')).toHaveText('Dane Mercer')
  await page.getByRole('button', { name: 'Open player picker' }).click(); await page.keyboard.press('Escape'); await expect(popover).toHaveCount(0)
  await page.getByRole('button', { name: 'Open player picker' }).click(); await page.getByRole('heading', { name: 'The Invisible Run.' }).click(); await expect(popover).toHaveCount(0)
})

test('touch can select a pitch player and use the mobile picker without changing replay time', async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true })
  const page = await context.newPage(); await page.goto('/')
  const timeline = page.getByRole('slider', { name: 'Replay timeline' })
  await timeline.fill('8'); await page.getByRole('button', { name: 'Tactical', exact: true }).tap()
  await clickProjectedPlayer(page, 'd4', true); await expect(page.getByTestId('selected-name')).toHaveText('Dane Mercer')
  await page.getByRole('button', { name: 'Open player picker' }).tap()
  const search = page.getByRole('searchbox', { name: 'Search Players' }); await search.fill('Voss')
  await page.getByTestId('player-option-a9').tap(); await expect(page.getByTestId('selected-name')).toHaveText('Leon Voss')
  await page.getByRole('button', { name: "View Leon Voss's POV" }).tap()
  const state = await sceneState(page, 'a9'); expect(state.camera).toBe('pov:a9'); expect(state.time).toBe(8)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
  await context.close()
})

test('hover raycasting adds at most one draw call and does not grow GPU resources after warmup', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 }); await page.goto('/')
  await page.getByRole('button', { name: 'Tactical', exact: true }).click(); await page.getByRole('slider', { name: 'Replay timeline' }).fill('9')
  const canvas = page.locator('canvas'), box = (await canvas.boundingBox())!
  const visible: { id: string; x: number; y: number }[] = []
  for (const player of invisible.players) {
    const state = await sceneState(page, player.id)
    if (Math.abs(state.point[0]) < .96 && Math.abs(state.point[1]) < .96) visible.push({ id: player.id, x: box.x + (state.point[0] + 1) * box.width / 2, y: box.y + (1 - state.point[1]) * box.height / 2 })
  }
  await page.mouse.move(visible[0].x, visible[0].y); await settle(page)
  const warm = await sceneState(page, visible[0].id), calls: number[] = []
  for (const player of visible) { await page.mouse.move(player.x, player.y); await settle(page); calls.push((await sceneState(page, player.id)).calls) }
  const after = await sceneState(page, visible.at(-1)!.id)
  expect(after.memory).toEqual(warm.memory); expect(Math.max(...calls)).toBeLessThanOrEqual(warm.calls + 1)
})
