import { expect, test } from '@playwright/test'
import type { Page } from '@playwright/test'
import type { EvidenceBundle } from '../src/tactics/types'
import { sampleCamera } from '../src/replay/camera'
import invisible from '../src/replay/invisible-run.json' with { type: 'json' }
import { selectPlayer, viewPlayerPov } from './player-picker'

async function settle(page:Page) {
 await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
 await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.cameraSettled==='true')
}
async function inspect(page:Page) {
 await settle(page)
 return page.evaluate(async()=>{
  const entries=performance.getEntriesByType('resource')
  const fiber=await import(entries.find(e=>e.name.includes('@react-three_fiber.js'))!.name)
  const {replayStore}=await import(entries.find(e=>new URL(e.name).pathname==='/src/replay/store.ts')!.name)
  const state=fiber._roots.get(document.querySelector('canvas')).store.getState(),s=replayStore.getState()
  const id=s.camera.startsWith('pov:')?s.camera.slice(4):(s.selectedId??s.scenario.players[0].id)
  return {time:s.readTime(),playing:s.playing,speed:s.speed,camera:s.camera,aspect:state.camera.aspect,manual:s.tacticalView,look:s.freeLook,position:state.camera.position.toArray(),rotation:state.camera.quaternion.toArray(),root:state.scene.getObjectByName(`Player:${id}`).position.toArray(),hidden:!state.scene.getObjectByName(`Player:${id}`).visible,guide:s.guided,memory:{...state.gl.info.memory}}
 })
}
async function openAnalysis(page:Page) {
 await page.getByRole('button',{name:'Analyze this moment',exact:true}).click()
 await expect(page.getByTestId('tactical-moment-title')).toBeVisible()
}

test('guided evidence brings each category into the replay, animates, completes, replays and restores analysis',async({page})=>{
 test.setTimeout(75000)
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 await page.setViewportSize({width:1440,height:1100});await page.goto('/')
 await expect(page.locator('canvas')).toHaveAttribute('data-character-renderer','skeletal')
 await openAnalysis(page)
 const bundle:EvidenceBundle=await (await page.request.get('http://127.0.0.1:8000/api/scenarios/the-invisible-run/evidence')).json()
 const cases=[['movement','run'],['relationships','pass'],['corridor','pass'],['space','receive'],['finish','finish']] as const
 for(const [category,momentId]of cases) {
  const moment=bundle.moments.find(m=>m.id===momentId)!,fact=bundle.evidence.find(e=>moment.evidenceIds.includes(e.id)&&e.category===category)!
  await page.getByRole('region',{name:'Tactical analysis'}).getByRole('button',{name:new RegExp(moment.title)}).click()
  const card=page.locator(`.insight-card[data-evidence-id="${fact.id}"]`)
  await card.locator('summary').click();await card.getByRole('button',{name:/Watch this/}).click()
  const hud=page.getByTestId('guided-replay')
  await expect(hud).toHaveAttribute('data-evidence-id',fact.id)
  await expect(hud).toHaveAttribute('data-status','playing')
  await expect(page.locator('canvas')).toHaveAttribute('data-guided-evidence',fact.id)
  const state=await inspect(page),guide=state.guide!
  expect(guide.sourceHash).toBe(bundle.sourceHash);expect(guide.startTime).toBe(Math.max(0,fact.start-.65))
  expect(state.time).toBeGreaterThanOrEqual(guide.startTime);expect(state.time).toBeLessThan(guide.endTime)
  await expect.poll(async()=>{const b=await page.getByTestId('replay-viewport').boundingBox();return !!b&&b.y>=0&&b.y+b.height<=1101}).toBe(true)
  await expect(hud.getByRole('heading')).toBeVisible()
  await expect.poll(async()=>Number(await page.getByRole('slider',{name:'Replay timeline'}).inputValue())).toBeGreaterThan(fact.start+(fact.end-fact.start)*.35)
  await page.getByTestId('replay-viewport').screenshot({path:`../output/playwright/phase3c/guided-${category}.png`})
  await expect(hud).toHaveAttribute('data-status','complete',{timeout:15000})
  expect((await inspect(page)).time).toBe(guide.endTime)
  await expect(page.getByRole('button',{name:'Play replay',exact:true})).toBeVisible()
  await hud.getByRole('button',{name:'Replay again',exact:true}).click();await expect(hud).toHaveAttribute('data-status','playing')
  await hud.getByRole('button',{name:'Back to analysis',exact:true}).click();await expect(hud).toHaveCount(0)
  await expect(page.getByTestId('tactical-moment-title')).toHaveText(moment.title)
 }
 expect(errors).toEqual([])
})

test('guided replay interruptions and repeated use leave no stale evidence or resource growth',async({page})=>{
 await page.setViewportSize({width:1440,height:1100});await page.goto('/');await openAnalysis(page)
 const watch=page.getByRole('button',{name:'Show me in the replay',exact:true})
 // Warm the selected overlay once: Three uploads previously unseen geometry lazily.
 await watch.click();await settle(page);await page.getByRole('button',{name:'Close guided replay'}).click()
 const base=(await inspect(page)).memory
 for(let i=0;i<4;i++) {
  await watch.click();await expect(page.getByTestId('guided-replay')).toBeVisible()
  await page.getByRole('button',{name:'Close guided replay'}).click()
  await expect(page.getByTestId('guided-replay')).toHaveCount(0)
 }
 expect((await inspect(page)).memory).toEqual(base)
 await watch.click();await page.getByRole('slider',{name:'Replay timeline'}).fill('8')
 await expect(page.getByTestId('guided-replay')).toHaveCount(0)
 await watch.click();await page.getByRole('button',{name:'Broadcast',exact:true}).click()
 await expect(page.getByTestId('guided-replay')).toHaveCount(0)
 await watch.click();await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption('the-missed-chance')
 await expect(page.getByTestId('guided-replay')).toHaveCount(0)
 await expect(page.locator('canvas')).toHaveAttribute('data-guided-evidence','')
 await expect(page.locator('canvas')).toHaveAttribute('data-tactical-layers','')
 expect((await inspect(page)).guide).toBeNull()
})

test('Follow play interrupts a guided tactical replay without rewinding or leaving guided presentation behind',async({page})=>{
 await page.setViewportSize({width:1440,height:1100});await page.goto('/');await openAnalysis(page)
 await page.getByRole('slider',{name:'Replay timeline'}).fill('12')
 await page.getByRole('combobox',{name:'Playback speed'}).selectOption('2')
 await page.getByRole('checkbox',{name:'Space & coverage'}).check()
 await page.getByRole('region',{name:'Tactical analysis'}).getByRole('button',{name:/Rowan’s diagonal run/}).click()
 await page.getByRole('button',{name:'Show me in the replay',exact:true}).click()
 await expect(page.getByTestId('guided-replay')).toBeVisible()
 await expect(page.getByRole('button',{name:'Follow play',exact:true})).toBeVisible()
 const before=await inspect(page)
 expect(before.camera).toBe('tactical');expect(before.manual).not.toBeNull();expect(before.playing).toBe(true)
 await page.getByRole('button',{name:'Follow play',exact:true}).click()
 await expect(page.getByTestId('guided-replay')).toHaveCount(0)
 await expect(page.locator('canvas')).toHaveAttribute('data-guided-evidence','')
 await expect(page.locator('canvas')).toHaveAttribute('data-tactical-layers','passing,space')
 const after=await inspect(page)
 expect(after.guide).toBeNull();expect(after.manual).toBeNull();expect(after.playing).toBe(false)
 expect(after.speed).toBe(2);expect(after.camera).toBe('tactical')
 expect(after.time).toBeGreaterThanOrEqual(before.time)
 expect(after.time).toBeLessThan(before.guide!.endTime)
 expect(after.time).not.toBe(12)
 expect(after.position).toEqual(sampleCamera(invisible,'tactical',after.time,{aspect:after.aspect}).position)
})

test('player POV supports mouse and keyboard look, reset, seek, resume and scenario cleanup',async({page})=>{
 await page.setViewportSize({width:1440,height:1100});await page.goto('/')
 await selectPlayer(page,'a9')
 await page.getByRole('slider',{name:'Replay timeline'}).fill('10.4')
 await viewPlayerPov(page,'a9')
 const surface=page.getByRole('group',{name:/Paused player free-look/}),base=await inspect(page)
 expect(base.hidden).toBe(true)
 await surface.scrollIntoViewIfNeeded();const b=(await surface.boundingBox())!
 await page.mouse.move(b.x+b.width*.5,b.y+b.height*.4);await page.mouse.down();await page.mouse.move(b.x+b.width*.7,b.y+b.height*.48,{steps:10});await page.mouse.up()
 const manual=await inspect(page);expect(manual.rotation).not.toEqual(base.rotation);expect(manual.root).toEqual(base.root);expect(manual.position).toEqual(base.position);expect(manual.time).toBe(10.4)
 await page.getByTestId('replay-viewport').screenshot({path:'../output/playwright/phase3c/paused-free-look.png'})
 await page.getByRole('button',{name:'Reset view',exact:true}).click();expect((await inspect(page)).rotation).toEqual(base.rotation)
 await surface.focus();await page.keyboard.press('ArrowLeft');expect((await inspect(page)).look.yaw).not.toBe(0)
 await page.getByRole('slider',{name:'Replay timeline'}).fill('11');expect((await inspect(page)).look.yaw).not.toBe(0)
 await surface.focus();await page.keyboard.press('Home');expect((await inspect(page)).look.yaw).toBe(0)
 await page.getByRole('button',{name:'Follow player',exact:true}).click();await expect(surface).toHaveCount(0)
 await page.getByRole('button',{name:'Pause replay',exact:true}).click();await expect(surface).toBeVisible()
 await selectPlayer(page,'d4')
 expect((await inspect(page)).camera).toBe('pov:a9');expect((await inspect(page)).look).toEqual({yaw:0,pitch:0})
 await page.getByRole('button',{name:"View Dane Mercer's POV"}).click();expect((await inspect(page)).camera).toBe('pov:d4')
 await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption('the-missed-chance')
 expect((await inspect(page)).look).toEqual({yaw:0,pitch:0});await expect(surface).toHaveCount(0)
})

test('mobile touch free-look and reduced-motion guided layout remain usable',async({browser})=>{
 const context=await browser.newContext({viewport:{width:390,height:844},hasTouch:true,isMobile:true,reducedMotion:'reduce'})
 const page=await context.newPage();await page.goto('/')
 await expect(page.getByRole('checkbox',{name:'Reduce camera motion'})).toBeChecked()
 await page.getByRole('slider',{name:'Replay timeline'}).fill('10.4')
 await viewPlayerPov(page,'a9')
 const surface=page.getByRole('group',{name:/Paused player free-look/});await surface.scrollIntoViewIfNeeded()
 const b=(await surface.boundingBox())!,x=b.x+b.width*.4,y=b.y+b.height*.3
 const session=await context.newCDPSession(page)
 await session.send('Input.dispatchTouchEvent',{type:'touchStart',touchPoints:[{x,y}]})
 await session.send('Input.dispatchTouchEvent',{type:'touchMove',touchPoints:[{x:x+70,y:y+25}]})
 await session.send('Input.dispatchTouchEvent',{type:'touchEnd',touchPoints:[]})
 expect((await inspect(page)).look.yaw).not.toBe(0)
 await page.getByRole('button',{name:'Reset view',exact:true}).click();expect((await inspect(page)).look).toEqual({yaw:0,pitch:0})
 await page.getByRole('button',{name:'Broadcast',exact:true}).click();await openAnalysis(page)
 await page.getByRole('button',{name:'Show me in the replay',exact:true}).click()
 await expect(page.getByTestId('guided-replay')).toBeVisible()
 expect(await page.evaluate(()=>document.documentElement.scrollWidth<=innerWidth)).toBe(true)
 const canvas=(await page.locator('canvas').boundingBox())!,caption=(await page.getByTestId('guided-replay').boundingBox())!
 expect(caption.y).toBeGreaterThanOrEqual(canvas.y+canvas.height-1)
 await page.screenshot({path:'../output/playwright/phase3c/mobile-guided.png',fullPage:true})
 await page.getByRole('button',{name:'Close guided replay'}).click()
 await context.close()
})

test('mounted keeper and outcome reactions follow actual events and reproduce after backward seeking',async({page})=>{
 await page.setViewportSize({width:1440,height:1100});await page.goto('/')
 await expect(page.locator('canvas')).toHaveAttribute('data-character-renderer','skeletal')
 const errors:string[]=[];page.on('pageerror',e=>errors.push(e.message))
 for(const [scenario,id,times] of [
  ['the-invisible-run','d1',[5.8,7,7.4,8,9.9]],
  ['the-invisible-run','a9',[7.65,8.1,9.5,12.5]],
  ['the-missed-chance','c1',[14,15.4,16,18.1]],
  ['the-missed-chance','s9',[15.72,16.2,17,18.1]],
 ] as const) {
  await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption(scenario)
  const poses=[]
  for(const t of times) {
   await page.getByRole('slider',{name:'Replay timeline'}).fill(String(t));await settle(page)
   const pose=await page.evaluate(async({id})=>{
    const entries=performance.getEntriesByType('resource')
    const fiber=await import(entries.find(e=>e.name.includes('@react-three_fiber.js'))!.name)
    const {replayStore}=await import(entries.find(e=>new URL(e.name).pathname==='/src/replay/store.ts')!.name)
    const {sampleReaction}=await import(entries.find(e=>new URL(e.name).pathname==='/src/replay/animation/reactions.ts')!.name)
    const {samplePosition}=await import(entries.find(e=>new URL(e.name).pathname==='/src/replay/sample.ts')!.name)
    const state=fiber._roots.get(document.querySelector('canvas')).store.getState(),s=replayStore.getState(),p=s.scenario.players.find((p:{id:string})=>p.id===id),bones:number[]=[]
    state.scene.getObjectByName(`SkeletalPlayer:${id}`).traverse((b:{type:string;position:{toArray:()=>number[]};quaternion:{toArray:()=>number[]}})=>{if(b.type==='Bone')bones.push(...b.position.toArray(),...b.quaternion.toArray())})
    return {bones,root:state.scene.getObjectByName(`Player:${id}`).position.toArray(),expected:samplePosition(p.positions,s.readTime()),reaction:sampleReaction(s.scenario,p,s.readTime())}
   },{id})
   expect(pose.root).toEqual(pose.expected);expect(pose.bones).toHaveLength(65*7);expect(pose.bones.every(Number.isFinite)).toBe(true)
   poses.push({t,...pose})
  }
  expect(new Set(poses.map(p=>JSON.stringify(p.bones))).size).toBe(times.length)
  const middle=poses[Math.floor(poses.length/2)]
  expect(middle.reaction?.kind).toBe(id==='d1'?'keeper-dive':id==='c1'?'keeper-track':id==='a9'?'celebrate':'disappointed')
  if(id==='a9'||id==='s9')expect(poses[0].reaction).toBeNull()
  await page.getByRole('slider',{name:'Replay timeline'}).fill(String(middle.t));await settle(page)
  const repeat=await page.evaluate(async id=>{
   const entry=performance.getEntriesByType('resource').find(e=>e.name.includes('@react-three_fiber.js'))!,fiber=await import(entry.name),bones:number[]=[]
   fiber._roots.get(document.querySelector('canvas')).store.getState().scene.getObjectByName(`SkeletalPlayer:${id}`).traverse((b:{type:string;position:{toArray:()=>number[]};quaternion:{toArray:()=>number[]}})=>{if(b.type==='Bone')bones.push(...b.position.toArray(),...b.quaternion.toArray())})
   return bones
  },id)
  expect(repeat).toEqual(middle.bones)
 }
 expect(errors).toEqual([])
})
