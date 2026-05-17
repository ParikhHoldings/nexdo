import { apiKeyHint, hashApiKey } from '@/lib/api-keys'

export async function persistApiKeyRotation(
  db: any,
  userId: string,
  apiKey: string,
  scopes: string[]
) {
  const hint = apiKeyHint(apiKey)
  const { data, error } = await db
    .from('profiles')
    .update({
      api_key: null,
      api_key_hash: hashApiKey(apiKey),
      api_key_hint: hint,
      api_key_scopes: scopes,
      api_key_last_used_at: null,
    })
    .eq('id', userId)
    .select('id')
    .maybeSingle()

  if (error) {
    throw new Error(`Failed to persist API key for ${userId}`)
  }

  if (!data) {
    throw new Error(`No profile found for API key rotation for ${userId}`)
  }

  return { hint }
}
