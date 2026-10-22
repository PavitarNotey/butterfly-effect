import { expect, test } from '@playwright/test'
import { PerspectiveCamera, Vector3 } from 'three'
import scenario from '../src/replay/invisible-run.json' with { type: 'json' }
import { sampleCamera } from '../src/replay/camera'
import { samplePosition } from '../src/replay/sample'

test('loads 3D scenario, seeks, selects a player and switches to defender POV', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', e => errors.push(e.message))
  page.on('console', m => { if (m.type() === 'error' && /THREE|WebGL|shader/i.test(m.text())) errors.push(m.text()) })
  await page.goto('/')
  await expect(page.getByTestId('scene-ready')).toHaveAttribute('data-ready','true')
  await expect(page.locator('canvas')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'The Invisible Run.' })).toBeVisible()
  await page.getByRole('button', {name:'Play replay',exact:true}).click()
  await expect.poll(async()=>parseFloat(await page.getByTestId('replay-time').innerText())).toBeGreaterThan(.4)
  await page.getByRole('button', {name:'Pause replay',exact:true}).click()
  await page.getByRole('slider', {name:'Replay timeline'}).fill('8')
  await expect(page.getByTestId('replay-time')).toContainText('8.0')
  await page.getByRole('button', {name:'Tactical',exact:true}).click()
  await expect(page.getByTestId('replay-viewport')).toHaveAttribute('data-camera','tactical')
  // Project a known player's torso, then click the actual rendered mesh via the canvas.
  const canvas = page.locator('canvas')
  const box = (await canvas.boundingBox())!
  const pose = sampleCamera(scenario, 'tactical', 8)
  const projection = new PerspectiveCamera(pose.fov, box.width / box.height, .1, 240)
  projection.position.set(...pose.position); projection.up.set(...pose.up)
  projection.lookAt(...pose.target); projection.updateMatrixWorld()
  const defender = scenario.players.find(p => p.id === 'd4')!
  const position = samplePosition(defender.positions, 8)
  const pixel = new Vector3(position[0], 1.2, position[2]).project(projection)
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  await canvas.click({position:{x:(pixel.x+1)*box.width/2, y:(1-pixel.y)*box.height/2}})
  await expect(page.getByTestId('selected-name')).toHaveText('Dane Mercer')
  await page.getByRole('button', {name:"View from Dane's eyes"}).click()
  await expect(page.getByTestId('replay-viewport')).toHaveAttribute('data-camera','pov:d4')
  await expect(page.getByTestId('replay-time')).toContainText('8.0')
  await page.getByRole('combobox', {name:'Player perspective'}).selectOption('pov:a7')
  await expect(page.getByTestId('replay-viewport')).toHaveAttribute('data-camera','pov:a7')
  await expect(page.getByTestId('replay-time')).toContainText('8.0')
  await page.getByRole('button', {name:'Broadcast',exact:true}).click()
  await page.getByRole('checkbox', {name:'Movement trail'}).check()
  await page.getByRole('button', {name:'Seek to Goal · Aurora',exact:true}).click()
  await expect(page.getByTestId('score')).toHaveText('1 – 0')
  await page.getByRole('button', {name:'Seek to The invisible run',exact:true}).click()
  await expect(page.getByTestId('score')).toHaveText('0 – 0')
  await expect(page.getByTestId('replay-time')).toContainText('3.0')
  await page.getByRole('combobox', {name:'Playback speed'}).selectOption('2')
  await page.getByRole('button', {name:'Restart replay'}).click()
  await expect(page.getByTestId('replay-time')).toContainText('0.0')
  expect(errors).toEqual([])
})

test('finishes the replay at the endpoint and can replay the goal', async ({ page }) => {
  await page.goto('/')
  await expect(page.getByTestId('scene-ready')).toHaveAttribute('data-ready','true')
  await page.getByRole('slider', {name:'Replay timeline'}).fill('19')
  await page.getByRole('combobox', {name:'Playback speed'}).selectOption('2')
  await page.getByRole('button', {name:'Play replay',exact:true}).click()
  await expect(page.getByRole('button', {name:'Play replay',exact:true})).toBeVisible()
  await expect(page.getByTestId('replay-time')).toContainText('20.0')
  await expect(page.getByTestId('score')).toHaveText('1 – 0')
  await page.getByRole('button', {name:'Play replay',exact:true}).click()
  await expect.poll(async()=>parseFloat(await page.getByTestId('replay-time').innerText())).toBeLessThan(5)
})
