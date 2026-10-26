import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { Object3D } from 'three'
import source from '../src/replay/missed-chance.json' with { type: 'json' }
import { samplePosition } from '../src/replay/sample'
import { viewPlayerPov } from './player-picker'

async function settle(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}
async function inspect(page: Page, id: string) {
  await settle(page)
  return page.evaluate(async id => {
    const entries = performance.getEntriesByType('resource')
    const fiber = await import(entries.find(e => e.name.includes('@react-three_fiber.js'))!.name)
    const { replayStore } = await import(entries.find(e => new URL(e.name).pathname === '/src/replay/store.ts')!.name)
    const state = fiber._roots.get(document.querySelector('canvas')).store.getState(), replay = replayStore.getState()
    const bones: number[] = []
    state.scene.getObjectByName(`SkeletalPlayer:${id}`).traverse((b: Object3D) => { if (b.type === 'Bone') bones.push(...b.position.toArray(), ...b.quaternion.toArray()) })
    return { time: replay.readTime(), root: state.scene.getObjectByName(`Player:${id}`).position.toArray(), bones, renderer: { calls: state.gl.info.render.calls, geometries: state.gl.info.memory.geometries, textures: state.gl.info.memory.textures } }
  }, id)
}

test.beforeEach(async ({ page, request }) => {
  expect((await (await request.get('http://127.0.0.1:8001/api/ai/status')).json()).provider).toBe('mock')
  await page.route('**/api/ai/**', async route => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: `http://127.0.0.1:8001${url.pathname}${url.search}` })
    await route.fulfill({ response })
  })
})

test('revised miss advances at 1× and exposes its preparation, wide flight and restrained reaction', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  page.on('console', message => { if (message.type() === 'error') errors.push(message.text()) })
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/studio')
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(source.id)
  await expect(page.locator('canvas')).toHaveAttribute('data-character-renderer', 'skeletal')
  const slider = page.getByRole('slider', { name: 'Replay timeline' })
  await expect(slider).toHaveAttribute('max', '12')
  await expect(page.getByRole('combobox', { name: 'Playback speed' })).toHaveValue('1')
  await page.getByRole('button', { name: 'Play replay', exact: true }).click()
  await expect.poll(async () => Number(await slider.inputValue())).toBeGreaterThan(1)
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click()
  const moving = await inspect(page, 's8')
  expect(moving.root[0]).toBeGreaterThan(12)
  // Complete the real advancing passage at normal speed; no global clock trick.
  await page.getByRole('button', { name: 'Play replay', exact: true }).click()
  await expect(slider).toHaveValue('12', { timeout: 15000 })
  await expect(page.getByRole('heading', { name: 'Wide of the post', exact: true })).toBeVisible()
  await expect(page.getByTestId('score')).toHaveText('0 – 0')
  for (const [name, time] of [['opening', .6], ['shot-preparation', 7.4], ['ball-flight', 8.05], ['post-miss', 9.25]] as const) {
    await slider.fill(String(time)); await settle(page)
    await page.getByTestId('replay-viewport').screenshot({ path: `../output/playwright/phase4-2/${name}-broadcast.png` })
  }
  // Inspect the actual mounted shooter with the established temporary QA camera.
  for (const [name, time] of [['backswing', 7.45], ['contact', 7.65], ['follow-through', 7.85], ['disappointment', 9.25]] as const) {
    await slider.fill(String(time)); await settle(page)
    await page.evaluate(async () => {
      const entries = performance.getEntriesByType('resource')
      const fiber = await import(entries.find(e => e.name.includes('@react-three_fiber.js'))!.name)
      const state = fiber._roots.get(document.querySelector('canvas')).store.getState(), p = state.scene.getObjectByName('Player:s9').position
      state.setFrameloop('never')
      state.camera.position.set(p.x - 3.8, 2.5, p.z + 4.6)
      state.camera.up.set(0, 1, 0); state.camera.lookAt(p.x + .15, .85, p.z)
      state.camera.fov = 35; state.camera.updateProjectionMatrix(); state.gl.render(state.scene, state.camera)
    })
    await page.locator('canvas').screenshot({ path: `../output/playwright/phase4-2/${name}-closeup.png` })
    await page.evaluate(async () => {
      const entry = performance.getEntriesByType('resource').find(e => e.name.includes('@react-three_fiber.js'))!
      const fiber = await import(entry.name)
      fiber._roots.get(document.querySelector('canvas')).store.getState().setFrameloop('always')
    })
  }
  expect(errors).toEqual([])
})

test('contact, defending and keeper poses survive scrub, cameras, restart and other scenarios', async ({ page }) => {
  await page.goto('/studio')
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(source.id)
  await expect(page.locator('canvas')).toHaveAttribute('data-character-renderer', 'skeletal')
  const slider = page.getByRole('slider', { name: 'Replay timeline' })
  for (const [id, time] of [['s8', 1.3], ['c2', 3.2], ['c5', 6.6], ['s9', 7.65], ['c1', 8.05], ['s9', 9.25]] as const) {
    await slider.fill(String(time))
    const expected = await inspect(page, id)
    expect(expected.root).toEqual(samplePosition(source.players.find(p => p.id === id)!.positions, time))
    expect(expected.bones).toHaveLength(65 * 7)
    for (const camera of ['Tactical', 'Full pitch', 'Broadcast']) {
      await page.getByRole('button', { name: camera, exact: true }).click()
      expect((await inspect(page, id)).bones).toEqual(expected.bones)
    }
    await viewPlayerPov(page, id)
    await page.getByRole('button', { name: 'Restart replay', exact: true }).click()
    await slider.fill('12'); await slider.fill(String(time))
    expect((await inspect(page, id)).bones).toEqual(expected.bones)
    for (const other of ['the-invisible-run', 'the-untouched-pass']) {
      await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(other)
      await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(source.id)
      await slider.fill(String(time))
      expect((await inspect(page, id)).bones).toEqual(expected.bones)
    }
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await slider.fill('8.05'); await viewPlayerPov(page, 's9')
  await page.getByTestId('replay-viewport').screenshot({ path: '../output/playwright/phase4-2/mobile-shooter-pov.png' })
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
})

test('both mock modes follow revised cues and the unchanged league miss reference', async ({ page, request }) => {
  const evidence = await (await request.get('http://127.0.0.1:8001/api/scenarios/the-missed-chance/evidence')).json()
  const summary = (await (await request.get('http://127.0.0.1:8001/api/scenarios')).json()).find((s: { id: string }) => s.id === source.id)
  expect(evidence.sourceHash).toBe(summary.sourceHash)
  for (const mode of ['casual', 'analyst']) {
    const cues = await (await request.get(`http://127.0.0.1:8001/api/ai/scenarios/${source.id}/commentary?mode=${mode}`)).json()
    expect(cues.provider).toBe('mock')
    expect(cues.cues.map((cue: { replay_time: number }) => cue.replay_time)).toEqual(source.events.map(e => e.t))
    const recap = await (await request.get(`http://127.0.0.1:8001/api/ai/matches/solstice-cinder/recap?mode=${mode}`)).json()
    expect(recap.provider).toBe('mock'); expect(recap.narratives[0].event_id).toBe('solstice-cinder-finch')
  }
  await page.goto('/studio')
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(source.id)
  const panel = page.getByRole('region', { name: 'AI moment intelligence' })
  await panel.getByRole('button', { name: 'Enable AI commentary' }).click()
  for (const mode of ['Casual Fan', 'Analyst']) {
    await panel.getByRole('button', { name: mode, exact: true }).click()
    for (const [time, id] of [[3.55, 'pass'], [4.75, 'receive'], [7.65, 'shot'], [8.37, 'miss'], [1.3, 'run']] as const) {
      await page.getByRole('slider', { name: 'Replay timeline' }).fill(String(time))
      await expect(panel.getByTestId('ai-commentary')).toHaveAttribute('data-event', id)
    }
  }
  await page.goto('/matches/solstice-cinder')
  await expect(page.getByTestId('match-final-score')).toHaveText('0 – 1')
  await expect(page.getByTestId('match-viewer')).toHaveAttribute('data-scenario', source.id)
})
