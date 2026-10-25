/* global process */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

// Reproducible assets and review stills from the actual canonical renderer.
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const report = { browser: browser.version(), errors: [], screenshots: [] }
const directory = '../output/phase3e'
await mkdir(directory, { recursive: true })
const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1 })
page.on('pageerror', error => report.errors.push(error.message))
page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) report.errors.push(message.text()) })
try {
  await page.goto('http://localhost:5173/studio')
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption('the-untouched-pass')
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.characterRenderer === 'skeletal')
  await page.getByRole('button', { name: 'Analyze this moment', exact: true }).click()
  await page.getByTestId('tactical-moment-title').waitFor()
  await page.getByRole('button', { name: 'Analytical moment', exact: true }).click()
  await page.getByRole('dialog', { name: 'Choose analytical moment' }).locator('[data-moment-id="dummy"]').click()
  await page.getByRole('button', { name: 'Show me in the replay', exact: true }).click()
  await page.getByRole('button', { name: 'Pause guided replay', exact: true }).click()
  // Exact deterministic poster instant, retaining the existing guided camera.
  await page.evaluate(async () => {
    const { replayStore } = await import('/src/replay/store.ts')
    replayStore.setState({ anchorTime: 6.65, playing: false })
  })
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.cameraSettled === 'true')
  await page.locator('canvas').screenshot({ path: 'public/images/untouched-pass-poster.png', style: '.scorebug,.viewport-corner,.viewport-bottom,.selection-hint,.tactical-hud,.guided-hud,.world-player-label { visibility:hidden!important }' })
  for (const width of [1440, 1024, 390]) {
    await page.setViewportSize({ width, height: width === 390 ? 844 : 1100 })
    for (const [name, path] of [['home', '/'], ['match', '/matches/vesper-tidal'], ['standings', '/standings'], ['upcoming', '/matches/ashcombe-redhaven'], ['studio', '/matches/vesper-tidal/moments/vesper-tidal-merrick']]) {
      await page.goto(`http://localhost:5173${path}`)
      await page.locator('main h1').first().waitFor()
      if (name === 'home') {
        await page.getByTestId('strip-fixture').first().waitFor()
        await page.locator('.hero-image img').evaluate(async image => { await image.decode() })
      }
      if (name === 'match') {
        await page.waitForFunction(() => document.querySelector('canvas')?.dataset.characterRenderer === 'skeletal')
        await page.getByRole('slider', { name: 'Replay timeline' }).fill('6.65')
        await page.waitForFunction(() => document.querySelector('canvas')?.dataset.cameraSettled === 'true')
      }
      if (name === 'studio') {
        await page.waitForFunction(() => document.querySelector('canvas')?.dataset.characterRenderer === 'skeletal')
        await page.getByRole('button', { name: 'Analyze this moment', exact: true }).click()
        await page.getByTestId('tactical-moment-title').waitFor()
        await page.getByRole('button', { name: 'Analytical moment', exact: true }).click()
        await page.getByRole('dialog', { name: 'Choose analytical moment' }).locator('[data-moment-id="dummy"]').click()
        await page.getByRole('slider', { name: 'Replay timeline' }).fill('6.65')
      }
      if (name === 'standings') await page.locator('tbody tr').nth(9).waitFor()
      if (name === 'upcoming') await page.getByRole('heading', { name: 'Ashcombe City', exact: true }).first().waitFor()
      // Capture from document top so offscreen fixed skip links stay outside
      // the clip after controls have scrolled the live viewport.
      await page.evaluate(() => window.scrollTo({ top: 0, behavior: 'instant' }))
      const file = `${directory}/${name}-${width}.png`
      await page.screenshot({ path: file, fullPage: true })
      report.screenshots.push({ file, width, documentWidth: await page.evaluate(() => document.documentElement.scrollWidth), canvases: await page.locator('canvas').count() })
    }
  }
} finally {
  await browser.close()
  await writeFile(`${directory}/visual-review.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report))
}
if (report.errors.length) process.exitCode = 1
