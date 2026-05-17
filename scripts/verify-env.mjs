#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'

const envFile = process.argv[2] || '.env.local'
const envPath = path.resolve(process.cwd(), envFile)

function parseEnvFile(filePath) {
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

const fileEnv = parseEnvFile(envPath)
const env = { ...process.env, ...fileEnv }

const checks = [
  {
    group: 'Supabase',
    vars: [
      {
        name: 'NEXT_PUBLIC_SUPABASE_URL',
        validate: (value) => isUrl(value) && hasNoPlaceholderRisk(value),
      },
      {
        name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY',
        validate: isRealSecret,
      },
      {
        name: 'SUPABASE_SERVICE_ROLE_KEY',
        validate: isRealSecret,
      },
    ],
  },
  {
    group: 'OpenAI',
    vars: [
      {
        name: 'OPENAI_API_KEY',
        validate: (value) => isRealSecret(value) && value.startsWith('sk-'),
      },
    ],
  },
  {
    group: 'Stripe',
    vars: [
      {
        name: 'STRIPE_SECRET_KEY',
        validate: (value) => isRealSecret(value) && value.startsWith('sk_'),
      },
      {
        name: 'STRIPE_WEBHOOK_SECRET',
        validate: (value) => isRealSecret(value) && value.startsWith('whsec_'),
      },
      {
        name: 'NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY',
        validate: (value) => isRealSecret(value) && value.startsWith('pk_'),
      },
      {
        name: 'STRIPE_PRO_PRICE_ID',
        validate: (value) => isRealSecret(value) && value.startsWith('price_'),
      },
      {
        name: 'STRIPE_POWER_PRICE_ID',
        validate: (value) => isRealSecret(value) && value.startsWith('price_'),
      },
    ],
  },
  {
    group: 'App',
    vars: [
      {
        name: 'NEXT_PUBLIC_APP_URL',
        validate: (value) =>
          isUrl(value) && hasNoPlaceholderRisk(value) && !value.endsWith('/'),
      },
    ],
  },
]

function isUrl(value) {
  if (!value) return false
  try {
    const parsed = new URL(value)
    return parsed.protocol === 'http:' || parsed.protocol === 'https:'
  } catch {
    return false
  }
}

function isRealSecret(value) {
  if (!value) return false
  return value.length >= 12 && hasNoPlaceholderRisk(value)
}

function hasNoPlaceholderRisk(value) {
  if (!value) return false
  const lower = value.toLowerCase()
  return (
    !lower.includes('placeholder') &&
    !lower.includes('your-') &&
    !lower.includes('your_') &&
    !lower.includes('changeme') &&
    !lower.includes('todo') &&
    !lower.includes('xxx') &&
    !lower.includes('replace') &&
    !lower.includes('example')
  )
}

const failures = []

console.log(`Checking environment from ${envFile}${fs.existsSync(envPath) ? '' : ' (not found)'}`)
for (const group of checks) {
  console.log(`\n${group.group}`)
  for (const variable of group.vars) {
    const value = env[variable.name]
    const ok = variable.validate(value)
    console.log(`  ${ok ? 'ok' : 'missing/invalid'} ${variable.name}`)
    if (!ok) failures.push(variable.name)
  }
}

if (failures.length > 0) {
  console.error(`\nEnvironment check failed for ${failures.length} variable(s).`)
  process.exit(1)
}

console.log('\nEnvironment check passed.')
