import { expect, test } from '@playwright/test'
import type { EvidenceBundle } from '../src/tactics/types'

for (const scenario of ['the-invisible-run','the-missed-chance','the-untouched-pass']) {
  test(`${scenario} has four complete watchable sequences in every analysis selector`, async ({page}) => {
    test.setTimeout(60000)
    const errors: string[] = []
    page.on('pageerror', e => errors.push(e.message))
    await page.setViewportSize({width:1440,height:1100})
    await page.goto('/studio')
    await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption(scenario)
    const choices = page.getByRole('combobox',{name:'Moment to explain'})
    await expect(choices).toBeEnabled()
    await expect(choices.locator('option:not([value=""])')).toHaveCount(4)
    await expect(page.locator('.timeline-markers button')).toHaveCount(4)
    const sequences = page.getByRole('region',{name:'Attacking sequences'})
    await expect(sequences.getByRole('button')).toHaveCount(4)
    const bundle: EvidenceBundle = await (await page.request.get(`http://127.0.0.1:8000/api/scenarios/${scenario}/evidence`)).json()
    expect(bundle.moments).toHaveLength(4)
    for (const moment of bundle.moments) {
      await sequences.getByRole('button',{name:`Watch ${moment.title}`,exact:true}).click()
      const hud = page.getByTestId('guided-replay')
      await expect(hud).toHaveAttribute('data-kind','moment')
      await expect(hud).toHaveAttribute('data-moment-id',moment.id)
      await expect(hud).toHaveAttribute('data-evidence-id',moment.primaryEvidenceId)
      if (moment.followPlayerId) await expect(page.getByTestId('replay-viewport')).toHaveAttribute('data-camera',`follow:${moment.followPlayerId}`)
      const bounds = await page.evaluate(async () => {
        const entry=performance.getEntriesByType('resource').find(e=>new URL(e.name).pathname==='/src/replay/store.ts')!
        const {replayStore}=await import(entry.name)
        return replayStore.getState().guided
      })
      expect(bounds).toMatchObject({startTime:moment.start,focusTime:moment.focusTime,endTime:moment.end})
      await expect(hud).toHaveAttribute('data-status','complete',{timeout:20000})
      await expect(page.getByRole('slider',{name:'Replay timeline'})).toHaveValue(String(moment.end))
      await expect(page.getByTestId('tactical-moment-title')).toHaveText(moment.title)
      if (scenario==='the-untouched-pass') await page.getByTestId('replay-viewport').screenshot({path:`../output/sequences/${moment.id}-complete.png`})
      await hud.getByRole('button',{name:'Back to analysis',exact:true}).click()
    }
    expect(errors).toEqual([])
  })
}

test('Merrick remains on his canonical run with the complete route, following camera and continuous progress', async ({page}) => {
  await page.setViewportSize({width:1440,height:1100})
  await page.goto('/studio')
  await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption('the-untouched-pass')
  const button = page.getByRole('button',{name:'Watch The Run Begins',exact:true})
  await expect(button).toBeVisible()
  const record = await page.evaluate(async () => {
    const entries=performance.getEntriesByType('resource')
    const {replayStore}=await import(entries.find(e=>new URL(e.name).pathname==='/src/replay/store.ts')!.name)
    const {samplePosition}=await import(entries.find(e=>new URL(e.name).pathname==='/src/replay/sample.ts')!.name)
    const fiber=await import(entries.find(e=>e.name.includes('@react-three_fiber.js'))!.name)
    const world=fiber._roots.get(document.querySelector('canvas')).store.getState()
    const frames: {t:number;error:number;camera:string;fullCount:number;progress:number;first:number;visible:boolean}[]=[]
    let last=-1
    document.querySelector<HTMLButtonElement>('button[aria-label="Watch The Run Begins"]')!.click()
    while (replayStore.getState().guided?.status!=='complete') {
      await new Promise(requestAnimationFrame)
      const replay=replayStore.getState(),t=replay.readTime()
      if(t-last<.25)continue
      last=t
      const player=replay.scenario.players.find((p:{id:string})=>p.id==='v10')
      const actual=world.scene.getObjectByName('Player:v10').position.toArray(), expected=samplePosition(player.positions,t)
      const route=world.scene.getObjectByName('RecordedRoute:v10'),progress=world.scene.getObjectByName('MovementProgress:v10')
      frames.push({t,error:Math.hypot(...actual.map((n:number,i:number)=>n-expected[i])),camera:replay.camera,fullCount:route.geometry.drawRange.count,progress:progress.geometry.drawRange.count,first:route.geometry.getAttribute('position').getX(0),visible:route.visible})
    }
    const route=replayStore.getState().guided
    const path=replayStore.getState().scenario.players.find((p:{id:string})=>p.id==='v10').positions.filter((k:{t:number})=>k.t<=7.2)
    return {frames,guide:route,expectedKeys:path.length,finalTime:replayStore.getState().readTime()}
  })
  expect(record.frames.length).toBeGreaterThan(15)
  expect(record.frames[0].t).toBeLessThan(.5)
  expect(record.frames.at(-1)!.t).toBeGreaterThan(6.5)
  expect(record.finalTime).toBe(7.2)
  for(const frame of record.frames) {
    expect(frame.error).toBeLessThan(.3)
    expect(frame.camera).toBe('follow:v10')
    expect(frame.fullCount).toBe(record.expectedKeys)
    expect(frame.first).toBe(22)
    expect(frame.visible).toBe(true)
  }
  expect(record.frames.at(-1)!.progress).toBeGreaterThan(record.frames[0].progress)
  await page.getByRole('button',{name:'Tactical',exact:true}).click()
  await expect(page.getByTestId('guided-replay')).toHaveCount(0)
  await expect(page.getByRole('slider',{name:'Replay timeline'})).toHaveValue('7.2')
})

test('four curated sequences keep their exact event and evidence associations in Casual and Analyst', async ({page,request}) => {
  test.setTimeout(60000)
  expect((await (await request.get('http://127.0.0.1:8001/api/ai/status')).json()).provider).toBe('mock')
  await page.route('**/api/ai/**', async route => {
    const url=new URL(route.request().url())
    if (route.request().postDataJSON()?.cache_only || url.searchParams.get('cache_only')==='true') { await route.fulfill({status:409,json:{detail:'No saved analysis.'}}); return }
    const response=await route.fetch({url:`http://127.0.0.1:8001${url.pathname}${url.search}`})
    await route.fulfill({response})
  })
  await page.goto('/studio')
  await page.getByRole('combobox',{name:'Scenario',exact:true}).selectOption('the-untouched-pass')
  const ai=page.getByRole('region',{name:'AI moment intelligence'})
  await expect(ai.getByRole('combobox',{name:'Moment to explain'})).toBeEnabled()
  const bundle: EvidenceBundle=await (await request.get('http://127.0.0.1:8001/api/scenarios/the-untouched-pass/evidence')).json()
  for(const mode of ['casual','analyst']) {
    await ai.getByRole('button',{name:mode==='casual'?'Casual Fan':'Analyst',exact:true}).click()
    for(const moment of bundle.moments) {
      await ai.getByRole('combobox',{name:'Moment to explain'}).selectOption(moment.id)
      const response=page.waitForResponse(r=>r.url().endsWith('/api/ai/moments/explain') && !r.request().postDataJSON()?.cache_only)
      await ai.getByRole('button',{name:'Explain this moment',exact:true}).click()
      const data=await (await response).json()
      expect(data.provider).toBe('mock');expect(data.mode).toBe(mode)
      expect(data.narratives[0].event_id).toBe(moment.focusEventId)
      expect(data.narratives[0].source_ids).toContain(moment.primaryEvidenceId)
      await expect(ai.locator('.ai-context')).toHaveText(moment.title)
      await expect(ai.locator('.ai-evidence')).not.toHaveAttribute('open')
    }
  }
})
