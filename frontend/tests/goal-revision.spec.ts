import { expect, test } from '@playwright/test'
import goal from '../src/replay/invisible-run.json' with { type: 'json' }
import { samplePosition } from '../src/replay/sample'
import { viewPlayerPov } from './player-picker'

test('revised goal runs continuously at 1×, ends in convergence, and seeks back to the same rendered pressure', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.goto('/studio')
  await expect(page.locator('canvas')).toHaveAttribute('data-character-renderer', 'skeletal')
  const timeline = page.getByRole('slider', { name: 'Replay timeline' })
  await expect(timeline).toHaveAttribute('max', String(goal.duration))
  await expect(page.getByRole('combobox', { name: 'Playback speed' })).toHaveValue('1')
  await page.getByRole('button', { name: 'Play replay', exact: true }).click()
  const live = await page.evaluate(async () => {
    const entries = performance.getEntriesByType('resource')
    const { replayStore } = await import(entries.find(e => new URL(e.name).pathname === '/src/replay/store.ts')!.name)
    const start = { time: replayStore.getState().readTime(), wall: performance.now() }
    while (replayStore.getState().playing) await new Promise(requestAnimationFrame)
    return { start, end: { time: replayStore.getState().readTime(), wall: performance.now() } }
  })
  expect((live.end.time-live.start.time)/((live.end.wall-live.start.wall)/1000)).toBeCloseTo(1, 1)
  await expect(page.getByTestId('score')).toHaveText('1 – 0')
  await expect(timeline).toHaveValue(String(goal.duration))
  const shot = goal.events.find(e => e.type === 'shot')!.t
  async function pose() {
    await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    return page.evaluate(async () => {
      const entries = performance.getEntriesByType('resource')
      const fiber = await import(entries.find(e => e.name.includes('@react-three_fiber.js'))!.name)
      const state = fiber._roots.get(document.querySelector('canvas')).store.getState()
      return ['a9','a7','a8','a10','d4','d5'].map(id => {
        const root = state.scene.getObjectByName(`Player:${id}`), bones: number[] = []
        state.scene.getObjectByName(`SkeletalPlayer:${id}`).traverse((b: { type: string; position: { toArray: () => number[] }; quaternion: { toArray: () => number[] } }) => {
          if (b.type === 'Bone') bones.push(...b.position.toArray(), ...b.quaternion.toArray())
        })
        return { id, root: root.position.toArray(), bones }
      })
    })
  }
  for (const p of await pose()) expect(p.root).toEqual(samplePosition(goal.players.find(player => player.id === p.id)!.positions, goal.duration))
  await timeline.fill(String(shot))
  const pressure = await pose()
  await viewPlayerPov(page, 'a9')
  await timeline.fill('0'); await timeline.fill(String(shot))
  expect(await pose()).toEqual(pressure)
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('the-missed-chance')
  await expect(timeline).toHaveAttribute('max', '12')
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(goal.id)
  await timeline.fill(String(shot)); expect(await pose()).toEqual(pressure)
  expect(errors).toEqual([])
})
