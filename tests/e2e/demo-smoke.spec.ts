import { expect, test } from '@playwright/test'
import { readFileSync } from 'node:fs'

test('landing page routes the primary CTA to the working demo path', async ({
  page,
}) => {
  await page.goto('/')

  await expect(page).toHaveTitle('Nexdo - Early-Access Task Workspace')
  await expect(
    page.getByRole('heading', { name: /Move tasks from capture to/i })
  ).toBeVisible()
  await expect(page.getByText('bounded AI assistance')).toBeVisible()
  await expect(page.getByText('front-door launch claim')).toHaveCount(0)

  const demoLink = page.getByRole('link', { name: 'Try the demo' }).first()
  await expect(demoLink).toHaveAttribute('href', '/today')

  const pricingSection = page.locator('#pricing')
  await expect(
    pricingSection.getByRole('link', { name: 'Try demo' })
  ).toHaveAttribute('href', '/today')
  await expect(
    pricingSection.getByRole('link', { name: 'Create account' })
  ).toHaveCount(2)
  await expect(
    pricingSection.getByRole('link', { name: 'Create account' }).first()
  ).toHaveAttribute('href', '/auth/signup')
  await expect(
    pricingSection.getByRole('link', { name: 'Create account' }).nth(1)
  ).toHaveAttribute('href', '/auth/signup')
  await expect(
    pricingSection.getByRole('link', { name: 'Contact Sales' })
  ).toHaveAttribute('href', 'mailto:sales@nexdo.ai?subject=Team Plan Inquiry')
  await expect(pricingSection.getByText('Team collaboration')).toHaveCount(0)
  await expect(pricingSection.getByText('Admin controls')).toHaveCount(0)
  await expect(pricingSection.getByText('SSO')).toHaveCount(0)
  await expect(pricingSection.getByText('Custom integrations')).toHaveCount(0)

  await Promise.all([page.waitForURL('**/today'), demoLink.click()])
  await expect(
    page.getByRole('heading', { name: 'Today', exact: true })
  ).toBeVisible({ timeout: 10000 })
})

test('public metadata and prompts stay below autonomous claims', () => {
  const layoutSource = readFileSync('app/layout.tsx', 'utf8')
  const promptSource = readFileSync('lib/prompts.ts', 'utf8')
  const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8'))
  const privacySource = readFileSync('app/(marketing)/privacy/page.tsx', 'utf8')
  const termsSource = readFileSync('app/(marketing)/terms/page.tsx', 'utf8')

  expect(layoutSource).toContain('Nexdo - Early-Access Task Workspace')
  expect(layoutSource).toContain('review bounded AI assistance')
  expect(layoutSource).not.toContain('The AI-Native Task Manager')
  expect(layoutSource).not.toContain("'automation'")
  expect(manifest.description).toBe(
    'Early-access task workspace for humans and AI agents'
  )
  expect(manifest.description).not.toContain('AI-native')

  expect(promptSource).toContain(
    'Generate bounded, reviewable outputs for research, drafting, and preparation tasks'
  )
  expect(promptSource).toContain(
    'When a task needs external side effects or judgment'
  )
  expect(promptSource).not.toContain('tasks that can be automated')
  expect(promptSource).not.toContain("complete a task automatically")

  expect(privacySource).toContain('provide requested bounded AI assistance')
  expect(privacySource).toContain('provider-backed safeguards')
  expect(privacySource).not.toContain('run requested AI actions')
  expect(privacySource).not.toContain('trusted vendors')
  expect(privacySource).not.toContain('industry-standard safeguards')

  expect(termsSource).toContain('If you start a paid plan')
  expect(termsSource).not.toContain('Paid plans renew automatically')
})

test('public robots sitemap points to an existing public sitemap', async ({ request }) => {
  const robots = await request.get('/robots.txt')
  expect(robots.ok()).toBeTruthy()
  const robotsText = await robots.text()
  expect(robotsText).toContain('Sitemap: https://nexdo.ai/sitemap.xml')

  const sitemap = await request.get('/sitemap.xml')
  expect(sitemap.ok()).toBeTruthy()
  expect(sitemap.headers()['content-type']).toContain('application/xml')
  const sitemapText = await sitemap.text()
  expect(sitemapText).toContain('<loc>https://nexdo.ai/</loc>')
  expect(sitemapText).toContain('<loc>https://nexdo.ai/privacy</loc>')
  expect(sitemapText).toContain('<loc>https://nexdo.ai/terms</loc>')
  expect(sitemapText).not.toContain('/settings')
  expect(sitemapText).not.toContain('/api/')
})

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
  await expect(page.getByText('Verification notes')).toBeVisible()
  await page.getByRole('button', { name: 'Verified' }).click()
  await page.getByLabel('Agent review note').fill('Checked tone and next step.')
  await page.getByRole('button', { name: 'Save review' }).click()
  await expect(page.getByText('Review saved.')).toBeVisible()
  await expect(page.getByText('Execution history')).toBeVisible()
  await expect(page.getByText('1 run')).toBeVisible()
  await page.getByRole('button', { name: 'Run again' }).click()
  await expect(page.getByText('2 runs')).toBeVisible()
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

test('agent-created tasks expose trace metadata in task surfaces', async ({ page }) => {
  const now = new Date().toISOString()
  const agentTask = {
    id: 'agent-demo-task',
    user_id: 'demo-user',
    title: 'Review agent-created onboarding brief',
    raw_input: 'Review agent-created onboarding brief',
    description: null,
    status: 'todo',
    priority: 'high',
    due_date: null,
    due_time: null,
    context: 'Created by an external planning agent for human review',
    source: 'agent',
    action_type: 'manual',
    estimated_minutes: 20,
    energy_level: 'light',
    people: ['Ops'],
    tags: ['agent-review'],
    parent_task_id: null,
    related_task_ids: null,
    agent_output: null,
    completed_at: null,
    created_at: now,
    updated_at: now,
    source_agent_id: 'agent-alpha',
    external_ref: 'brief-42',
    ingestion_intent: 'create',
    agent_metadata: { channel: 'mcp', confidence: 'high' },
  }

  await page.addInitScript((task: unknown) => {
    window.localStorage.setItem('nexdo_demo_tasks', JSON.stringify([task]))
  }, agentTask)

  await page.goto('/today')

  await expect(
    page.getByRole('heading', { name: 'Review agent-created onboarding brief' })
  ).toBeVisible()
  await expect(page.getByText('agent-alpha').first()).toBeVisible()

  await page
    .getByRole('heading', { name: 'Review agent-created onboarding brief' })
    .click()

  const trace = page.getByLabel('Agent trace')
  await expect(trace).toBeVisible()
  await expect(trace.getByText('Source agent')).toBeVisible()
  await expect(trace.getByText('agent-alpha')).toBeVisible()
  await expect(trace.getByText('External ref')).toBeVisible()
  await expect(trace.getByText('brief-42')).toBeVisible()
  await expect(trace.getByText('Intent')).toBeVisible()
  await expect(trace.getByText('Create')).toBeVisible()
  await expect(trace.getByText('Metadata keys')).toBeVisible()
  await expect(trace.getByText('channel, confidence')).toBeVisible()
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

  const review = await request.patch('/api/tasks/not-a-real-task/agent-review', {
    data: { status: 'verified', note: 'Checked by smoke test' },
  })
  expect([401, 503]).toContain(review.status())

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

test('profile update route returns not found when no profile row is updated', () => {
  const source = readFileSync('app/api/profile/route.ts', 'utf8')

  expect(source).toContain('.maybeSingle()')
  expect(source).toContain("{ error: 'Profile not found' }")
})

test('authenticated app boot keeps user and task auth state aligned on profile misses', () => {
  const source = readFileSync('app/(app)/layout.tsx', 'utf8')

  expect(source).toContain('createClientProfileFallback(user, timezone)')
  expect(source).toContain('setUserAuthenticated(true)')
  expect(source).toContain('setTasksAuthenticated(true)')
  expect(source).toContain('.maybeSingle()')
  expect(source).toContain('Could not load your tasks')
})

test('authenticated task capture surfaces server save messages', () => {
  const source = readFileSync('components/task-input.tsx', 'utf8')

  expect(source).toContain('payload?.message ||')
  expect(source).toContain('payload?.error ||')
  expect(source).toContain('Your task was not saved. Please try again.')
})

test('authenticated task mutations surface server failure messages', () => {
  const source = readFileSync('lib/store.ts', 'utf8')

  expect(source).toContain('payload?.message ||')
  expect(source).toContain('payload?.error ||')
  expect(source).toContain('Could not save task changes:')
  expect(source).toContain('Could not delete task:')
})

test('authenticated agent execution surfaces server failure messages', () => {
  const source = readFileSync('components/task-detail.tsx', 'utf8')

  expect(source).toContain('payload?.message ||')
  expect(source).toContain('payload?.error ||')
  expect(source).toContain('setExecutionError(')
  expect(source).toContain('Failed to execute task. Please try again.')
})

test('authenticated AI fallback notices surface provider failure messages', () => {
  const briefingSource = readFileSync('components/daily-briefing.tsx', 'utf8')
  const todaySource = readFileSync('app/(app)/today/page.tsx', 'utf8')

  expect(briefingSource).toContain('Using local briefing:')
  expect(briefingSource).toContain('payload?.message ||')
  expect(briefingSource).toContain('payload?.error ||')
  expect(todaySource).toContain('Using local priority order:')
  expect(todaySource).toContain('payload?.message ||')
  expect(todaySource).toContain('payload?.error ||')
})

test('authenticated done bulk-clear surfaces server delete messages', () => {
  const source = readFileSync('app/(app)/done/page.tsx', 'utf8')

  expect(source).toContain('payload?.message ||')
  expect(source).toContain('payload?.error ||')
  expect(source).toContain('Task delete failed')
  expect(source).toContain('They were restored locally. Please try again.')
})

test('authenticated imports surface server failure messages before generic errors', () => {
  const source = readFileSync('app/(app)/import/page.tsx', 'utf8')

  expect(source).toContain("result.message || result.error || 'Import failed'")
})

test('billing actions surface server messages before generic errors', () => {
  const source = readFileSync('app/(app)/settings/page.tsx', 'utf8')

  expect(source).toContain('result.message ||')
  expect(source).toContain('result.error ||')
  expect(source).toContain('Unable to start checkout right now.')
  expect(source).toContain('Unable to open billing portal right now.')
})

test('provider list imports fail closed on nested task fetch failures', () => {
  const googleSource = readFileSync('app/api/import/google/route.ts', 'utf8')
  const microsoftSource = readFileSync('app/api/import/microsoft/route.ts', 'utf8')
  const importPageSource = readFileSync('app/(app)/import/page.tsx', 'utf8')

  expect(importPageSource).toContain("handleImport('google', '/api/import/google', { token })")
  expect(importPageSource).toContain("handleImport('microsoft', '/api/import/microsoft', { token })")
  expect(googleSource).toContain('body.access_token || body.token')
  expect(googleSource).toContain('if (!tasksResponse.ok)')
  expect(googleSource).toContain('Google Tasks list API error')
  expect(googleSource).toContain('Failed to fetch tasks from a Google Tasks list')
  expect(googleSource).toContain('encodeURIComponent(list.id)')
  expect(microsoftSource).toContain('body.access_token || body.token')
  expect(microsoftSource).toContain('if (!tasksResponse.ok)')
  expect(microsoftSource).toContain('Microsoft To Do list API error')
  expect(microsoftSource).toContain('Failed to fetch tasks from a Microsoft To Do list')
  expect(microsoftSource).toContain('encodeURIComponent(list.id)')
})

test('connected app imports expose an honest manual token path', async ({ page }) => {
  const importCardSource = readFileSync('components/import-source-card.tsx', 'utf8')

  expect(importCardSource).not.toContain("type: 'oauth'")
  expect(importCardSource).not.toContain('comingSoon')
  expect(importCardSource).not.toContain('Connect Account')

  await page.goto('/import')

  await expect(
    page.getByText('Full OAuth connection is a post-launch workflow.')
  ).toBeVisible()
  await expect(page.getByPlaceholder('Microsoft Graph access token')).toBeVisible()
  await expect(page.getByPlaceholder('Google Tasks access token')).toBeVisible()
  await expect(page.getByText('Use a Microsoft Graph access token')).toBeVisible()
  await expect(page.getByText('Use a Google OAuth access token')).toBeVisible()
  await expect(page.getByText('Coming soon')).toHaveCount(0)
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

  await expect(page.getByText('1 task ready')).toBeVisible()
  await expect(page.getByText('Imported demo smoke task')).toBeVisible()
  await expect(
    page.getByText('Demo file imports are capped at 100 tasks per file.')
  ).toBeVisible()
  await page.getByRole('button', { name: 'Import' }).last().click()

  await expect(page.getByText('1 task imported successfully')).toBeVisible()

  await page.getByRole('link', { name: 'All Tasks' }).click()
  await expect(
    page.getByRole('heading', { name: 'Imported demo smoke task' })
  ).toBeVisible()
})

test('demo workspace supports all, upcoming, and done lifecycle', async ({
  page,
}) => {
  await page.goto('/all')

  await expect(page.getByRole('heading', { name: 'All Tasks' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Reply to customer feedback email' })
  ).toBeVisible()

  await page.getByPlaceholder('Search tasks...').fill('customer')
  await expect(
    page.getByRole('heading', { name: 'Reply to customer feedback email' })
  ).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Review Q4 marketing proposal' })
  ).toHaveCount(0)
  await expect(page.getByText('Showing 1 task (filtered from 5)')).toBeVisible()

  await page.getByPlaceholder('Search tasks...').fill('')
  await page.getByRole('button', { name: 'Filters' }).click()
  await page.getByRole('button', { name: 'High' }).click()
  await expect(page.getByText('Showing 2 tasks (filtered from 5)')).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Reply to customer feedback email' })
  ).toBeVisible()

  await page.getByRole('link', { name: 'Upcoming' }).click()
  await expect(page.getByRole('heading', { name: 'Upcoming' })).toBeVisible()
  await expect(page.getByRole('heading', { name: /Tomorrow/ })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Review Q4 marketing proposal' })
  ).toBeVisible()

  await page.getByRole('link', { name: 'All Tasks' }).click()
  await page
    .getByRole('checkbox', {
      name: 'Mark "Reply to customer feedback email" complete',
    })
    .locator('xpath=ancestor::label')
    .click()
  await expect(
    page.getByRole('heading', { name: 'Reply to customer feedback email' })
  ).toHaveCount(0)

  await page.getByRole('link', { name: 'Done' }).click()
  await expect(page.getByRole('heading', { name: 'Done' })).toBeVisible()
  await expect(
    page.getByRole('heading', { name: 'Reply to customer feedback email' })
  ).toBeVisible()

  await page.reload()
  await expect(
    page.getByRole('heading', { name: 'Reply to customer feedback email' })
  ).toBeVisible()

  await page.getByRole('button', { name: 'Clear all' }).click()
  await expect(page.getByRole('dialog')).toBeVisible()
  await page.getByRole('button', { name: 'Delete all' }).click()
  await expect(page.getByText('Nothing completed yet')).toBeVisible()

  await page.reload()
  await expect(page.getByText('Nothing completed yet')).toBeVisible()
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
  await expect(page.getByRole('button', { name: 'Notifications' })).toBeVisible()
  await expect(page.getByRole('button', { name: 'Sign out' })).toHaveCount(0)
})

test('appearance settings apply and persist theme locally', async ({ page }) => {
  await page.goto('/settings?tab=appearance')

  await expect(page.getByRole('heading', { name: 'Appearance' })).toBeVisible()
  await expect(page.getByRole('radio', { name: /Dark/ })).toHaveAttribute(
    'aria-checked',
    'true'
  )

  await page.getByRole('radio', { name: /Light/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.locator('body')).toHaveClass(/light/)
  await expect(page.getByRole('radio', { name: /Light/ })).toHaveAttribute(
    'aria-checked',
    'true'
  )
  await expect.poll(
    async () => page.evaluate(() => window.localStorage.getItem('nexdo_theme'))
  ).toBe('light')

  await page.reload()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light')
  await expect(page.getByRole('radio', { name: /Light/ })).toHaveAttribute(
    'aria-checked',
    'true'
  )

  await page.getByRole('radio', { name: /Dark/ }).click()
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark')
  await expect(page.locator('body')).toHaveClass(/dark/)
})

test('notification settings request permission and deliver due-task reminders', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const deliveredNotifications: Array<{
      title: string
      options?: NotificationOptions
    }> = []

    class MockNotification {
      static permission: NotificationPermission =
        (window.localStorage.getItem('__mock_notification_permission') as NotificationPermission | null) ||
        'default'

      onclick: (() => void) | null = null

      constructor(title: string, options?: NotificationOptions) {
        deliveredNotifications.push({ title, options })
      }

      static async requestPermission() {
        MockNotification.permission = 'granted'
        window.localStorage.setItem('__mock_notification_permission', 'granted')
        return MockNotification.permission
      }
    }

    Object.defineProperty(window, 'Notification', {
      value: MockNotification,
      configurable: true,
    })
    ;(window as typeof window & {
      __nexdoNotifications: typeof deliveredNotifications
    }).__nexdoNotifications = deliveredNotifications
  })

  await page.goto('/settings?tab=notifications')

  await expect(page.getByRole('heading', { name: 'Notifications' })).toBeVisible()
  await expect(page.getByText('Permission: default')).toBeVisible()

  await page
    .getByRole('checkbox', { name: 'Browser due-task reminders' })
    .check({ force: true })

  await expect(page.getByText('Browser reminders enabled.')).toBeVisible()
  await expect(page.getByText('Permission: granted')).toBeVisible()
  await expect.poll(
    async () =>
      page.evaluate(() =>
        window.localStorage.getItem('nexdo_browser_notifications_enabled')
      )
  ).toBe('true')

  await expect.poll(
    async () =>
      page.evaluate(
        () =>
          (window as typeof window & {
            __nexdoNotifications: Array<{ title: string }>
          }).__nexdoNotifications.length
      )
  ).toBeGreaterThan(0)

  const delivered = await page.evaluate(
    () =>
      (window as typeof window & {
        __nexdoNotifications: Array<{
          title: string
          options?: NotificationOptions
        }>
      }).__nexdoNotifications
  )
  expect(delivered[0].title).toContain('Nexdo:')
  expect(delivered[0].options?.body).toContain('Due today')

  await page.reload()
  await expect(page.getByText('Permission: granted')).toBeVisible()
  await expect(page.getByRole('checkbox', { name: 'Browser due-task reminders' })).toBeChecked()
  await expect.poll(
    async () =>
      page.evaluate(
        () =>
          (window as typeof window & {
            __nexdoNotifications: Array<{ title: string }>
          }).__nexdoNotifications.length
      )
  ).toBe(0)
})

test('demo profile settings save locally across reloads', async ({ page }) => {
  await page.goto('/settings')

  await page.getByLabel('Full Name').fill('Casey Demo')
  await page.getByLabel('Timezone').selectOption('America/Los_Angeles')
  await page.getByRole('button', { name: 'Save Changes' }).click()

  await expect(page.getByText('Saved!')).toBeVisible()

  await page.reload()
  await expect(page.getByLabel('Full Name')).toHaveValue('Casey Demo')
  await expect(page.getByLabel('Timezone')).toHaveValue('America/Los_Angeles')
})

test('login exposes demo mode when auth env is not configured', async ({ page }) => {
  await page.goto('/auth/login')

  await expect(page.getByRole('button', { name: /Try demo mode/ })).toBeVisible()
})

test('signup page exposes a direct demo path', async ({ page }) => {
  await page.goto('/auth/signup')

  await page.getByRole('button', { name: /Try demo mode/ }).click()
  await expect(page.getByRole('heading', { name: 'Today', exact: true })).toBeVisible()
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
  await expect(page.getByText('Upgrade to Power or Team before connecting external AI tools.')).toBeVisible()
  await expect(page.getByLabel('Full API key')).toBeDisabled()
  await expect(page.getByRole('button', { name: 'Test Connection' })).toBeDisabled()
})

test('connect ai page treats paid API access as the usable-key gate', () => {
  const source = readFileSync('app/(app)/settings/mcp/page.tsx', 'utf8')

  expect(source).toContain('const hasUsableApiKey = hasApiAccess && hasApiKey')
  expect(source).toContain('const canTestConnection = hasUsableApiKey')
  expect(source).toContain('if (!hasUsableApiKey) return')
  expect(source).toContain('Existing API keys are disabled until API access is active again.')
  expect(source).toContain('const isEnabled = hasUsableApiKey && apiKeyScopes.includes(requiredScope)')
})

test('connect ai page normalizes MCP setup error messages', () => {
  const source = readFileSync('app/(app)/settings/mcp/page.tsx', 'utf8')
  const eventsRouteSource = readFileSync('app/api/mcp/events/route.ts', 'utf8')

  expect(source).toContain('function apiErrorMessage')
  expect(source).toContain('function formatEventIntent')
  expect(source).toContain('function eventArgumentKeys')
  expect(source).toContain('agent metadata included')
  expect(source).toContain("setEventsError(apiErrorMessage(data, 'Unable to load agent activity'))")
  expect(source).toContain("setTestMessage(apiErrorMessage(data, 'Connection failed'))")
  expect(source).toContain("'message' in data.error")
  expect(eventsRouteSource).toContain('ingestion_intent, metadata, success')
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
