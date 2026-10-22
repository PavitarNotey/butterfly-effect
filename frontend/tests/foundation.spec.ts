import { expect, test } from '@playwright/test'

test('studio connects to the real backend across origins', async ({ page }) => {
  const errors: string[] = []
  page.on('pageerror', error => errors.push(error.message))
  const healthResponse = page.waitForResponse('http://127.0.0.1:8000/health')
  await page.goto('/')
  const response = await healthResponse
  expect(response.status()).toBe(200)
  expect(await response.json()).toEqual({ status: 'ok', project: 'butterfly-effect' })
  expect(response.headers()['access-control-allow-origin']).toBe('http://localhost:5173')
  await expect(page.getByRole('status')).toHaveText('API connected')
  await expect(page.getByRole('heading', { name: 'The Invisible Run.' })).toBeVisible()
  await page.getByRole('button', { name: 'Recheck API connection' }).click()
  await expect(page.getByRole('status')).toHaveText('API connected')
  expect(errors).toEqual([])
})

test('connection failure can be retried', async ({ page }) => {
  await page.route('**/health', route => route.abort())
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('API offline')
  await page.unroute('**/health')
  await page.getByRole('button', { name: 'Recheck API connection' }).click()
  await expect(page.getByRole('status')).toHaveText('API connected')
})

test('mobile shell stays within viewport', async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/')
  await expect(page.getByRole('status')).toHaveText('API connected')
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(true)
})
