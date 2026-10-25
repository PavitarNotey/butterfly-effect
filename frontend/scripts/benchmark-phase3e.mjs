import { chromium } from '@playwright/test'
import { writeFile, mkdir } from 'node:fs/promises'

const browser = await chromium.launch({ channel: 'chrome', headless: true })
const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1.5 })
const page = await context.newPage()
await page.addInitScript(() => performance.setResourceTimingBufferSize(3000))
const report = { browser: browser.version(), viewport: { width: 1440, height: 1100, dpr: 1.5 }, errors: [], samples: [], cleanup: [] }
page.on('pageerror', e => report.errors.push(e.message))
page.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) report.errors.push(m.text()) })
async function ready() {
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.characterRenderer === 'skeletal')
  // Import introspection modules in the page's main world, where R3F owns roots.
  await page.evaluate(async () => {
    if (!window.__phase3eFiber) {
      const entry = performance.getEntriesByType('resource').find(e => e.name.includes('@react-three_fiber.js'))
      window.__phase3eFiber = await import(entry.name)
      window.__phase3eReplay = await import('/src/replay/store.ts')
    }
    while (!window.__phase3eFiber._roots.has(document.querySelector('canvas'))) await new Promise(requestAnimationFrame)
  })
}
async function profile(label) {
  return page.evaluate(async label => {
    const entries = performance.getEntriesByType('resource')
    const { replayStore } = window.__phase3eReplay
    const fiber = window.__phase3eFiber
    const state = fiber._roots.get(document.querySelector('canvas')).store.getState()
    const replay = replayStore.getState()
    replay.restart(); replay.play()
    // Active warmup, then eight seconds sampled from the same authoritative clock.
    const warmup = performance.now()
    while (performance.now() - warmup < 3000) await new Promise(requestAnimationFrame)
    const deltas = [], draws = [], triangles = []
    let previous = performance.now(), start = previous
    while (performance.now() - start < 8000) {
      const wall = await new Promise(requestAnimationFrame)
      deltas.push(wall - previous); previous = wall
      draws.push(state.gl.info.render.calls); triangles.push(state.gl.info.render.triangles)
    }
    replay.pause()
    const sorted = deltas.toSorted((a, b) => a - b), mean = values => values.reduce((a, b) => a + b, 0) / values.length
    window.__phase3eRenderer = state.gl
    return { label, frames: deltas.length, meanFrameMs: mean(deltas), medianFrameMs: sorted[Math.floor(sorted.length / 2)], p95FrameMs: sorted[Math.floor(sorted.length * .95)], framesOver25ms: deltas.filter(x => x > 25).length, meanDrawCalls: mean(draws), meanTriangles: mean(triangles), memory: { ...state.gl.info.memory }, rigCount: (() => { let count = 0; state.scene.traverse(object => { if (object.name.startsWith('Player:')) count++ }); return count })(), canvases: document.querySelectorAll('canvas').length, glbRequests: entries.filter(e => /\.glb(?:$|\?)/.test(e.name)).length }
  }, label)
}
try {
  await page.goto('http://localhost:5173/matches/vesper-tidal')
  await ready()
  report.samples.push(await profile('match-center-vesper-broadcast'))
  await page.getByRole('link', { name: 'Open full analysis' }).click()
  await page.getByTestId('replay-viewport').waitFor()
  await ready()
  report.samples.push(await profile('studio-vesper-broadcast'))
  for (let i = 0; i < 3; i++) {
    for (const stage of ['preview', 'studio']) {
      await page.getByRole('link', { name: stage === 'preview' ? 'Return to Match Center' : 'Open full analysis' }).click()
      await page.locator(stage === 'preview' ? '[data-testid=match-viewer]' : '[data-testid=replay-viewport]').waitFor()
      await ready()
      // R3F releases the previous context asynchronously during unmount.
      await page.waitForFunction(() => window.__phase3eRenderer.getContext().isContextLost())
      report.cleanup.push(await page.evaluate(async stage => {
        const fiber = window.__phase3eFiber
        const renderer = fiber._roots.get(document.querySelector('canvas')).store.getState().gl
        const previousContextLost = window.__phase3eRenderer.getContext().isContextLost()
        window.__phase3eRenderer = renderer
        for (let frame = 0; frame < 10; frame++) await new Promise(requestAnimationFrame)
        return { stage, memory: { ...renderer.info.memory }, previousContextLost, canvases: document.querySelectorAll('canvas').length }
      }, stage))
    }
  }
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home', exact: true }).click()
  await page.getByTestId('strip-fixture').first().waitFor()
  await page.waitForFunction(() => window.__phase3eRenderer.getContext().isContextLost())
  report.cleanup.push(await page.evaluate(() => ({ stage: 'home', canvases: document.querySelectorAll('canvas').length, previousContextLost: window.__phase3eRenderer.getContext().isContextLost() })))
} finally {
  await browser.close()
  await mkdir('../output/phase3e', { recursive: true })
  await writeFile('../output/phase3e/performance.json', JSON.stringify(report, null, 2) + '\n')
  console.log(JSON.stringify(report))
}
