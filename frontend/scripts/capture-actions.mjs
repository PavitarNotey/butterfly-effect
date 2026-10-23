/* global process */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'
const label = process.argv[2] ?? 'after', folder = `../output/actions/${label}`
await mkdir(folder, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const report = []
async function selectPlayer(page,id) { await page.getByRole('button',{name:'Open player picker'}).click();await page.getByTestId(`player-option-${id}`).click() }
try {
  if (process.argv.includes('--video')) {
    for (const scenario of ['the-invisible-run', 'the-missed-chance']) {
      const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, recordVideo: { dir: `${folder}/video`, size: { width: 1440, height: 1100 } } })
      const page = await context.newPage()
      await page.goto('http://localhost:5173')
      await page.waitForFunction(() => document.querySelector('canvas')?.dataset.characterRenderer === 'skeletal')
      await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(scenario)
      await selectPlayer(page,scenario === 'the-invisible-run' ? 'a9' : 's9')
      await page.getByRole('combobox', { name: 'Playback speed' }).selectOption('0.5')
      await page.getByRole('slider', { name: 'Replay timeline' }).fill('7.8')
      await page.getByRole('button', { name: 'Play replay', exact: true }).click()
      await page.waitForFunction(() => Number(document.querySelector('input[aria-label="Replay timeline"]').value) >= 16.3, undefined, { timeout: 30000 })
      await page.getByRole('button', { name: 'Pause replay', exact: true }).click()
      const video = page.video()
      await context.close()
      await video.saveAs(`${folder}/${scenario}-live-half-speed.webm`)
    }
    console.log(`Recorded both live sequences at half speed in ${folder}`)
  } else {
  const page = await browser.newPage({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1.5 })
  await page.goto('http://localhost:5173')
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.characterRenderer === 'skeletal')
  for (const [scenario, actions] of [['the-invisible-run', [['pass', 'a8', 9], ['receive', 'a9', 10.4], ['shot', 'a9', 14]]], ['the-missed-chance', [['pass', 's8', 8.5], ['receive', 's9', 10.2], ['shot', 's9', 15]]]]) {
    await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(scenario)
    for (const [kind, actor, contact] of actions) for (const [phase, offset] of [['prepare', -.25], ['contact', 0], ['follow', .20], ['plant-before', -.08], ['plant-after', .08]]) {
      await selectPlayer(page,actor)
      const time = Number((contact + offset).toFixed(2))
      await page.getByRole('slider', { name: 'Replay timeline' }).fill(String(time))
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
      const measurement = await page.evaluate(async ({ actor, contact }) => {
        const entries = performance.getEntriesByType('resource')
        const fiber = await import(entries.find(e => e.name.includes('@react-three_fiber.js')).name)
        const THREE = await import(entries.find(e => /\/three\.js\?/.test(e.name)).name)
        const { replayStore } = await import(entries.find(e => new URL(e.name).pathname === '/src/replay/store.ts').name)
        const { samplePosition, sampleYaw } = await import(entries.find(e => new URL(e.name).pathname === '/src/replay/sample.ts').name)
        const state = fiber._roots.get(document.querySelector('canvas')).store.getState(), replay = replayStore.getState()
        state.scene.updateMatrixWorld(true)
        const root = state.scene.getObjectByName(`Player:${actor}`), rig = state.scene.getObjectByName(`SkeletalPlayer:${actor}`)
        let mesh; rig.traverse(o => { if (o.isSkinnedMesh) mesh = o })
        const ball = new THREE.Vector3(...samplePosition(replay.scenario.ball, replay.readTime())), p = new THREE.Vector3(), feet = {}
        for (const [side, sign] of [['l', 1], ['r', -1]]) {
          const positions = mesh.geometry.attributes.position, points = new Map()
          let minY = Infinity, gap = Infinity
          for (let i = 0; i < positions.count; i++) {
            if (positions.getY(i) > .115 || positions.getX(i) * sign < .02) continue
            mesh.getVertexPosition(i, p).applyMatrix4(mesh.matrixWorld)
            points.set(i, p.clone())
            minY = Math.min(minY, p.y); gap = Math.min(gap, p.distanceTo(ball) - .16)
          }
          const sole = [...points.keys()].filter(i => positions.getY(i) < .02)
          const heel = sole.reduce((a, b) => positions.getZ(a) < positions.getZ(b) ? a : b)
          const toe = sole.reduce((a, b) => positions.getZ(a) > positions.getZ(b) ? a : b)
          const soleAnchors = { heel: points.get(heel).toArray(), toe: points.get(toe).toArray() }
          const vertexGap = gap, index = mesh.geometry.index, triangle = new THREE.Triangle(), closest = new THREE.Vector3()
          for (let i = 0; i < index.count; i += 3) {
            const a = points.get(index.getX(i)), b = points.get(index.getX(i + 1)), c = points.get(index.getX(i + 2))
            if (a && b && c) {
              triangle.set(a, b, c).closestPointToPoint(ball, closest)
              gap = Math.min(gap, closest.distanceTo(ball) - .16)
            }
          }
          feet[side] = { soleAnchors, soleY: minY, vertexGapM: vertexGap, ballSurfaceGapM: gap, ankle: rig.getObjectByName(`foot_${side}`).getWorldPosition(p).toArray() }
        }
        const player = replay.scenario.players.find(p => p.id === actor)
        return { feet, root: root.position.toArray(), rootError: root.position.distanceTo(new THREE.Vector3(...samplePosition(player.positions, replay.readTime()))), ball: ball.toArray(), canonical: { contactRoot: samplePosition(player.positions, contact), contactBall: samplePosition(replay.scenario.ball, contact), contactYaw: sampleYaw(player.facing, contact) } }
      }, { actor, contact })
      report.push({ scenario, actor, kind, contact, time, phase, ...measurement })
      if (phase.startsWith('plant-')) continue
      const name = `${scenario}-${kind}-${phase}`
      await page.locator('canvas').screenshot({ path: `${folder}/${name}-broadcast.png` })
      // Temporarily inspect the actual mounted character, then restore CameraRig.
      await page.evaluate(async actor => {
        const entries = performance.getEntriesByType('resource')
        const fiber = await import(entries.find(e => e.name.includes('@react-three_fiber.js')).name)
        const state = fiber._roots.get(document.querySelector('canvas')).store.getState(), p = state.scene.getObjectByName(`Player:${actor}`).position
        state.setFrameloop('never')
        state.camera.position.set(p.x - 3.8, 2.5, p.z + 4.6)
        state.camera.up.set(0, 1, 0); state.camera.lookAt(p.x + .15, .85, p.z)
        state.camera.fov = 35; state.camera.updateProjectionMatrix()
        state.gl.render(state.scene, state.camera)
      }, actor)
      // The paused inspection camera does not run the DOM projection callback.
      await page.locator('.world-player-label').evaluate(element => { element.style.visibility = 'hidden' })
      await page.locator('canvas').screenshot({ path: `${folder}/${name}-closeup.png` })
      await page.locator('.world-player-label').evaluate(element => { element.style.visibility = '' })
      await page.evaluate(async () => {
        const entries = performance.getEntriesByType('resource')
        const fiber = await import(entries.find(e => e.name.includes('@react-three_fiber.js')).name)
        fiber._roots.get(document.querySelector('canvas')).store.getState().setFrameloop('always')
      })
      await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
    }
  }
  await writeFile(`${folder}/contacts.json`, JSON.stringify(report, null, 2) + '\n')
  console.log(`Measured ${report.length} action frames; captured preparation/contact/follow in broadcast + close-up, in ${folder}`)
  }
} finally { await browser.close() }
