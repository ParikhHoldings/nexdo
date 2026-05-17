import { createHash, randomBytes } from 'node:crypto'

export function generateApiKey() {
  return `nxd_${randomBytes(24).toString('hex')}`
}

export function hashApiKey(apiKey: string) {
  return createHash('sha256').update(apiKey, 'utf8').digest('hex')
}

export function apiKeyHint(apiKey: string) {
  return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
}
