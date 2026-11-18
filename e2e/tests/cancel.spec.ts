import { expect, test, type Page } from '@playwright/test'

const meetingTypeId = 'e2e-cancel'
const meetingTypeName = 'E2E cancel call'
const guestName = 'Грейс Хоппер'
const guestEmail = 'grace@example.com'

const enabledDays = (page: Page) => page.locator('.mantine-DatePicker-day:not([data-disabled])')
const slotButtons = (page: Page) => page.getByRole('button', { name: /^\d{2}:\d{2}$/ })

test('owner cancels a booking and the slot is free again', async ({ page }) => {
  await page.goto('/meeting-types')
  await page.getByLabel('Идентификатор').fill(meetingTypeId)
  await page.getByLabel('Название').fill(meetingTypeName)
  await page.getByRole('button', { name: 'Создать' }).click()
  await expect(page.getByRole('cell', { name: meetingTypeId, exact: true })).toBeVisible()

  await page.goto(`/book/${meetingTypeId}`)
  const day = enabledDays(page).first()
  const dayLabel = await day.getAttribute('aria-label')
  await day.click()
  const slot = slotButtons(page).first()
  const slotTime = await slot.innerText()
  await slot.click()
  await page.getByRole('button', { name: 'Далее' }).click()
  await page.getByLabel('Имя').fill(guestName)
  await page.getByLabel('Email').fill(guestEmail)
  await page.getByRole('button', { name: 'Записаться' }).click()
  await expect(page.getByRole('heading', { name: 'Вы записаны' })).toBeVisible()

  await page.goto('/meetings')
  const row = page.getByRole('listitem').filter({ hasText: `${meetingTypeName} · ${guestName}` })
  await row.getByRole('button', { name: /Отменить/ }).click()
  await page
    .getByRole('dialog', { name: 'Отменить встречу?' })
    .getByRole('button', { name: 'Да, отменить' })
    .click()
  await expect(row).toHaveCount(0)

  await page.goto(`/book/${meetingTypeId}`)
  await page.getByRole('button', { name: dayLabel!, exact: true }).click()
  await expect(slotButtons(page).filter({ hasText: slotTime })).toHaveCount(1)
})
