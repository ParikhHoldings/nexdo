#!/usr/bin/env node

import { chromium } from '@playwright/test'
import fs from 'node:fs'
import path from 'node:path'

const rawArgs = process.argv.slice(2)
const urlArg = rawArgs.find((arg) => arg.startsWith('--url='))
const screenshotDirArg = rawArgs.find((arg) => arg.startsWith('--screenshot-dir='))
const baseUrl = (urlArg?.slice('--url='.length) || process.env.NEXT_PUBLIC_APP_URL || '').replace(
  /\/$/,
  ''
)
const screenshotDir = screenshotDirArg?.slice('--screenshot-dir='.length)

const routes = [
  '/',
  '/today',
  '/all',
  '/upcoming',
  '/done',
  '/import',
  '/settings',
  '/settings/mcp',
  '/auth/login',
  '/auth/signup',
  '/privacy',
  '/terms',
]

const viewports = [
  { name: 'desktop', width: 1366, height: 900 },
  { name: 'mobile', width: 390, height: 844 },
]

function validateBaseUrl(value) {
  if (!value) {
    return 'Route smoke requires --url=https://your-preview.example or NEXT_PUBLIC_APP_URL.'
  }

  try {
    const parsed = new URL(value)
    if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
      return 'Route smoke requires an origin-only URL with no path, query, or hash.'
    }
    if (value.endsWith('/')) {
      return 'Route smoke requires a URL without a trailing slash.'
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return 'Route smoke requires an http or https URL.'
    }
  } catch {
    return `Route smoke requires a valid URL, got: ${value}`
  }

  return null
}

function screenshotPath(viewport, route) {
  if (!screenshotDir) return null
  const filename = `nexdo-route-${viewport}-${route.replace(/\//g, '_') || 'home'}.png`
  return path.join(screenshotDir, filename)
}

function hasFrameworkOverlay(text) {
  return /Unhandled Runtime Error|Application error|Hydration failed|Runtime Error|Build Error/i.test(text)
}

async function main() {
  const urlError = validateBaseUrl(baseUrl)
  if (urlError) {
    throw new Error(urlError)
  }

  if (screenshotDir) {
    fs.mkdirSync(screenshotDir, { recursive: true })
  }

  const browser = await chromium.launch()
  const failures = []

  try {
    for (const viewport of viewports) {
      const page = await browser.newPage({ viewport })
      const routeMessages = []

      page.on('console', (message) => {
        if (['error', 'warning'].includes(message.type())) {
          routeMessages.push(`${message.type()}: ${message.text()}`)
        }
      })
      page.on('pageerror', (error) => {
        routeMessages.push(`pageerror: ${error.message}`)
      })

      for (const route of routes) {
        routeMessages.length = 0
        const response = await page.goto(`${baseUrl}${route}`, {
          waitUntil: 'networkidle',
          timeout: 30_000,
        })
        const status = response?.status() ?? 0
        const title = await page.title()
        const bodyText = (await page.locator('body').innerText()).trim()
        const meaningful = bodyText.length >= 80
        const overlay = hasFrameworkOverlay(bodyText)
        const relevantMessages = routeMessages.filter(
          (message) => !message.includes('NO_COLOR')
        )
        const consoleFailures = relevantMessages.filter(
          (message) => message.startsWith('error:') || message.startsWith('pageerror:')
        )
        const capturePath = screenshotPath(viewport.name, route)

        if (capturePath) {
          await page.screenshot({ path: capturePath, fullPage: false })
        }

        const routeFailures = []
        if (status >= 400 || status === 0) routeFailures.push(`status ${status}`)
        if (!title) routeFailures.push('missing page title')
        if (!meaningful) routeFailures.push('blank or low-content body')
        if (overlay) routeFailures.push('framework/runtime overlay text detected')
        if (consoleFailures.length > 0) routeFailures.push(consoleFailures.join('; '))

        if (routeFailures.length > 0) {
          failures.push(`${viewport.name} ${route}: ${routeFailures.join('; ')}`)
          console.log(`issue ${viewport.name} ${route}`)
        } else {
          console.log(`ok ${viewport.name} ${route}`)
        }

        if (capturePath) {
          console.log(`  screenshot ${capturePath}`)
        }
        const warnings = relevantMessages.filter((message) => message.startsWith('warning:'))
        for (const warning of warnings) {
          console.log(`  ${warning}`)
        }
      }

      await page.close()
    }
  } finally {
    await browser.close()
  }

  if (failures.length > 0) {
    throw new Error(`Route smoke failed:\n- ${failures.join('\n- ')}`)
  }

  console.log('Route smoke passed.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
