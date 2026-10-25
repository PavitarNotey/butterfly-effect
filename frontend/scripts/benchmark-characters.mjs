/* global process */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import { dirname } from 'node:path'

// Run against the existing Vite server. No test server, backend or scene mutations
// beyond the public replay controls; inspect the actual R3F renderer in the page.
const options = Object.fromEntries(process.argv.slice(2).map(arg => arg.replace(/^--/, '').split('=')))
const output = options.output ?? '../output/benchmarks/characters.json'
const seconds = Number(options.seconds ?? 20)
const warmup = Number(options.warmup ?? 5)
const modes = (options.modes ?? 'procedural,single,skeletal').split(',')
const dprs = (options.dprs ?? '1,1.5').split(',').map(Number)
const scenarios = (options.scenarios ?? 'the-invisible-run').split(',')
const cameras = (options.cameras ?? 'broadcast,tactical').split(',')
const url = options.url ?? 'http://localhost:5173'
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const report = { date: new Date().toISOString(), browser: browser.version(), url, viewport: { width: 1440, height: 1100 }, warmupSeconds: warmup, sampleSeconds: seconds, results: [] }
await mkdir(dirname(output), { recursive: true })
try {
  for (const dpr of dprs) for (const mode of modes) for (const scenario of scenarios) for (const camera of cameras) {
    const context = await browser.newContext({ viewport: report.viewport, deviceScaleFactor: dpr })
    const page = await context.newPage()
    const errors = []
    let assetRequests = 0
    page.on('pageerror', error => errors.push(error.message))
    page.on('console', message => { if (message.type() === 'error' && /THREE|WebGL|shader/i.test(message.text())) errors.push(message.text()) })
    page.on('request', request => { if (/\/characters\/.*\.glb$/.test(request.url())) assetRequests++ })
    await page.goto(`${url}/studio?characters=${mode}`)
    await page.waitForFunction(() => document.querySelector('[data-testid="scene-ready"]')?.getAttribute('data-ready') === 'true')
    await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(scenario)
    if (camera === 'tactical') await page.getByRole('button', { name: 'Tactical', exact: true }).click()
    const result = await page.evaluate(async ({ mode, seconds, warmup }) => {
      const entry = performance.getEntriesByType('resource').find(e => e.name.includes('@react-three_fiber.js'))
      const fiber = await import(entry.name)
      const state = fiber._roots.get(document.querySelector('canvas')).store.getState()
      // Vite can append ?t= to the mounted module. Importing a bare URL can create
      // a SECOND store. Always resolve the exact URL already used by this page.
      const storeEntry = performance.getEntriesByType('resource').find(e => new URL(e.name).pathname === '/src/replay/store.ts')
      const { replayStore } = await import(storeEntry.name)
      const read = () => {
        const groups = []
        state.scene.traverse(object => { if (object.name === 'Voss-skeletal-prototype' || object.name.startsWith('SkeletalPlayer:')) groups.push(object) })
        return groups
      }
      const expected = mode === 'procedural' ? 0 : mode === 'single' ? (replayStore.getState().scenario.id === 'the-invisible-run' ? 1 : 0) : 22
      const deadline = performance.now() + 15000
      while (read().length !== expected && performance.now() < deadline) await new Promise(requestAnimationFrame)
      if (read().length !== expected) throw new Error(`Expected ${expected} rigs; got ${read().length}`)
      const startupMs = performance.now()
      replayStore.getState().restart(); replayStore.getState().play()
      const warmStart = performance.now()
      while (performance.now() - warmStart < warmup * 1000) await new Promise(requestAnimationFrame)
      replayStore.getState().pause(); replayStore.getState().restart(); replayStore.getState().play()
      await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame)
      let ball
      state.scene.traverse(object => { if (object.geometry?.parameters?.radius === .16) ball = object })
      if (!ball) throw new Error('Live ball not found')
      const ballStart = ball.position.toArray()
      const samples = [], calls = [], triangles = []
      const start = performance.now()
      let previous = start, streak = 0, longestStreak = 0, replayLoops = 0
      while (performance.now() - start < seconds * 1000) {
        const now = await new Promise(requestAnimationFrame)
        const interval = now - previous
        previous = now
        if (interval > 0) {
          samples.push(interval)
          streak = interval > 25 ? streak + 1 : 0
          longestStreak = Math.max(longestStreak, streak)
          calls.push(state.gl.info.render.calls); triangles.push(state.gl.info.render.triangles)
        }
        if (replayStore.getState().readTime() >= replayStore.getState().scenario.duration && performance.now() - start < seconds * 1000 - 100) {
          replayLoops++
          replayStore.getState().restart(); replayStore.getState().play()
        }
      }
      const endTime = replayStore.getState().readTime()
      replayStore.getState().pause()
      const ballEnd = ball.position.toArray()
      if (Math.hypot(...ballEnd.map((value, i) => value - ballStart[i])) < 1) throw new Error('Mounted scene did not advance during benchmark')
      samples.shift() // Drop the initial rAF scheduling offset.
      const sorted = [...samples].sort((a, b) => a - b)
      const mean = values => values.reduce((a, b) => a + b, 0) / values.length
      const memoryBefore = { ...state.gl.info.memory }
      const switchTimes = []
      for (const id of [replayStore.getState().scenario.id === 'the-invisible-run' ? 'the-missed-chance' : 'the-invisible-run', replayStore.getState().scenario.id]) {
        const switchStart = performance.now()
        replayStore.getState().setScenario(id)
        await new Promise(requestAnimationFrame); await new Promise(requestAnimationFrame)
        switchTimes.push(performance.now() - switchStart)
      }
      return {
        startupMs, frames: samples.length, replayEnd: endTime, replayLoops, ballStart, ballEnd,
        meanMs: mean(samples), medianMs: sorted[Math.floor(sorted.length / 2)], p95Ms: sorted[Math.floor(sorted.length * .95)],
        fps: 1000 / mean(samples), framesOver25Ms: samples.filter(v => v > 25).length, longestStreakOver25Ms: longestStreak,
        drawCalls: mean(calls), maxDrawCalls: Math.max(...calls), triangles: mean(triangles),
        memoryBefore, memoryAfterSwitch: { ...state.gl.info.memory }, switchTimesMs: switchTimes,
        drawingBuffer: [state.gl.domElement.width, state.gl.domElement.height], rigs: read().length,
      }
    }, { mode, seconds, warmup })
    const record = { mode, scenario, camera, dpr, assetRequests, ...result, errors }
    report.results.push(record)
    await writeFile(output, JSON.stringify(report, null, 2) + '\n')
    console.log(JSON.stringify(record))
    await context.close()
  }
} finally {
  await browser.close()
}
