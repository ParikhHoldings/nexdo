'use client'

import { Suspense, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import {
  Bell,
  User,
  CreditCard,
  Key,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
  Palette,
  Moon,
  Sun,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import { PricingTable } from '@/components/pricing-table'
import { useUIStore, useUserStore, type Theme } from '@/lib/store'
import { persistDemoProfile } from '@/lib/demo-profile'
import { cn } from '@/lib/utils'
import {
  API_KEY_SCOPE_LABELS,
  API_KEY_SCOPES,
  API_ACCESS_REQUIRED_MESSAGE,
  canUseApiAccess,
  normalizeApiKeyScopes,
  type ApiKeyScope,
} from '@/lib/agent-scopes'

const SETTINGS_TABS = ['profile', 'appearance', 'notifications', 'billing', 'api'] as const
type Tab = (typeof SETTINGS_TABS)[number]

function isSettingsTab(value: string | null): value is Tab {
  return SETTINGS_TABS.includes(value as Tab)
}

function formatApiKeyHint(apiKey: string) {
  return `${apiKey.slice(0, 8)}...${apiKey.slice(-4)}`
}

function SettingsContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const checkoutStatus = searchParams.get('checkout')
  const requestedTab = searchParams.get('tab')
  const activeTab = isSettingsTab(requestedTab) ? requestedTab : 'profile'

  const { profile, isAuthenticated, setProfile } = useUserStore()
  const {
    theme,
    setTheme,
    browserNotificationsEnabled,
    notificationPermission,
    setBrowserNotificationsEnabled,
    setNotificationPermission,
  } = useUIStore()

  const setActiveTab = (activeTab: Tab) => {
    const params = new URLSearchParams(searchParams.toString())
    params.set('tab', activeTab)
    router.replace(`/settings?${params.toString()}`, { scroll: false })
  }

  const [copied, setCopied] = useState(false)
  const [generatedApiKey, setGeneratedApiKey] = useState('')
  const [generatedApiKeyHint, setGeneratedApiKeyHint] = useState('')
  const [apiKeyScopesDraft, setApiKeyScopesDraft] = useState<ApiKeyScope[] | null>(null)
  const copyableApiKey = generatedApiKey
  const apiKeyHint =
    generatedApiKeyHint ||
    profile?.api_key_hint ||
    ''
  const hasApiKey = Boolean(copyableApiKey || apiKeyHint)
  const apiKeyScopes = apiKeyScopesDraft ?? normalizeApiKeyScopes(profile?.api_key_scopes)
  const hasApiAccess = canUseApiAccess(profile?.subscription_tier)

  // Profile form state
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [timezone, setTimezone] = useState(profile?.timezone || 'America/Chicago')
  const [isSaving, setIsSaving] = useState(false)
  const [saveSuccess, setSaveSuccess] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [apiKeySuccess, setApiKeySuccess] = useState(false)
  const [apiKeyError, setApiKeyError] = useState<string | null>(null)
  const [billingError, setBillingError] = useState<string | null>(null)
  const [isManagingBilling, setIsManagingBilling] = useState(false)
  const [notificationMessage, setNotificationMessage] = useState<string | null>(null)
  const [notificationError, setNotificationError] = useState<string | null>(null)

  const handleCopyApiKey = () => {
    if (copyableApiKey) {
      navigator.clipboard.writeText(copyableApiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleGenerateApiKey = async () => {
    if (!hasApiAccess) return

    setApiKeySuccess(false)
    setApiKeyError(null)
    try {
      const response = await fetch('/api/profile/api-key', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scopes: apiKeyScopes }),
      })

      if (response.ok) {
        const result = await response.json()
        const nextScopes = normalizeApiKeyScopes(result.api_key_scopes)
        const nextHint = result.api_key_hint || formatApiKeyHint(result.api_key)

        setGeneratedApiKey(result.api_key)
        setGeneratedApiKeyHint(nextHint)
        if (result.api_key_scopes) {
          setApiKeyScopesDraft(nextScopes)
        }
        if (profile) {
          setProfile({
            ...profile,
            api_key: null,
            api_key_hash: null,
            api_key_hint: nextHint,
            api_key_scopes: nextScopes,
            api_key_last_used_at: null,
            updated_at: new Date().toISOString(),
          })
        }
        setApiKeySuccess(true)
        setTimeout(() => setApiKeySuccess(false), 3000)
      } else {
        const payload = await response.json().catch(() => ({}))
        setApiKeyError(
          payload?.message ||
            payload?.error ||
            'Unable to generate an API key right now.'
        )
      }
    } catch (error) {
      console.error('Error generating API key:', error)
      setApiKeyError('Unable to generate an API key right now.')
    }
  }

  const toggleApiKeyScope = (scope: ApiKeyScope) => {
    setApiKeyScopesDraft((currentDraft) => {
      const current = currentDraft ?? apiKeyScopes
      if (current.includes(scope)) {
        const next = current.filter((item) => item !== scope)
        return next.length > 0 ? next : current
      }
      return [...current, scope]
    })
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    setSaveSuccess(false)
    setSaveError(null)

    if (!isAuthenticated && profile) {
      const nextProfile = {
        ...profile,
        full_name: fullName.trim() || null,
        timezone,
        work_type: 'other' as const,
        updated_at: new Date().toISOString(),
      }

      setProfile(nextProfile)
      persistDemoProfile(nextProfile)
      setSaveSuccess(true)
      setTimeout(() => setSaveSuccess(false), 3000)
      setIsSaving(false)
      return
    }

    try {
      const response = await fetch('/api/profile', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          full_name: fullName,
          timezone,
          work_type: 'other',
        }),
      })

      if (response.ok) {
        const nextProfile = await response.json()
        setProfile(nextProfile)
        setFullName(nextProfile.full_name || '')
        setTimezone(nextProfile.timezone || timezone)
        setSaveSuccess(true)
        setTimeout(() => setSaveSuccess(false), 3000)
      } else {
        const payload = await response.json().catch(() => ({}))
        const validationMessage = payload?.errors?.[0]?.message
        setSaveError(
          validationMessage ||
            payload?.error ||
            'Failed to save profile'
        )
      }
    } catch (error) {
      console.error('Error saving profile:', error)
      setSaveError('Failed to save profile')
    } finally {
      setIsSaving(false)
    }
  }

  const handleUpgrade = async (plan: string) => {
    if (plan === 'team') {
      window.open('mailto:sales@nexdo.ai?subject=Team Plan Inquiry', '_blank')
      return
    }

    setBillingError(null)

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      const result = await response.json()

      if (!response.ok || !result.url) {
        throw new Error(
          result.message ||
            result.error ||
            'Unable to start checkout right now.'
        )
      }

      window.location.href = result.url
    } catch (error) {
      console.error('Error creating checkout session:', error)
      setBillingError(
        error instanceof Error ? error.message : 'Unable to start checkout right now.'
      )
    }
  }

  const handleManageSubscription = async () => {
    setIsManagingBilling(true)
    setBillingError(null)

    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
      })

      const result = await response.json()

      if (!response.ok || !result.url) {
        throw new Error(
          result.message ||
            result.error ||
            'Unable to open billing portal right now.'
        )
      }

      window.location.href = result.url
    } catch (error) {
      console.error('Error opening billing portal:', error)
      setBillingError(
        error instanceof Error ? error.message : 'Unable to open billing portal right now.'
      )
    } finally {
      setIsManagingBilling(false)
    }
  }

  const handleBrowserNotificationsChange = async (enabled: boolean) => {
    setNotificationMessage(null)
    setNotificationError(null)

    if (!enabled) {
      setBrowserNotificationsEnabled(false)
      setNotificationMessage('Browser reminders disabled.')
      return
    }

    if (typeof window === 'undefined' || !('Notification' in window)) {
      setNotificationPermission('unsupported')
      setBrowserNotificationsEnabled(false)
      setNotificationError('This browser does not support notifications.')
      return
    }

    let permission = window.Notification.permission
    if (permission === 'default') {
      permission = await window.Notification.requestPermission()
    }

    setNotificationPermission(permission)
    if (permission === 'granted') {
      setBrowserNotificationsEnabled(true)
      setNotificationMessage('Browser reminders enabled. Nexdo will notify once per due task each day.')
    } else {
      setBrowserNotificationsEnabled(false)
      setNotificationError('Notification permission was not granted.')
    }
  }

  const tabs = [
    { key: 'profile' as Tab, label: 'Profile', icon: User },
    { key: 'appearance' as Tab, label: 'Appearance', icon: Palette },
    { key: 'notifications' as Tab, label: 'Notifications', icon: Bell },
    { key: 'billing' as Tab, label: 'Billing', icon: CreditCard },
    { key: 'api' as Tab, label: 'API', icon: Key },
  ]
  const themeOptions: Array<{
    value: Theme
    label: string
    icon: typeof Moon
  }> = [
    { value: 'dark', label: 'Dark', icon: Moon },
    { value: 'light', label: 'Light', icon: Sun },
  ]

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 py-8">
      {/* Header */}
      <header className="mb-8">
        <h1 className="text-2xl font-bold text-zinc-100">Settings</h1>
        <p className="text-zinc-500 mt-1">
          Manage your account and preferences
        </p>
      </header>

      {/* Checkout status messages */}
      {checkoutStatus === 'success' && (
        <div className="mb-6 p-4 bg-emerald-500/10 border border-emerald-500/20 rounded-lg">
          <p className="text-emerald-400 text-sm">
            Your subscription has been activated. Thank you for upgrading!
          </p>
        </div>
      )}
      {checkoutStatus === 'cancelled' && (
        <div className="mb-6 p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
          <p className="text-amber-400 text-sm">
            Checkout was cancelled. You can upgrade anytime from the billing tab.
          </p>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-2 mb-8 overflow-x-auto pb-2">
        {tabs.map((tab) => {
          const Icon = tab.icon
          return (
            <button
              key={tab.key}
              onClick={() => setActiveTab(tab.key)}
              className={cn(
                'flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-colors whitespace-nowrap',
                activeTab === tab.key
                  ? 'bg-accent text-white'
                  : 'bg-zinc-800 text-zinc-400 hover:text-zinc-100 hover:bg-zinc-700'
              )}
            >
              <Icon className="h-4 w-4" />
              {tab.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div className="space-y-6">
        {/* Profile Tab */}
        {activeTab === 'profile' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6">
              <h2 className="text-lg font-semibold text-zinc-100">
                Personal Information
              </h2>

              <div className="grid gap-4 sm:grid-cols-2">
                <Input
                  label="Full Name"
                  value={fullName}
                  onChange={(e) => setFullName(e.target.value)}
                  placeholder="John Doe"
                />
                <div>
                  <label className="block text-sm font-medium text-zinc-300 mb-1.5">
                    Timezone
                  </label>
                  <select
                    aria-label="Timezone"
                    value={timezone}
                    onChange={(e) => setTimezone(e.target.value)}
                    className="w-full bg-zinc-900 border border-zinc-800 rounded-lg px-4 py-2.5 text-zinc-100 focus:outline-none focus:ring-2 focus:ring-accent/50 focus:border-accent"
                  >
                    <option value="America/New_York">Eastern Time</option>
                    <option value="America/Chicago">Central Time</option>
                    <option value="America/Denver">Mountain Time</option>
                    <option value="America/Los_Angeles">Pacific Time</option>
                    <option value="UTC">UTC</option>
                  </select>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <Button onClick={handleSaveProfile} isLoading={isSaving}>
                  Save Changes
                </Button>
                {saveSuccess && (
                  <span className="text-sm text-emerald-400">Saved!</span>
                )}
                {saveError && (
                  <span className="text-sm text-red-400">{saveError}</span>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Appearance Tab */}
        {activeTab === 'appearance' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">
                  Appearance
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Choose how Nexdo looks on this device.
                </p>
              </div>

              <div
                role="radiogroup"
                aria-label="Theme"
                className="grid gap-3 sm:grid-cols-2"
              >
                {themeOptions.map((option) => {
                  const Icon = option.icon
                  const isSelected = theme === option.value

                  return (
                    <button
                      key={option.value}
                      type="button"
                      role="radio"
                      aria-checked={isSelected}
                      onClick={() => setTheme(option.value)}
                      className={cn(
                        'flex items-center gap-3 rounded-lg border p-4 text-left transition-colors',
                        isSelected
                          ? 'border-accent/60 bg-accent/10 text-zinc-100'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700 hover:text-zinc-100'
                      )}
                    >
                      <span
                        className={cn(
                          'flex h-10 w-10 items-center justify-center rounded-lg border',
                          isSelected
                            ? 'border-accent bg-accent/15 text-accent'
                            : 'border-zinc-800 bg-zinc-800/50 text-zinc-400'
                        )}
                      >
                        <Icon className="h-5 w-5" />
                      </span>
                      <span>
                        <span className="block font-medium">
                          {option.label}
                        </span>
                        <span className="text-sm text-zinc-500">
                          {option.value === 'dark'
                            ? 'Low-glare workspace'
                            : 'Bright workspace'}
                        </span>
                      </span>
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        )}

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-5">
              <div>
                <h2 className="text-lg font-semibold text-zinc-100">
                  Notifications
                </h2>
                <p className="mt-1 text-sm text-zinc-500">
                  Get browser reminders for active tasks due today or overdue.
                </p>
              </div>

              <div className="rounded-lg border border-zinc-800 bg-zinc-900 p-4 space-y-3">
                <div className="flex items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h3 className="text-sm font-medium text-zinc-100">
                      Browser due-task reminders
                    </h3>
                    <p className="text-sm text-zinc-500">
                      Nexdo sends one local browser notification per due task each day while the app is open.
                    </p>
                    <p className="text-xs text-zinc-500">
                      Permission: {notificationPermission}
                    </p>
                  </div>
                  <Checkbox
                    aria-label="Browser due-task reminders"
                    checked={browserNotificationsEnabled}
                    disabled={notificationPermission === 'unsupported'}
                    onChange={(event) =>
                      handleBrowserNotificationsChange(event.currentTarget.checked)
                    }
                  />
                </div>

                {notificationMessage && (
                  <p className="text-sm text-emerald-400">{notificationMessage}</p>
                )}
                {notificationError && (
                  <p className="text-sm text-red-400">{notificationError}</p>
                )}
              </div>
            </div>
          </div>
        )}

        {/* Billing Tab */}
        {activeTab === 'billing' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6">
              <h2 className="text-lg font-semibold text-zinc-100 mb-4">
                Current Plan
              </h2>
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-2xl font-bold text-zinc-100 capitalize">
                    {profile?.subscription_tier || 'Free'}
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">
                    {profile?.subscription_tier === 'free'
                      ? `${profile?.task_count_this_month || 0}/25 tasks this month`
                      : 'Unlimited tasks'}
                  </p>
                </div>
                {profile?.subscription_tier !== 'free' && (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleManageSubscription}
                    isLoading={isManagingBilling}
                  >
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Manage Subscription
                  </Button>
                )}
              </div>
              {billingError && (
                <p className="mt-4 text-sm text-red-400">{billingError}</p>
              )}
            </div>

            <PricingTable
              currentPlan={profile?.subscription_tier || 'free'}
              onSelectPlan={handleUpgrade}
            />
          </div>
        )}

        {/* API Tab */}
        {activeTab === 'api' && (
          <div className="space-y-6">
            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-zinc-100">
                  API Key
                </h2>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleGenerateApiKey}
                  disabled={!hasApiAccess}
                >
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>

              <p className="text-sm text-zinc-500">
                Use this key to authenticate AI tools and API requests. New keys are shown once.
              </p>

              {apiKeySuccess && (
                <p className="text-sm text-emerald-400">
                  New key generated. Copy it now; it will not be shown again.
                </p>
              )}

              {apiKeyError && (
                <p className="text-sm text-red-400">
                  {apiKeyError}
                </p>
              )}

              <div className="flex gap-2">
                <Input
                  type={copyableApiKey ? 'password' : 'text'}
                  value={
                    copyableApiKey ||
                    (apiKeyHint ? `Stored key ${apiKeyHint}` : 'No API key generated')
                  }
                  readOnly
                  className="font-mono"
                />
                <Button
                  variant="secondary"
                  onClick={handleCopyApiKey}
                  disabled={!copyableApiKey}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {hasApiKey && !copyableApiKey && (
                <p className="text-xs text-zinc-500">
                  Existing keys cannot be revealed. Regenerate to copy a new key.
                </p>
              )}

              {hasApiAccess && hasApiKey && (
                <div className="rounded-lg border border-emerald-500/20 bg-emerald-500/10 p-4 sm:flex sm:items-center sm:justify-between sm:gap-4">
                  <div>
                    <h3 className="text-sm font-medium text-emerald-300">
                      Ready to connect AI tools
                    </h3>
                    <p className="mt-1 text-xs text-emerald-100/70">
                      Keep the full one-time key available, then open the guided MCP and ChatGPT Actions setup.
                    </p>
                  </div>
                  <Link
                    href="/settings/mcp"
                    className="mt-3 inline-flex items-center justify-center rounded-md bg-emerald-500 px-3 py-1.5 text-sm font-medium text-zinc-950 transition-colors hover:bg-emerald-400 focus:outline-none focus:ring-2 focus:ring-emerald-400 focus:ring-offset-2 focus:ring-offset-zinc-950 sm:mt-0"
                  >
                    <ExternalLink className="mr-2 h-4 w-4" />
                    Open Connect AI setup
                  </Link>
                </div>
              )}

              <div className="space-y-3">
                <div>
                  <h3 className="text-sm font-medium text-zinc-300">
                    Key scopes
                  </h3>
                  <p className="text-xs text-zinc-500 mt-1">
                    Choose the permissions included next time you generate this key.
                  </p>
                </div>
                <div className="grid gap-2 sm:grid-cols-3">
                  {API_KEY_SCOPES.map((scope) => (
                    <button
                      key={scope}
                      type="button"
                      onClick={() => toggleApiKeyScope(scope)}
                      disabled={!hasApiAccess}
                      className={cn(
                        'flex items-start gap-2 rounded-lg border p-3 text-left transition-colors',
                        apiKeyScopes.includes(scope)
                          ? 'border-accent/50 bg-accent/10 text-zinc-100'
                          : 'border-zinc-800 bg-zinc-900 text-zinc-400 hover:border-zinc-700',
                        !hasApiAccess && 'cursor-not-allowed opacity-60'
                      )}
                    >
                      <span
                        className={cn(
                          'mt-0.5 flex h-4 w-4 items-center justify-center rounded border',
                          apiKeyScopes.includes(scope)
                            ? 'border-accent bg-accent'
                            : 'border-zinc-600'
                        )}
                      >
                        {apiKeyScopes.includes(scope) && (
                          <Check className="h-3 w-3 text-white" />
                        )}
                      </span>
                      <span>
                        <span className="block text-sm font-medium">
                          {API_KEY_SCOPE_LABELS[scope]}
                        </span>
                        <code className="mt-1 block text-xs text-zinc-500">
                          {scope}
                        </code>
                      </span>
                    </button>
                  ))}
                </div>
              </div>

              {!hasApiAccess && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm text-amber-400">
                    {API_ACCESS_REQUIRED_MESSAGE}{' '}
                    <button
                      onClick={() => setActiveTab('billing')}
                      className="underline"
                    >
                      Upgrade now
                    </button>
                  </p>
                </div>
              )}
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-zinc-100">
                Usage This Month
              </h2>

              <div className="grid grid-cols-2 gap-4">
                <div className="p-4 bg-zinc-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-zinc-100">
                    {profile?.task_count_this_month || 0}
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">Tasks Created</p>
                </div>
                <div className="p-4 bg-zinc-800/50 rounded-lg">
                  <p className="text-2xl font-bold text-zinc-100">
                    {profile?.agent_executions_this_month || 0}
                  </p>
                  <p className="text-sm text-zinc-500 mt-1">Agent Executions</p>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

export default function SettingsPage() {
  return (
    <Suspense fallback={<div className="p-8 text-zinc-500">Loading...</div>}>
      <SettingsContent />
    </Suspense>
  )
}
