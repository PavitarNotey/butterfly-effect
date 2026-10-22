import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'

const errors = new WeakMap<Page, string[]>()
test.beforeEach(async ({ page }) => {
  const messages: string[] = []
  errors.set(page, messages)
  page.on('pageerror', e => messages.push(e.message))
  page.on('console', m => { if (m.type() === 'error') messages.push(m.text()) })
  await page.goto('/')
  await expect(page.getByTestId('scene-ready')).toHaveAttribute('data-ready', 'true')
})
test.afterEach(async ({ page }) => { expect(errors.get(page)).toEqual([]) })

async function readTime(page: Page) {
  return Number(await page.getByRole('slider', { name: 'Replay timeline' }).inputValue())
}
async function settledScene(page: Page) {
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
}

test('timeline advances, shows clock-derived fill, and supports mouse dragging while playing', async ({ page }) => {
  const slider = page.getByRole('slider', { name: 'Replay timeline' })
  await slider.scrollIntoViewIfNeeded()
  let box = (await slider.boundingBox())!
  await slider.click({ position: { x: box.width * .25, y: box.height / 2 } })
  await expect.poll(() => readTime(page)).toBeCloseTo(5, 0)
  await page.getByRole('button', { name: 'Play replay', exact: true }).click()
  const before = await readTime(page)
  await expect.poll(() => readTime(page)).toBeGreaterThan(before + .5)
  const displayed = await page.getByTestId('replay-time').innerText()
  const filled = await slider.evaluate(el => parseFloat((el as HTMLElement).style.getPropertyValue('--progress')))
  expect(Math.abs(parseFloat(displayed) - filled/5)).toBeLessThan(.2)
  box = (await slider.boundingBox())!
  await page.mouse.move(box.x + box.width * .4, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .65, box.y + box.height / 2, { steps: 8 })
  const held = await readTime(page)
  expect(held).toBeCloseTo(13, 0)
  // An active pointer holds the clock, even while time passes in the browser.
  await page.waitForTimeout(250)
  expect(await readTime(page)).toBe(held)
  await page.mouse.up()
  await expect(page.getByRole('button', { name: 'Pause replay', exact: true })).toBeVisible()
  await expect.poll(() => readTime(page)).toBeGreaterThan(held + .25)
  expect(await readTime(page)).toBeLessThan(held + 2)
  await page.getByRole('button', { name: 'Restart replay' }).click()
  expect(await readTime(page)).toBeLessThan(.4)
  await expect.poll(() => readTime(page)).toBeGreaterThan(.5)
})

test('paused seek changes the rendered world, stays stable on release, and survives cameras and restart', async ({ page }) => {
  const slider = page.getByRole('slider', { name: 'Replay timeline' })
  await slider.fill('3')
  await settledScene(page)
  const before = await page.locator('canvas').screenshot()
  await slider.scrollIntoViewIfNeeded()
  const box = (await slider.boundingBox())!
  await page.mouse.move(box.x + box.width * .15, box.y + box.height / 2)
  await page.mouse.down()
  await page.mouse.move(box.x + box.width * .6, box.y + box.height / 2, { steps: 10 })
  await page.mouse.up()
  const sought = await readTime(page)
  expect(sought).toBeCloseTo(12, 0)
  await settledScene(page)
  const after = await page.locator('canvas').screenshot()
  expect(before.equals(after)).toBe(false)
  await page.waitForTimeout(200)
  expect(await readTime(page)).toBe(sought)
  await expect(page.getByRole('button', { name: 'Play replay', exact: true })).toBeVisible()
  await page.getByRole('button', { name: 'Tactical', exact: true }).click()
  await page.getByRole('combobox', { name: 'Player perspective' }).selectOption('pov:d4')
  expect(await readTime(page)).toBe(sought)
  await page.getByRole('button', { name: 'Seek to Defender shifts', exact: true }).click()
  expect(await readTime(page)).toBe(6)
  await page.getByRole('button', { name: 'Restart replay' }).click()
  expect(await readTime(page)).toBe(0)
  await expect(slider).toHaveCSS('--progress', '0%')
  // Keyboard inputs use the same seek path and retain the paused state.
  await slider.focus(); await page.keyboard.press('End'); expect(await readTime(page)).toBe(20)
  await page.keyboard.press('Home'); expect(await readTime(page)).toBe(0)
  await slider.fill('6')
  await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('2')
  await page.getByRole('button', { name: 'Play replay', exact: true }).click()
  const start = await slider.evaluate(el => ({ time: (el as HTMLInputElement).valueAsNumber, wall: performance.now() }))
  await page.waitForTimeout(450)
  const end = await slider.evaluate(el => ({ time: (el as HTMLInputElement).valueAsNumber, wall: performance.now() }))
  expect(Math.abs((end.time-start.time) / ((end.wall-start.wall)/1000) - 2)).toBeLessThan(.25)
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click()
  const paused = await readTime(page)
  // Resume after scrubbing backwards.
  await slider.fill('2')
  await page.getByRole('button', { name: 'Play replay', exact: true }).click()
  await expect.poll(() => readTime(page)).toBeGreaterThan(2.5)
  expect(await readTime(page)).toBeLessThan(paused)
})

test.describe('touch timeline', () => {
  test.use({ hasTouch: true })
  test('trusted touch drag captures the pointer and resumes playback from release', async ({ page, context }) => {
    const slider = page.getByRole('slider', { name: 'Replay timeline' })
    await page.getByRole('button', { name: 'Play replay', exact: true }).click()
    await slider.scrollIntoViewIfNeeded()
    const box = (await slider.boundingBox())!
    const cdp = await context.newCDPSession(page)
    const point = (fraction: number) => ({ x: box.x + box.width*fraction, y: box.y + box.height/2, id: 1, radiusX: 2, radiusY: 2, force: 1 })
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [point(.25)] })
    for (const fraction of [.3, .4, .5]) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [point(fraction)] })
    const held = await readTime(page)
    expect(held).toBeCloseTo(10, 0)
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] })
    await expect(page.getByRole('button', { name: 'Pause replay', exact: true })).toBeVisible()
    await expect.poll(() => readTime(page)).toBeGreaterThan(held+.2)
    await cdp.detach()
  })
})

test('records defensive shape in broadcast, overhead and Mercer POV at key timestamps', async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 1100 })
  await page.getByRole('combobox', { name: 'Selected player', exact: true }).selectOption('d4')
  const slider = page.getByRole('slider', { name: 'Replay timeline' })
  for (const t of [0, 3, 6, 9]) {
    await slider.fill(String(t))
    for (const camera of ['broadcast', 'tactical', 'defender']) {
      if (camera === 'defender') await page.getByRole('combobox', { name: 'Player perspective' }).selectOption('pov:d4')
      else await page.getByRole('button', { name: camera === 'broadcast' ? 'Broadcast' : 'Tactical', exact: true }).click()
      expect(await readTime(page)).toBe(t)
      await settledScene(page)
      await page.getByTestId('replay-viewport').screenshot({ path: `../output/playwright/defence/${t}-${camera}.png` })
    }
  }
})
