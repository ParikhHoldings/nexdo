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

  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
  await expect(page.getByText('Top Priorities')).toBeVisible()

  await page
    .getByPlaceholder('What needs to get done? Be specific...')
    .fill('Research competitor pricing with Sarah today high priority 45 minutes')
  await page.keyboard.press('Enter')

  await expect(
    page.getByRole('heading', { name: /Research competitor pricing/ }).first()
  ).toBeVisible()
  await expect(page.getByText(/6 active tasks/)).toBeVisible()
  await expect(page.getByText('Why now:').first()).toBeVisible()

  await page.getByRole('heading', { name: 'Send weekly update to team' }).click()
  await expect(page.getByRole('heading', { name: 'AI Agent' })).toBeVisible()

  await page.getByRole('button', { name: 'Edit task' }).click()
  await page.getByLabel('Task title').fill('Send weekly update to product team')
  await page.getByLabel('Task estimate').fill('20')
  await page.getByRole('button', { name: /Save/ }).click()
  await expect(
    page.locator('h2', { hasText: 'Send weekly update to product team' })
  ).toBeVisible()

  await page.getByRole('button', { name: /Run draft/i }).click()
  await expect(page.getByText('Completed')).toBeVisible()
  await expect(page.getByRole('heading', { name: 'Draft' })).toBeVisible()
  await page.screenshot({ path: '/tmp/nexdo-smoke-desktop.png', fullPage: false })

  await page.setViewportSize({ width: 390, height: 844 })
  await page.goto('/today')
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
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

  const execute = await request.post('/api/agent/execute', {
    data: { taskId: 'not-a-real-task' },
  })
  expect([401, 503]).toContain(execute.status())

  const csvImport = await request.post('/api/import/csv', {
    data: { content: 'title\nImported smoke task' },
  })
  expect([401, 503]).toContain(csvImport.status())

  const jsonImport = await request.post('/api/import/json', {
    data: { content: '[{"title":"Imported smoke task"}]' },
  })
  expect([401, 503]).toContain(jsonImport.status())

  const icsImport = await request.post('/api/import/ics', {
    data: { content: 'BEGIN:VCALENDAR\nEND:VCALENDAR' },
  })
  expect([401, 503]).toContain(icsImport.status())

  const apiKey = await request.post('/api/profile/api-key', {
    data: { scopes: ['tasks:read'] },
  })
  expect([401, 503]).toContain(apiKey.status())

  const profile = await request.patch('/api/profile', {
    data: { full_name: 'Smoke User', timezone: 'Not/AZone', work_type: 'owner' },
  })
  expect([401, 503]).toContain(profile.status())
})

test('demo file import adds tasks without configured auth', async ({ page }) => {
  await page.goto('/import')

  await page.locator('input[accept=".csv"]').last().setInputFiles({
    name: 'nexdo-demo-import.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from(
      'title,priority,context\nImported demo smoke task,high,Imported through the demo CSV flow\n'
    ),
  })

  await expect(page.getByText('1 task imported successfully')).toBeVisible()

  await page.getByRole('link', { name: 'All Tasks' }).click()
  await expect(
    page.getByRole('heading', { name: 'Imported demo smoke task' })
  ).toBeVisible()
})

test('demo settings does not allow free-plan API key generation', async ({ page }) => {
  await page.goto('/settings')
  await page.getByRole('button', { name: 'API' }).click()

  await expect(
    page.getByText('API access requires a Power plan or higher.')
  ).toBeVisible()
  await expect(page.getByRole('button', { name: /Regenerate/ })).toBeDisabled()
})

test('settings tab query opens billing tab', async ({ page }) => {
  await page.goto('/settings?tab=billing')

  await expect(page.getByRole('heading', { name: 'Current Plan' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Billing' })).toHaveClass(/bg-accent/)
  await expect(page.getByRole('button', { name: 'Notifications' })).toHaveCount(0)
  await expect(page.getByRole('button', { name: /Light mode|Dark mode/ })).toHaveCount(0)
})

test('login exposes demo mode when auth env is not configured', async ({ page }) => {
  await page.goto('/auth/login')

  await expect(page.getByRole('button', { name: /Try demo mode/ })).toBeVisible()
})

test('connect ai page reflects the paid API access gate', async ({ page }) => {
  await page.goto('/settings/mcp')

  await expect(page.getByRole('heading', { name: 'Connect AI Tools' })).toBeVisible()
  await expect(
    page.getByText('API access requires a Power plan or higher.')
  ).toBeVisible()
  await expect(page.getByRole('link', { name: 'Open billing' })).toHaveAttribute(
    'href',
    '/settings?tab=billing'
  )
})

test('demo tasks persist across reloads', async ({ page }) => {
  await page.goto('/today')
  await page
    .getByPlaceholder('What needs to get done? Be specific...')
    .fill('Draft demo persistence note today')
  await page.keyboard.press('Enter')

  await expect(page.getByRole('heading', { name: /Draft demo persistence note/ })).toBeVisible()

  await page.reload()
  await expect(page.getByRole('heading', { name: /Draft demo persistence note/ })).toBeVisible()

  await page
    .getByPlaceholder('What needs to get done? Be specific...')
    .fill('Create second persisted demo task')
  await page.keyboard.press('Enter')

  await expect(
    page.getByRole('heading', { name: /Create second persisted demo task/ })
  ).toBeVisible()

  const persistedIds = await page.evaluate(() => {
    const raw = window.localStorage.getItem('nexdo_demo_tasks')
    const tasks = raw ? JSON.parse(raw) : []
    return tasks.map((task: { id: string }) => task.id)
  })
  expect(new Set(persistedIds).size).toBe(persistedIds.length)
})
