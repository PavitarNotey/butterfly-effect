import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import source from '../src/replay/untouched-pass.json' with { type: 'json' }
import { samplePosition } from '../src/replay/sample'
import { chooseMoment } from './moment-picker'
import { selectPlayer, viewPlayerPov } from './player-picker'

async function inspect(page: Page) {
  await expect(page.locator('canvas')).toHaveAttribute('data-character-renderer','skeletal')
  await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
  return page.evaluate(async () => {
    const entries=performance.getEntriesByType('resource')
    const fiber=await import(entries.find(e=>e.name.includes('@react-three_fiber.js'))!.name)
    const {replayStore}=await import(entries.find(e=>new URL(e.name).pathname==='/src/replay/store.ts')!.name)
    const state=fiber._roots.get(document.querySelector('canvas')).store.getState(), replay=replayStore.getState()
    const rig=state.scene.getObjectByName('SkeletalPlayer:v9'), bones:number[]=[]
    rig?.traverse((b:{type:string;position:{toArray:()=>number[]};quaternion:{toArray:()=>number[]}})=>{if(b.type==='Bone')bones.push(...b.position.toArray(),...b.quaternion.toArray())})
    const roots=replay.scenario.players.map((p:{id:string})=>({id:p.id,root:state.scene.getObjectByName(`Player:${p.id}`).position.toArray(),visible:state.scene.getObjectByName(`Player:${p.id}`).visible}))
    return {bones,roots,time:replay.readTime(),camera:replay.camera,selected:replay.selectedId,guide:replay.guided,memory:{...state.gl.info.memory},playing:replay.playing,speed:replay.speed}
  })
}

test('third showcase plays the full canonical clip at 1× and reproduces the dummy after seeks, cameras and remounts',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width:1440,height:1100});await page.goto('/studio')
  await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption(source.id)
  await expect(page.locator('canvas')).toHaveAttribute('data-character-renderer','skeletal')
  const slider=page.getByRole('slider',{name:'Replay timeline'})
  await expect(slider).toHaveAttribute('max','13.6')
  await expect(page.getByRole('combobox',{name:'Playback speed'})).toHaveValue('1')
  await page.getByRole('button',{name:'Play replay',exact:true}).click()
  const elapsed=await page.evaluate(async()=>{
    const entries=performance.getEntriesByType('resource')
    const {replayStore}=await import(entries.find(e=>new URL(e.name).pathname==='/src/replay/store.ts')!.name)
    const start=performance.now(),time=replayStore.getState().readTime()
    while(replayStore.getState().playing) await new Promise(requestAnimationFrame)
    return {wall:(performance.now()-start)/1000,replay:replayStore.getState().readTime()-time}
  })
  expect(elapsed.replay/elapsed.wall).toBeCloseTo(1,1)
  await expect(page.getByTestId('score')).toHaveText('1 – 0')
  await slider.fill('6.65');const direct=await inspect(page)
  expect(direct.bones.length).toBe(65*7)
  for(const p of direct.roots) expect(p.root).toEqual(samplePosition(source.players.find(player=>player.id===p.id)!.positions,6.65))
  for(const id of ['v9','v10','t5']) {
    await viewPlayerPov(page,id)
    await slider.fill('1');await slider.fill('6.65')
    const current=await inspect(page)
    expect(current.bones).toEqual(direct.bones)
    expect(current.roots.find(p=>p.id===id)?.visible).toBe(false)
  }
  for(const id of ['the-invisible-run','the-missed-chance',source.id]) {
    await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption(id)
    await expect(slider).toHaveValue('0')
    await expect(page.getByTestId('selected-name')).toHaveCount(0)
  }
  await slider.fill('6.65');expect((await inspect(page)).bones).toEqual(direct.bones)
  expect(errors).toEqual([])
})

test('guided dummy shows the full pass with validated evidence and live highlights and existing restoration and interruption',async({page})=>{
  const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
  await page.setViewportSize({width:1440,height:1100});await page.goto('/studio')
  await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption(source.id)
  await page.getByRole('button',{name:'Analyze this moment'}).click()
  await expect(page.getByTestId('tactical-moment-title')).toBeVisible()
  await chooseMoment(page,'dummy');await selectPlayer(page,'t5')
  await page.getByRole('button',{name:'Tactical',exact:true}).click()
  await page.getByRole('combobox',{name:'Playback speed'}).selectOption('2')
  const before=await inspect(page)
  const watch=page.getByRole('button',{name:'Show me in the replay',exact:true})
  await watch.click()
  const hud=page.getByTestId('guided-replay')
  await expect(hud).toHaveAttribute('data-evidence-id',`${source.id}:v1:dummy:dummy`)
  await expect(hud).toContainText('without a touch')
  const guided=await inspect(page)
  expect(guided.guide?.dummyEventId).toBe('dummy');expect(guided.camera).toBe('broadcast');expect(guided.speed).toBe(.5)
  expect(guided.guide?.relevantPlayerIds).toEqual(expect.arrayContaining(['v9','v10','v7','t5','t6']))
  await expect(hud).toHaveAttribute('data-status','complete',{timeout:12000})
  await hud.getByRole('button',{name:'Replay again',exact:true}).click()
  await expect(hud).toHaveAttribute('data-status','playing')
  await hud.getByRole('button',{name:'Close guided replay'}).click()
  const restored=await inspect(page)
  expect(restored.time).toBe(before.time);expect(restored.camera).toBe(before.camera);expect(restored.selected).toBe('t5');expect(restored.speed).toBe(2)
  // Warm lazy overlay resources, then repeat without growth.
  await watch.click();await inspect(page);await hud.getByRole('button',{name:'Close guided replay'}).click()
  const memory=(await inspect(page)).memory
  await watch.click();await hud.getByRole('button',{name:'Close guided replay'}).click()
  expect((await inspect(page)).memory).toEqual(memory)
  await watch.click();await page.getByRole('slider',{name:'Replay timeline'}).fill('7')
  await expect(hud).toHaveCount(0)
  await chooseMoment(page,'dummy');await watch.click();await page.getByRole('button',{name:'Tactical',exact:true}).click()
  await expect(hud).toHaveCount(0)
  await chooseMoment(page,'dummy');await watch.click()
  await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption('the-missed-chance')
  await expect(hud).toHaveCount(0)
  await expect(page.locator('canvas')).toHaveAttribute('data-guided-evidence','')
  expect(errors).toEqual([])
})

test('third roster picker, simulated POV and dummy guidance work on a narrow viewport',async({page})=>{
  await page.setViewportSize({width:390,height:844});await page.goto('/studio')
  await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption(source.id)
  await page.getByRole('button',{name:'Open player picker'}).click()
  await page.getByRole('searchbox',{name:'Search Players'}).fill('Ellery')
  await page.getByTestId('player-option-v9').click()
  await expect(page.getByTestId('selected-name')).toHaveText('Soren Ellery')
  await page.getByRole('button',{name:/^View .+ POV$/}).click()
  await page.getByRole('slider',{name:'Replay timeline'}).fill('6.65')
  expect((await inspect(page)).camera).toBe('pov:v9')
  await page.getByRole('button',{name:'Analyze this moment'}).click()
  await expect(page.getByTestId('tactical-moment-title')).toBeVisible()
  await chooseMoment(page,'dummy')
  await page.getByRole('button',{name:'Show me in the replay',exact:true}).click()
  await expect(page.getByTestId('guided-replay')).toBeVisible()
  expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
  await page.screenshot({path:'../output/phase3d/mobile-guided.png',fullPage:true})
})
