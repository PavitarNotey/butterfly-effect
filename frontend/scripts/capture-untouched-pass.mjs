/* global process */
import { chromium } from '@playwright/test'
import { mkdir, writeFile } from 'node:fs/promises'

// Real advancing-clock recordings; inspection stills never substitute for video.
const directory='../output/phase3d'
await mkdir(directory,{recursive:true})
const browser=await chromium.launch({channel:'chrome',headless:true})
const report={browser:browser.version(),viewport:{width:1440,height:1100},recordings:[],screenshots:[],errors:[]}
async function ready(page) {
  page.on('pageerror',e=>report.errors.push(e.message))
  page.on('console',m=>{if(m.type()==='error'&&/THREE|WebGL|shader/.test(m.text()))report.errors.push(m.text())})
  await page.goto('http://localhost:5173/studio')
  await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption('the-untouched-pass')
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.characterRenderer==='skeletal')
}
async function select(page,id,pov=false) {
  await page.getByRole('button',{name:'Open player picker'}).click()
  await page.getByTestId(`player-option-${id}`).click()
  if(pov)await page.getByRole('button',{name:/^View .+ POV$/}).click()
}
try {
  for(const mode of ['broadcast','tactical','follow']) {
    const context=await browser.newContext({viewport:report.viewport,recordVideo:{dir:`${directory}/raw-video`,size:report.viewport}})
    const page=await context.newPage();await ready(page)
    if(mode==='tactical')await page.getByRole('button',{name:'Tactical',exact:true}).click()
    if(mode==='follow') {
      await select(page,'v10')
      await page.getByRole('button',{name:'Follow Player',exact:true}).click()
    }
    await page.getByTestId('replay-viewport').scrollIntoViewIfNeeded()
    await page.getByRole('button',{name:'Play replay',exact:true}).click()
    const measurement=await page.evaluate(async()=>{
      const entries=performance.getEntriesByType('resource')
      const {replayStore}=await import(entries.find(e=>new URL(e.name).pathname==='/src/replay/store.ts').name)
      const start={wall:performance.now(),time:replayStore.getState().readTime()}
      while(replayStore.getState().playing)await new Promise(requestAnimationFrame)
      return {start,end:{wall:performance.now(),time:replayStore.getState().readTime()},speed:replayStore.getState().speed}
    })
    const path=`${directory}/${mode}-continuous-1x.webm`,video=page.video()
    await context.close();await video.saveAs(path)
    report.recordings.push({path,...measurement})
  }
  const context=await browser.newContext({viewport:report.viewport,deviceScaleFactor:1.5})
  const page=await context.newPage();await ready(page)
  for(const t of [0,3.2,5.6,6.5,6.65,6.8,7.2,7.42,8.02,12]) {
    await page.getByRole('slider',{name:'Replay timeline'}).fill(String(t))
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    const path=`${directory}/broadcast-${t}.png`
    await page.locator('canvas').screenshot({path});report.screenshots.push(path)
  }
  for(const id of ['v9','v10','t5']) {
    await select(page,id,true)
    await page.getByRole('slider',{name:'Replay timeline'}).fill('6.65')
    await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.cameraSettled==='true')
    const path=`${directory}/pov-${id}.png`
    await page.locator('canvas').screenshot({path});report.screenshots.push(path)
  }
  await page.getByRole('button',{name:'Broadcast',exact:true}).click()
  await page.getByRole('button',{name:'Analyze this moment'}).click()
  await page.getByTestId('tactical-moment-title').waitFor()
  await page.getByRole('button',{name:'Analytical moment',exact:true}).click()
  await page.getByRole('dialog',{name:'Choose analytical moment'}).locator('[data-moment-id="dummy"]').click()
  await page.getByRole('button',{name:'Show me in the replay',exact:true}).click()
  await page.waitForFunction(()=>Number(document.querySelector('input[aria-label="Replay timeline"]').value)>=6.64)
  await page.getByRole('button',{name:'Pause guided replay'}).click()
  await page.waitForFunction(()=>document.querySelector('canvas')?.dataset.cameraSettled==='true')
  const path=`${directory}/guided-dummy.png`
  await page.getByTestId('replay-viewport').screenshot({path});report.screenshots.push(path)
  // Inspect the actual mounted mesh from a lower, closer incoming view. This
  // is a test-only camera inspection; product guided framing is captured above.
  for(const t of [6.5,6.6,6.65,6.7,6.8]) {
    await page.getByRole('slider',{name:'Replay timeline'}).fill(String(t))
    await page.evaluate(()=>new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(resolve))))
    await page.evaluate(async()=>{
      const entries=performance.getEntriesByType('resource'),fiber=await import(entries.find(e=>e.name.includes('@react-three_fiber.js')).name)
      const state=fiber._roots.get(document.querySelector('canvas')).store.getState(),p=state.scene.getObjectByName('Player:v9').position
      state.setFrameloop('never');state.camera.position.set(p.x-1.3,1.4,p.z-4.2)
      state.camera.up.set(0,1,0);state.camera.lookAt(p.x+.3,.65,p.z+.5);state.camera.fov=42;state.camera.updateProjectionMatrix();state.gl.render(state.scene,state.camera)
    })
    const imagePath=`${directory}/dummy-close-${t}.png`
    await page.locator('.world-player-label').evaluateAll(elements=>elements.forEach(el=>{el.style.visibility='hidden'}))
    await page.locator('canvas').screenshot({path:imagePath});report.screenshots.push(imagePath)
    await page.evaluate(async()=>{
      const entries=performance.getEntriesByType('resource'),fiber=await import(entries.find(e=>e.name.includes('@react-three_fiber.js')).name)
      fiber._roots.get(document.querySelector('canvas')).store.getState().setFrameloop('always')
    })
  }
  await context.close()
  // A continuous real guided replay, at its visibly declared 0.5× speed.
  const guidedContext=await browser.newContext({viewport:report.viewport,recordVideo:{dir:`${directory}/raw-video`,size:report.viewport}})
  const guidedPage=await guidedContext.newPage();await ready(guidedPage)
  await guidedPage.getByRole('button',{name:'Analyze this moment'}).click();await guidedPage.getByTestId('tactical-moment-title').waitFor()
  await guidedPage.getByRole('button',{name:'Analytical moment',exact:true}).click()
  await guidedPage.getByRole('dialog',{name:'Choose analytical moment'}).locator('[data-moment-id="dummy"]').click()
  await guidedPage.getByRole('button',{name:'Show me in the replay',exact:true}).click()
  await guidedPage.waitForFunction(()=>document.querySelector('[data-testid="guided-replay"]')?.dataset.status==='complete')
  const video=guidedPage.video(),videoPath=`${directory}/guided-dummy-half-speed.webm`
  await guidedContext.close();await video.saveAs(videoPath);report.recordings.push({path:videoPath,speed:.5})
} finally {
  await browser.close()
  await writeFile(`${directory}/visual-review.json`,JSON.stringify(report,null,2)+'\n')
  console.log(JSON.stringify(report))
}
if(report.errors.length)process.exitCode=1
