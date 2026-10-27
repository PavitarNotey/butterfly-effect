import { expect, test } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
import type { Intelligence } from '../src/ai/client'

const matchPath = '/matches/vesper-tidal'

test.beforeEach(async ({ page, request }) => {
  expect((await (await request.get('http://127.0.0.1:8001/api/ai/status')).json()).provider).toBe('mock')
  await page.route('**/api/ai/**', async route => {
    const url = new URL(route.request().url())
    const response = await route.fetch({ url: `http://127.0.0.1:8001${url.pathname}${url.search}` })
    await route.fulfill({ response })
  })
})
test.afterEach(async ({ page }) => { await page.unrouteAll({ behavior: 'ignoreErrors' }) })

test('explicit generation, rapid clicks, mode cache reads and remounts have bounded request counts', async ({ page, request }, info) => {
  // A test-owned mock cache makes counts independent of earlier browser cases.
  // Real service cache/dedup/model-attempt accounting is tested in Python.
  const fixtures = new Map<string, Intelligence>()
  for (const mode of ['casual', 'analyst']) fixtures.set(mode, await (await request.get(`http://127.0.0.1:8001/api/ai/matches/vesper-tidal/recap?mode=${mode}`)).json())
  const saved = new Set<string>()
  let submissions = 0, newMockGenerations = 0, savedReads = 0
  const counts: Record<string, unknown>[] = []
  await page.route('**/api/ai/matches/vesper-tidal/recap?*', async route => {
    const url = new URL(route.request().url()), mode = url.searchParams.get('mode')!
    const cacheOnly = url.searchParams.get('cache_only') === 'true'
    if (cacheOnly) savedReads++
    else submissions++
    if (!saved.has(mode)) {
      if (cacheOnly) { await route.fulfill({ status: 409, json: { detail: 'No saved analysis.' } }); return }
      saved.add(mode); newMockGenerations++
    }
    await route.fulfill({ json: { ...fixtures.get(mode)!, cached: cacheOnly || submissions > newMockGenerations } })
  })
  function record(step: string) { counts.push({ step, submissions, newMockGenerations, savedReads }) }
  await page.goto('/')
  await page.getByTestId('strip-fixture').filter({ hasText: 'MATCH OF THE WEEK' }).click()
  const panel = page.getByTestId('match-intelligence')
  await expect(panel).toContainText('Authored demo')
  await page.getByRole('button', { name: 'Play preview' }).click()
  await expect.poll(async () => parseFloat(await page.getByTestId('preview-time').innerText())).toBeGreaterThan(.2)
  await page.getByRole('button', { name: 'Pause preview' }).click()
  await page.getByRole('slider', { name: 'Replay timeline' }).fill('6.2')
  await page.getByRole('button', { name: 'Overview', exact: true }).click()
  expect(submissions).toBe(0); record('open, play, seek, camera')
  await panel.getByRole('button', { name: 'Analyze this moment' }).evaluate((button: HTMLButtonElement) => { button.click(); button.click(); button.click() })
  await expect(panel.locator('.ai-narrative')).toBeVisible()
  expect(submissions).toBe(1); expect(newMockGenerations).toBe(1); record('three rapid analysis clicks')
  await panel.getByRole('button', { name: 'Analyst', exact: true }).click()
  await expect(panel.getByText(/No saved analysis in this mode/)).toBeVisible()
  expect(submissions).toBe(1); record('uncached mode switch')
  await panel.getByRole('button', { name: 'Analyze this moment' }).click()
  await expect(panel.locator('.ai-narrative')).toContainText('The diagonal continues')
  expect(newMockGenerations).toBe(2); record('explicit Analyst request')
  await panel.getByRole('button', { name: 'Casual Fan', exact: true }).click()
  await expect(panel.locator('.ai-cached')).toBeVisible()
  await panel.getByRole('button', { name: 'Check saved analysis' }).click()
  await expect(panel).toHaveAttribute('data-state', 'ready')
  await panel.getByRole('button', { name: 'Collapse AI intelligence' }).click()
  await panel.getByRole('button', { name: 'Expand AI intelligence' }).click()
  expect(submissions).toBe(2); expect(newMockGenerations).toBe(2); record('cached mode, saved check, collapse/expand')
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Fixtures & results' }).click()
  await expect(page.locator('.listing-page')).toBeVisible()
  await page.goBack()
  await expect(panel.getByRole('button', { name: 'Analyze this moment' })).toBeVisible()
  expect(submissions).toBe(2); record('route remount')
  await mkdir('../output/playwright/phase4c', { recursive: true })
  await writeFile('../output/playwright/phase4c/request-counts.json', JSON.stringify(counts, null, 2))
  await info.attach('request-counts.json', { body: JSON.stringify(counts, null, 2), contentType: 'application/json' })
})

for (const width of [1440, 390]) {
  test(`Match Center Show me why verifies and restores all three scenarios at ${width}px`, async ({ page, request }) => {
    test.setTimeout(60000) // Three complete real-time guided passages plus captures.
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    let submissions = 0
    page.on('request', r => { if (/\/api\/ai\/matches\/.*\/recap/.test(r.url()) && !r.url().includes('cache_only=true')) submissions++ })
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    for (const [match, scenario, score] of [['vesper-tidal', 'the-untouched-pass', '2 – 1'], ['aurora-boreal', 'the-invisible-run', '2 – 1'], ['solstice-cinder', 'the-missed-chance', '0 – 1']]) {
      const data: Intelligence = await (await request.get(`http://127.0.0.1:8001/api/ai/matches/${match}/recap`)).json()
      const id = data.narratives[0].key_evidence.find(s => s.kind === 'measurement')!.evidence_id!
      await page.goto(`/matches/${match}`)
      await expect(page.getByTestId('scene-ready')).toHaveAttribute('data-ready', 'true')
      await expect(page.getByTestId('match-final-score')).toHaveText(score)
      await page.getByRole('slider', { name: 'Replay timeline' }).fill('6.1')
      await page.getByRole('button', { name: 'Overview', exact: true }).click()
      const panel = page.getByTestId('match-intelligence')
      await panel.getByRole('button', { name: 'Analyze this moment' }).click()
      const prior = submissions
      const watch = panel.getByRole('button', { name: 'Show me why' })
      await watch.focus(); await page.keyboard.press('Enter')
      const guide = page.getByTestId('guided-replay')
      await expect(guide).toHaveAttribute('data-evidence-id', id)
      await expect(guide).toHaveAttribute('data-kind','moment')
      await expect(guide.getByRole('heading')).toBeFocused()
      await expect(page.getByTestId('match-viewer')).toHaveAttribute('data-scenario', scenario)
      await expect(page.locator('canvas')).toHaveCount(1)
      await expect(guide).toHaveAttribute('data-status', 'complete', { timeout: 15000 })
      await page.getByTestId('match-viewer').screenshot({ path: `../output/playwright/phase4c/${scenario}-guided-${width}.png` })
      await guide.getByRole('button', { name: 'Replay again' }).click()
      await expect(guide).toHaveAttribute('data-status', 'playing')
      await guide.getByRole('button', { name: 'Close guided replay' }).click()
      await expect(guide).toHaveCount(0)
      await expect(watch).toBeFocused()
      await expect(page.getByTestId('preview-time')).toContainText('6.1 /')
      await expect(page.getByTestId('match-viewer')).toHaveAttribute('data-camera', 'overview')
      expect(submissions).toBe(prior)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      if (width === 1440) await page.evaluate(() => {
        const section = document.querySelector('.match-experience')!, chrome = document.querySelector('.site-chrome')!
        window.scrollTo({ top: section.getBoundingClientRect().top + scrollY - chrome.getBoundingClientRect().height - 16, behavior: 'instant' })
      })
      else await panel.scrollIntoViewIfNeeded()
      await page.screenshot({ path: `../output/playwright/phase4c/${match}-ready-${width}.png` })
    }
    expect(errors).toEqual([])
  })
}

test('stale, missing and interrupted evidence fails without a generated visual explanation', async ({ page }) => {
  let kind: 'stale' | 'missing' | 'delayed' = 'stale'
  let release!: () => void
  const gate = new Promise<void>(r => { release = r })
  await page.route('**/api/scenarios/the-untouched-pass/evidence', async route => {
    const response = await route.fetch()
    const bundle = await response.json()
    if (kind === 'stale') bundle.sourceHash = 'stale'
    if (kind === 'missing') bundle.moments = []
    if (kind === 'delayed') await gate
    await route.fulfill({ json: bundle }).catch(() => {})
  })
  await page.goto(matchPath)
  const panel = page.getByTestId('match-intelligence')
  await panel.getByRole('button', { name: 'Analyze this moment' }).click()
  await panel.getByRole('button', { name: 'Show me why' }).click()
  await expect(panel.getByRole('alert')).toContainText('Supporting replay is unavailable')
  await expect(page.getByTestId('guided-replay')).toHaveCount(0)
  kind = 'missing'
  await panel.getByRole('button', { name: 'Show me why' }).click()
  await expect(panel.getByRole('alert')).toContainText('Supporting replay is unavailable')
  await expect(page.getByTestId('guided-replay')).toHaveCount(0)
  kind = 'delayed'
  await panel.getByRole('button', { name: 'Show me why' }).click()
  await expect(panel.getByRole('button', { name: /Loading supporting replay/ })).toBeDisabled()
  await page.getByTestId('strip-fixture').filter({ hasText: 'SOL' }).click()
  release()
  await expect(page.getByTestId('match-viewer')).toHaveAttribute('data-scenario', 'the-missed-chance')
  await expect(page.getByTestId('guided-replay')).toHaveCount(0)
})

for (const status of ['disabled', 'invalid_configuration', 'unreachable', 'paused'] as const) {
  test(`${status} availability remains honest and replay works`, async ({ page }) => {
    await page.route('**/api/ai/status', route => status === 'unreachable' ? route.abort() : route.fulfill({ json: { provider: status === 'paused' ? 'foundry' : status, available: false, message: 'Unavailable.' } }))
    await page.goto(matchPath)
    const panel = page.getByTestId('match-intelligence')
    await expect(panel.locator('.ai-availability')).toContainText(status === 'unreachable' ? 'unreachable' : status === 'paused' ? 'paused' : 'AI unavailable')
    await expect(panel.locator('.ai-availability')).not.toContainText('Microsoft Foundry')
    await page.getByRole('button', { name: 'Play preview' }).click()
    await expect.poll(async () => parseFloat(await page.getByTestId('preview-time').innerText())).toBeGreaterThan(.2)
    await page.getByRole('button', { name: 'Pause preview' }).click()
  })
}

for (const width of [1440, 1024, 390]) {
  test(`primary routes, optional introduction and layout at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 1000 })
    await page.emulateMedia({ reducedMotion: 'reduce' })
    for (const [label, path] of [['home', '/'], ['fixtures', '/fixtures'], ['standings', '/standings'], ['match', matchPath], ['studio', '/matches/vesper-tidal/moments/vesper-tidal-merrick'], ['library', '/studio']]) {
      await page.goto(path)
      await expect(page.locator('#page-main')).toBeVisible()
      if (['match', 'studio', 'library'].includes(label)) {
        await expect(page.getByTestId('scene-ready')).toHaveAttribute('data-ready', 'true')
        const intro = page.getByRole('complementary', { name: 'Getting started with the replay' })
        await expect(intro.getByRole('list')).not.toBeVisible()
        await intro.getByText('How to explore', { exact: true }).focus(); await page.keyboard.press('Enter')
        await expect(intro.getByRole('list')).toBeVisible()
        await intro.getByText('How to explore', { exact: true }).click()
      }
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      await page.screenshot({ path: `../output/playwright/phase4c/${label}-${width}.png`, fullPage: false })
    }
  })
}

test('invalid league replay mapping cannot launch supporting playback', async ({ page }) => {
  await page.route('**/api/matches/vesper-tidal', async route => {
    const response = await route.fetch()
    const match = await response.json()
    match.events.find((event: { replay: unknown }) => event.replay).replay.eventId = 'shot'
    await route.fulfill({ json: match })
  })
  await page.goto(matchPath)
  const panel = page.getByTestId('match-intelligence')
  await panel.getByRole('button', { name: 'Analyze this moment' }).click()
  await panel.getByRole('button', { name: 'Show me why' }).click()
  await expect(panel.getByRole('alert')).toContainText('replay reference could not be verified')
  await expect(page.getByTestId('guided-replay')).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveCount(0)
})

test('single renderer retains bounded resources through evidence and route transitions', async ({ page }, info) => {
  const samples = []
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /WebGL|THREE|shader/i.test(m.text())) errors.push(m.text()) })
  for (const stage of ['preview', 'studio', 'preview', 'studio']) {
    if (samples.length === 0) await page.goto(matchPath)
    else await page.getByRole('link', { name: stage === 'studio' ? 'Open full analysis' : 'Return to Match Center' }).click()
    await expect(page.locator('canvas')).toHaveAttribute('data-character-renderer', 'skeletal')
    const sample = await page.evaluate(async stage => {
      const entries = performance.getEntriesByType('resource')
      const fiber = await import(entries.find(e => e.name.includes('@react-three_fiber.js'))!.name)
      const { replayStore } = await import(entries.find(e => new URL(e.name).pathname === '/src/replay/store.ts')!.name)
      while (!fiber._roots.has(document.querySelector('canvas'))) await new Promise(requestAnimationFrame)
      const state = fiber._roots.get(document.querySelector('canvas')).store.getState()
      replayStore.getState().restart(); replayStore.getState().play()
      const deltas: number[] = []
      let previous = performance.now()
      const start = previous
      while (performance.now() - start < 2000) {
        const wall = await new Promise<number>(requestAnimationFrame)
        deltas.push(wall - previous); previous = wall
      }
      replayStore.getState().pause()
      let rigs = 0
      state.scene.traverse((object: { name: string }) => { if (object.name.startsWith('Player:')) rigs++ })
      const sorted = deltas.toSorted((a, b) => a - b)
      return { stage, rigs, canvases: document.querySelectorAll('canvas').length, frames: deltas.length,
        medianFrameMs: sorted[Math.floor(sorted.length / 2)], p95FrameMs: sorted[Math.floor(sorted.length * .95)],
        drawCalls: state.gl.info.render.calls, triangles: state.gl.info.render.triangles,
        geometries: state.gl.info.memory.geometries, textures: state.gl.info.memory.textures,
        glbRequests: entries.filter(e => /\.glb(?:$|\?)/.test(e.name)).length }
    }, stage)
    samples.push(sample)
    expect(sample.canvases).toBe(1); expect(sample.rigs).toBe(22)
    if (samples.length > 2) {
      const previous = samples[samples.length - 3]
      expect(sample.geometries).toBe(previous.geometries)
      expect(sample.textures).toBe(previous.textures)
      expect(sample.glbRequests).toBe(previous.glbRequests)
    }
  }
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('link', { name: 'Home', exact: true }).click()
  await expect(page.locator('canvas')).toHaveCount(0)
  expect(errors).toEqual([])
  await mkdir('../output/playwright/phase4c', { recursive: true })
  await writeFile('../output/playwright/phase4c/render-resources.json', JSON.stringify(samples, null, 2))
  await info.attach('render-resources.json', { body: JSON.stringify(samples, null, 2), contentType: 'application/json' })
})
