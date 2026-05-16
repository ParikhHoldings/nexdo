import { expect, test } from '@playwright/test'

test('demo task capture, briefing, prioritization, and agent output work', async ({
  page,
}) => {
  const consoleMessages: string[] = []
  page.on('console', (message) => {
    if (['error', 'warning'].includes(message.type())) {
      consoleMessages.push(`${message.type()}: ${message.text()}`)
    }
  })
  page.on('pageerror', (error) => {
    consoleMessages.push(`pageerror: ${error.message}`)
  })

  await page.goto('/today')

  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByText('Top Priorities')).toBeVisible()

  await page
    .getByPlaceholder('What needs to get done? Be specific...')
    .fill('Research competitor pricing with Sarah today high priority 45 minutes')
  await page.keyboard.press('Enter')

  await expect(
    page.getByText('Research competitor pricing with Sarah today high priority 45 minutes')
  ).toBeVisible()
  await expect(page.getByText('Why now:').first()).toBeVisible()

  await page.getByRole('heading', { name: 'Send weekly update to team' }).click()
  await expect(page.getByRole('heading', { name: 'AI Agent' })).toBeVisible()

  await page.getByRole('button', { name: /Run draft/i }).click()
  await expect(page.getByText('Completed')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Draft' })).toBeVisible()
  await page.screenshot({ path: '/tmp/nexdo-smoke-desktop.png', fullPage: false })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/today')
  await expect(page.getByRole('heading', { name: 'Today' })).toBeVisible()
  await expect(page.getByPlaceholder('What needs to get done? Be specific...')).toBeVisible()
  await expect(page.getByRole('button', { name: 'Open navigation' })).toBeVisible()
  await page.screenshot({ path: '/tmp/nexdo-smoke-mobile.png', fullPage: false })

  const unexpectedMessages = consoleMessages.filter(
    (message) =>
      !message.includes('Failed to load resource: the server responded with a status of 401')
  )
  expect(unexpectedMessages).toEqual([])
})

test('task mutation endpoints require configured auth', async ({ request }) => {
  const patch = await request.patch('/api/tasks/not-a-real-task', {
    data: { title: 'Should not update', user_id: 'someone-else' },
  })
  expect([401, 503]).toContain(patch.status())

  const del = await request.delete('/api/tasks/not-a-real-task')
  expect([401, 503]).toContain(del.status())
})
