import type { Page } from '@playwright/test'

export async function chooseMoment(page: Page, id: string) {
  await page.getByRole('button', { name: 'Analytical moment', exact: true }).click()
  await page.getByRole('dialog', { name: 'Choose analytical moment' }).locator(`[data-moment-id="${id}"]`).click()
}
