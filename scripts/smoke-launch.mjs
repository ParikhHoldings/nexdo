#!/usr/bin/env node

import { spawn } from 'node:child_process'
import fs from 'node:fs'
import path from 'node:path'

const rawArgs = process.argv.slice(2)
const args = new Set(rawArgs)
const envArg = rawArgs.find((arg) => arg.startsWith('--env='))
const urlArg = rawArgs.find((arg) => arg.startsWith('--url='))
const envFile = envArg?.slice('--env='.length) || '.env.local'
const appUrl = urlArg?.slice('--url='.length)?.replace(/\/$/, '')
const skipLocal = args.has('--skip-local')
const skipProviders = args.has('--skip-providers')
const technicalOnly = args.has('--technical-only')
const copyApproved = args.has('--copy-approved')
const productionDeployVerified = args.has('--production-deploy-verified')
const allowLiveStripe = args.has('--allow-live-stripe')
const allowLocalUrl = args.has('--allow-local-url')

const npmCommand = process.platform === 'win32' ? 'npm.cmd' : 'npm'
const envPath = path.resolve(process.cwd(), envFile)
const fileEnv = readEnvFile(envPath)
const childEnv = {
  ...process.env,
  ...fileEnv,
}

if (appUrl) childEnv.NEXT_PUBLIC_APP_URL = appUrl

function validateProviderAppUrl(value) {
  if (!value) {
    return 'Provider launch smokes require --url=https://your-preview.example or NEXT_PUBLIC_APP_URL in the loaded env.'
  }

  let parsed
  try {
    parsed = new URL(value)
  } catch {
    return `Provider launch smokes require a valid app URL, got: ${value}`
  }

  if (parsed.pathname !== '/' || parsed.search || parsed.hash) {
    return 'Provider launch smokes require an origin only app URL with no path, query, or hash.'
  }

  if (value.endsWith('/')) {
    return 'Provider launch smokes require NEXT_PUBLIC_APP_URL without a trailing slash.'
  }

  const localHosts = new Set(['localhost', '127.0.0.1', '::1'])
  const isLocal = localHosts.has(parsed.hostname) || parsed.hostname.endsWith('.local')
  if (isLocal && !allowLocalUrl) {
    return 'Provider launch smokes require a remote preview/production URL. Pass --allow-local-url only for intentional local debugging.'
  }

  if (parsed.protocol !== 'https:' && !(allowLocalUrl && isLocal)) {
    return 'Provider launch smokes require an HTTPS app URL.'
  }

  return null
}

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {}

  return fs
    .readFileSync(filePath, 'utf8')
    .split(/\r?\n/)
    .reduce((acc, line) => {
      const trimmed = line.trim()
      if (!trimmed || trimmed.startsWith('#')) return acc

      const separator = trimmed.indexOf('=')
      if (separator === -1) return acc

      const key = trimmed.slice(0, separator).trim()
      let value = trimmed.slice(separator + 1).trim()
      if (
        (value.startsWith('"') && value.endsWith('"')) ||
        (value.startsWith("'") && value.endsWith("'"))
      ) {
        value = value.slice(1, -1)
      }

      acc[key] = value
      return acc
    }, {})
}

function run(label, commandArgs) {
  console.log(`\n==> ${label}`)
  console.log(`$ ${[npmCommand, ...commandArgs].join(' ')}`)

  return new Promise((resolve, reject) => {
    const child = spawn(npmCommand, commandArgs, {
      cwd: process.cwd(),
      env: childEnv,
      stdio: 'inherit',
    })

    child.on('error', reject)
    child.on('close', (code) => {
      if (code === 0) {
        resolve()
      } else {
        reject(new Error(`${label} failed with exit code ${code}`))
      }
    })
  })
}

async function runLocalRails() {
  await run('Lint', ['run', 'lint'])
  await run('Typecheck', ['run', 'typecheck'])
  await run('Build', ['run', 'build'])
  await run('Playwright e2e', ['run', 'test:e2e'])
  await run('Dependency audit', ['audit', '--audit-level=moderate'])
}

async function runProviderSmokes() {
  await run('Environment preflight', ['run', 'verify:env', '--', envFile])
  await run('Rendered route smoke', [
    'run',
    'smoke:routes',
    '--',
    `--url=${childEnv.NEXT_PUBLIC_APP_URL}`,
  ])
  await run('Supabase write smoke', ['run', 'smoke:supabase', '--', '--write'])
  await run('OpenAI app-route smoke', ['run', 'smoke:openai', '--', '--app'])

  const stripeArgs = ['run', 'smoke:stripe', '--', '--write', '--webhook']
  if (allowLiveStripe) stripeArgs.push('--live')
  await run('Stripe webhook smoke', stripeArgs)

  const mcpArgs = ['run', 'smoke:mcp', '--', '--provision', '--write', '--audit']
  if (childEnv.NEXT_PUBLIC_APP_URL) {
    mcpArgs.push(`--url=${childEnv.NEXT_PUBLIC_APP_URL}`)
  }
  await run('MCP provisioned write/audit smoke', mcpArgs)
}

async function main() {
  console.log('Nexdo launch smoke')
  console.log(`Env file: ${envFile}${fs.existsSync(envPath) ? '' : ' (not found; using shell env)'}`)
  console.log(`App URL: ${childEnv.NEXT_PUBLIC_APP_URL || '(not set)'}`)

  if (!technicalOnly && (skipLocal || skipProviders)) {
    throw new Error(
      'Full launch smoke cannot skip local rails or provider smokes. Use --technical-only for partial verification runs.'
    )
  }

  if (!skipLocal) {
    await runLocalRails()
  } else {
    console.log('\nskip local rails; --skip-local was provided')
  }

  if (!skipProviders) {
    const appUrlError = validateProviderAppUrl(childEnv.NEXT_PUBLIC_APP_URL)
    if (appUrlError) {
      throw new Error(appUrlError)
    }
    await runProviderSmokes()
  } else {
    console.log('\nskip provider smokes; --skip-providers was provided')
  }

  if (technicalOnly) {
    console.log(
      '\nTechnical launch smoke passed. Public copy approval and production deploy approval remain separate manual gates.'
    )
    return
  }

  const missingManualGates = []
  if (!copyApproved) missingManualGates.push('--copy-approved')
  if (!productionDeployVerified) missingManualGates.push('--production-deploy-verified')

  if (missingManualGates.length > 0) {
    throw new Error(
      `Technical checks finished, but launch is not fully approved. Missing manual gate flag(s): ${missingManualGates.join(
        ', '
      )}. Use --technical-only for a technical smoke that does not claim launch approval.`
    )
  }

  console.log('\nLaunch smoke passed with explicit approval gates.')
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : error)
  process.exit(1)
})
