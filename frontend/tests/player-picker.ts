import type { Page } from '@playwright/test'

export async function selectPlayer(page: Page, id: string) {
  await page.getByRole('button', { name: 'Open player picker' }).click()
  await page.getByTestId(`player-option-${id}`).click()
}

export async function viewPlayerPov(page: Page, id: string) {
  await selectPlayer(page, id)
  await page.getByRole('button', { name: /^View .+ POV$/ }).click()
}
