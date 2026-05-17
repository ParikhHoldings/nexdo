const DEFAULT_AUTH_REDIRECT = '/today'

export function safeAuthRedirect(value: string | null | undefined): string {
  const redirect = value?.trim()

  if (!redirect || !redirect.startsWith('/') || redirect.startsWith('//')) {
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
