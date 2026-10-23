/* global process */
import { chromium } from '@playwright/test'
import { mkdir, readFile, writeFile } from 'node:fs/promises'
const label = process.argv[2] ?? 'before'
const folder = `../output/playwright/phase3c/${label}`
await mkdir(folder, { recursive: true })
const browser = await chromium.launch({ channel: 'chrome', headless: true })
const errors = []
const sources = await Promise.all(['invisible-run','missed-chance'].map(async name=>JSON.parse(await readFile(new URL(`../src/replay/${name}.json`,import.meta.url),'utf8'))))
const sourceFor = id => sources.find(source=>source.id===id)
const eventTime = (id,type) => sourceFor(id).events.find(event=>event.type===type).t
const timeString = time => String(Number(time.toFixed(2)))
async function selectPlayer(page,id) { await page.getByRole('button',{name:'Open player picker'}).click();await page.getByTestId(`player-option-${id}`).click() }
async function viewPlayerPov(page,id) { await selectPlayer(page,id);await page.getByRole('button',{name:/^View .+ POV$/}).click() }
try {
 if (process.argv.includes('--selection')) {
  const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1.5})
  await page.goto('http://localhost:5173');await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.characterRenderer==='skeletal')
  await page.getByRole('button',{name:'Open player picker'}).click()
  await page.screenshot({path:`${folder}/player-picker-after.png`,fullPage:true})
  await page.getByTestId('player-option-d4').click()
  await page.screenshot({path:`${folder}/player-card-after.png`,fullPage:true})
  await page.setViewportSize({width:390,height:844});await page.getByRole('button',{name:'Open player picker'}).click()
  await page.screenshot({path:`${folder}/player-picker-mobile-after.png`,fullPage:true})
  await page.close()
 } else if (process.argv.includes('--tour')) {
  for(const scenario of ['the-invisible-run','the-missed-chance']) {
   const context=await browser.newContext({viewport:{width:1440,height:1100},recordVideo:{dir:`${folder}/tour-video`,size:{width:1440,height:1100}}})
   const page=await context.newPage();page.on('pageerror',e=>errors.push(e.message));await page.goto('http://localhost:5173')
   await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.characterRenderer==='skeletal')
   await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption(scenario)
   await page.getByRole('button',{name:'Analyze this moment',exact:true}).click();await page.getByTestId('tactical-moment-title').waitFor()
   const bundle=await (await page.request.get(`http://127.0.0.1:8000/api/scenarios/${scenario}/evidence`)).json()
   for(const [category,id] of [['movement','run'],['corridor','pass'],['space','receive'],['relationships','pass'],['finish','finish']]) {
    const moment=bundle.moments.find(m=>m.id===id),fact=bundle.evidence.find(e=>moment.evidenceIds.includes(e.id)&&e.category===category)
    await page.getByRole('region',{name:'Tactical analysis'}).getByRole('button',{name:new RegExp(moment.title)}).click()
    const card=page.locator(`.insight-card[data-evidence-id="${fact.id}"]`)
    await card.locator('summary').click();await card.getByRole('button',{name:/Watch this/}).click()
    await page.waitForFunction(()=>document.querySelector('.guided-hud progress')?.value>.48)
    await page.getByRole('button',{name:'Back to analysis',exact:true}).click()
   }
   await page.getByRole('button',{name:'Return to replay',exact:true}).click()
   await page.getByRole('slider',{name:'Replay timeline'}).fill(timeString(eventTime(scenario,'receive')))
   await viewPlayerPov(page,scenario==='the-invisible-run'?'a9':'s9')
   const surface=page.getByRole('group',{name:/Paused player free-look/});await surface.scrollIntoViewIfNeeded();const b=await surface.boundingBox()
   await page.mouse.move(b.x+b.width*.5,b.y+b.height*.35);await page.mouse.down();await page.mouse.move(b.x+b.width*.72,b.y+b.height*.43,{steps:24});await page.mouse.up()
   await page.getByRole('button',{name:'Reset view',exact:true}).click()
   await page.getByRole('button',{name:'Follow player',exact:true}).click()
   await page.waitForFunction(end=>Number(document.querySelector('input[aria-label="Replay timeline"]').value)>end,eventTime(scenario,'receive')+.8)
   await page.getByRole('button',{name:'Pause replay',exact:true}).click()
   const video=page.video();await context.close();await video.saveAs(`${folder}/${scenario}-guided-pov-tour.webm`)
  }
 } else if (process.argv.includes('--performance')) {
  const report=[]
  for(const scenario of ['the-invisible-run','the-missed-chance']) {
   const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1.5})
   await page.goto('http://localhost:5173');await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.characterRenderer==='skeletal')
   await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption(scenario)
   await page.getByRole('button',{name:'Analyze this moment',exact:true}).click();await page.getByTestId('tactical-moment-title').waitFor()
   for(const mode of ['shot-broadcast','receiving-pov','movement','corridor','relationships','space','finish']) {
    const result=await page.evaluate(async({mode})=>{
     const entries=performance.getEntriesByType('resource'),fiber=await import(entries.find(e=>e.name.includes('@react-three_fiber.js')).name)
     const {replayStore}=await import(entries.find(e=>new URL(e.name).pathname==='/src/replay/store.ts').name)
     const {useTactics}=await import(entries.find(e=>new URL(e.name).pathname==='/src/tactics/store.ts').name)
     const state=fiber._roots.get(document.querySelector('canvas')).store.getState(),s=replayStore.getState()
     s.closeGuided();s.pause()
     if(mode==='shot-broadcast') {s.setCamera('broadcast');s.seek(s.scenario.events.find(e=>e.type==='shot').t-.2);s.play()}
     else if(mode==='receiving-pov') {const receive=s.scenario.events.find(e=>e.type==='receive');s.setCamera(`pov:${receive.playerIds[0]}`);s.seek(receive.t-.5);s.play()}
     else {
      const bundle=useTactics.getState().bundle,moment=bundle.moments.find(m=>m.id===(mode==='movement'?'reshape':mode==='finish'?'finish':mode==='space'?'receive':'pass'))
      const fact=bundle.evidence.find(e=>moment.evidenceIds.includes(e.id)&&e.category===mode)
      s.startGuided(bundle,fact.id,moment.id)
     }
     const warm=performance.now();while(performance.now()-warm<350)await new Promise(requestAnimationFrame)
     const start=performance.now(),intervals=[],calls=[],triangles=[];let previous=start
     while(performance.now()-start<3000) {
      const now=await new Promise(requestAnimationFrame);if(now>previous)intervals.push(now-previous);previous=now
      calls.push(state.gl.info.render.calls);triangles.push(state.gl.info.render.triangles)
     }
     intervals.shift();const sorted=[...intervals].sort((a,b)=>a-b),mean=xs=>xs.reduce((a,b)=>a+b,0)/xs.length
     const guide=replayStore.getState().guided;s.pause()
     return {fps:1000/mean(intervals),meanMs:mean(intervals),p95Ms:sorted[Math.floor(sorted.length*.95)],slowFrames:intervals.filter(t=>t>25).length,drawCalls:mean(calls),maxDrawCalls:Math.max(...calls),triangles:mean(triangles),memory:{...state.gl.info.memory},guide:guide?{evidenceId:guide.evidenceId,layer:guide.layer,status:guide.status}:null}
    },{mode})
    report.push({scenario,mode,...result})
   }
   await page.close()
  }
  await writeFile(`${folder}/interaction-performance.json`,JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report.map(({scenario,mode,fps,p95Ms,drawCalls})=>({scenario,mode,fps,p95Ms,drawCalls}))))
 } else if (process.argv.includes('--reaction-video')) {
  for(const scenario of ['the-invisible-run','the-missed-chance']) {
   const context=await browser.newContext({viewport:{width:1440,height:1100},recordVideo:{dir:`${folder}/reaction-video`,size:{width:1440,height:1100}}})
   const page=await context.newPage();await page.goto('http://localhost:5173')
   await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.characterRenderer==='skeletal')
   await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption(scenario)
   for(const actor of scenario==='the-invisible-run'?['d1','a9']:['c1','s9']) {
    const keeper=actor.endsWith('1'),start=keeper?eventTime(scenario,'shot')-1:eventTime(scenario,scenario==='the-invisible-run'?'goal':'miss')-.17,end=Math.min(sourceFor(scenario).duration-.1,start+(keeper?4.3:4.5))
    await selectPlayer(page,actor)
    await page.getByRole('slider',{name:'Replay timeline'}).fill(timeString(start))
    await page.evaluate(async actor=>{
     const entries=performance.getEntriesByType('resource'),fiber=await import(entries.find(e=>e.name.includes('@react-three_fiber.js')).name)
     const {replayStore}=await import(entries.find(e=>new URL(e.name).pathname==='/src/replay/store.ts').name)
     const {samplePosition}=await import(entries.find(e=>new URL(e.name).pathname==='/src/replay/sample.ts').name)
     const store=fiber._roots.get(document.querySelector('canvas')).store
     // Inspection-only live close-up, after the product camera callback. It
     // samples the same canonical clock and is removed before leaving this clip.
     window.__experienceCameraRelease=store.getState().internal.subscribe({current:({camera})=>{
      const s=replayStore.getState(),p=samplePosition(s.scenario.players.find(p=>p.id===actor).positions,s.readTime())
      camera.position.set(p[0]-3.8,2.5,p[2]+4.6);camera.up.set(0,1,0);camera.lookAt(p[0],.85,p[2]);camera.fov=35;camera.updateProjectionMatrix()
     }},-5,store)
    },actor)
    await page.locator('.world-player-label').evaluate(e=>{e.style.visibility='hidden'})
    await page.getByRole('button',{name:'Play replay',exact:true}).click()
    await page.waitForFunction(end=>Number(document.querySelector('input[aria-label="Replay timeline"]').value)>=end,end,{timeout:15000})
    await page.evaluate(async()=>{
     const entry=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/replay/store.ts'),{replayStore}=await import(entry.name)
     replayStore.getState().pause();window.__experienceCameraRelease();delete window.__experienceCameraRelease
    })
   }
   const video=page.video();await context.close();await video.saveAs(`${folder}/${scenario}-reactions.webm`)
  }
 } else if (process.argv.includes('--reactions')) {
  const page=await browser.newPage({viewport:{width:1440,height:1100},deviceScaleFactor:1.5})
  await page.goto('http://localhost:5173')
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.characterRenderer==='skeletal')
  for (const [scenario,actor,times] of [
   ['the-invisible-run','d1',[-.35,.18,.35,.55,.8,1.15,1.6,2.5,3].map(offset=>eventTime('the-invisible-run','shot')+offset)],
   ['the-invisible-run','a9',[0,.43,1.03,1.83,3.33,4.83].map(offset=>eventTime('the-invisible-run','goal')+offset)],
   ['the-missed-chance','c1',[14.65,15.18,15.4,15.7,16.1,17]],
   ['the-missed-chance','s9',[15.72,16.1,16.6,17.3,18.1]],
  ]) {
   await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption(scenario)
   await selectPlayer(page,actor)
   for(const time of times) {
    await page.getByRole('slider',{name:'Replay timeline'}).fill(timeString(time))
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    await page.evaluate(async actor=>{
     const entries=performance.getEntriesByType('resource')
     const fiber=await import(entries.find(e=>e.name.includes('@react-three_fiber.js')).name)
     const state=fiber._roots.get(document.querySelector('canvas')).store.getState(),p=state.scene.getObjectByName(`Player:${actor}`).position
     state.setFrameloop('never')
     state.camera.position.set(p.x-3.8,2.5,p.z+4.6);state.camera.up.set(0,1,0);state.camera.lookAt(p.x,.85,p.z)
     state.camera.fov=35;state.camera.updateProjectionMatrix();state.gl.render(state.scene,state.camera)
    },actor)
    await page.locator('.world-player-label').evaluate(e=>{e.style.visibility='hidden'})
    await page.locator('canvas').screenshot({path:`${folder}/${scenario}-${actor}-${time}-closeup.png`})
    await page.locator('.world-player-label').evaluate(e=>{e.style.visibility=''})
    await page.evaluate(async()=>{
     const entry=performance.getEntriesByType('resource').find(e=>e.name.includes('@react-three_fiber.js'))
     const fiber=await import(entry.name);fiber._roots.get(document.querySelector('canvas')).store.getState().setFrameloop('always')
    })
   }
  }
  await page.close()
 } else for (const scenario of ['the-invisible-run', 'the-missed-chance']) {
  const context = await browser.newContext({ viewport: { width: 1440, height: 1100 }, deviceScaleFactor: 1.5, recordVideo: { dir: `${folder}/video`, size: { width: 1440, height: 1100 } } })
  const page = await context.newPage()
  page.on('pageerror', e => errors.push(e.message))
  await page.goto('http://localhost:5173')
  await page.waitForFunction(() => document.querySelector('canvas')?.dataset.characterRenderer === 'skeletal')
  await page.getByRole('combobox', { name: 'Scenario', exact: true }).selectOption(scenario)
  await page.screenshot({ path: `${folder}/${scenario}-studio.png`, fullPage: true })
  await page.getByRole('button', { name: 'Play replay', exact: true }).click()
  await page.waitForFunction(end => Number(document.querySelector('input[aria-label="Replay timeline"]').value) >= end, sourceFor(scenario).duration-.2, { timeout: 26000 })
  await page.getByRole('button', { name: 'Pause replay', exact: true }).click()
  const timeline = page.getByRole('slider', { name: 'Replay timeline' })
  for (const time of [...sourceFor(scenario).events.map(event=>event.t),eventTime(scenario,'shot')+.25,eventTime(scenario,'shot')+.55,sourceFor(scenario).duration-.2]) {
   await timeline.fill(timeString(time))
   await page.evaluate(() => new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve))))
   await page.getByTestId('replay-viewport').screenshot({ path: `${folder}/${scenario}-${time}.png` })
  }
  for (const camera of ['Tactical', 'Full pitch']) {
   await page.getByRole('button', { name: camera, exact: true }).click()
   await timeline.fill(timeString(eventTime(scenario,'shift')))
   await page.getByTestId('replay-viewport').screenshot({ path: `${folder}/${scenario}-${camera.replace(' ', '-')}.png` })
  }
  await viewPlayerPov(page,scenario === 'the-invisible-run' ? 'a9' : 's9')
  await timeline.fill(timeString(eventTime(scenario,'receive')))
  await page.getByTestId('replay-viewport').screenshot({ path: `${folder}/${scenario}-pov.png` })
  await page.getByRole('button', { name: 'Broadcast', exact: true }).click()
  await page.getByRole('button', { name: 'Analyze this moment', exact: true }).click()
  await page.getByTestId('tactical-moment-title').waitFor()
  await page.locator('.tactical-panel').scrollIntoViewIfNeeded()
  await page.locator('.evidence-item summary').first().click()
  await page.screenshot({ path: `${folder}/${scenario}-evidence.png`, fullPage: true })
  if (label === 'before') {
   await page.locator('.evidence-item button').first().click()
   await page.screenshot({ path: `${folder}/${scenario}-reveal.png`, fullPage: true })
  }
  await page.setViewportSize({ width: 390, height: 844 })
  await page.screenshot({ path: `${folder}/${scenario}-mobile.png`, fullPage: true })
  await context.close()
 }
 await writeFile(`${folder}/errors.json`, JSON.stringify(errors, null, 2))
} finally { await browser.close() }
