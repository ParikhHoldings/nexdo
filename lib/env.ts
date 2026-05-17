const PLACEHOLDER_FRAGMENTS = [
  'placeholder',
  'your-',
  'your_',
  'changeme',
  'todo',
  'xxx',
  'replace',
  'example',
]

export function hasPlaceholderRisk(value: string | null | undefined): boolean {
  if (!value) return true

  const lower = value.toLowerCase()
  return PLACEHOLDER_FRAGMENTS.some((fragment) => lower.includes(fragment))
}

export function isUsableEnv(
  value: string | null | undefined
): value is string {
  return Boolean(value && !hasPlaceholderRisk(value))
}
