const DEFAULT_AUTH_REDIRECT = '/today'
const CONTROL_CHAR_PATTERN = /[\u0000-\u001F\u007F]/
const ENCODED_AUTHORITY_PREFIX = /^\/%(?:2f|5c)/i

function hasUnsafeRedirectShape(value: string) {
  return (
    CONTROL_CHAR_PATTERN.test(value) ||
    value.includes('\\') ||
    ENCODED_AUTHORITY_PREFIX.test(value)
  )
}

export function safeAuthRedirect(value: string | null | undefined): string {
  const redirect = value?.trim()

  if (
    !redirect ||
    !redirect.startsWith('/') ||
    redirect.startsWith('//') ||
    hasUnsafeRedirectShape(redirect)
  ) {
    return DEFAULT_AUTH_REDIRECT
  }

  return redirect
}

export function safeLoginRedirect(value: string | null | undefined): string {
  const redirect = safeAuthRedirect(value)
  if (redirect === DEFAULT_AUTH_REDIRECT) return redirect

  const pathname = redirect.split(/[?#]/, 1)[0]?.replace(/\/+$/, '') || '/'
  if (pathname === '/auth' || pathname.startsWith('/auth/')) {
    return DEFAULT_AUTH_REDIRECT
  }

  return redirect
}

export function authErrorMessage(value: string | null | undefined): string | null {
  if (value === 'callback_error') {
    return 'Could not finish sign-in. Request a fresh link or sign in again.'
  }

  return null
}
