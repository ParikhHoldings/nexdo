'use client'

import { Suspense } from 'react'
import { useState } from 'react'
import { useSearchParams } from 'next/navigation'
import {
  User,
  CreditCard,
  Key,
  Bell,
  Moon,
  Globe,
  Copy,
  Check,
  ExternalLink,
  RefreshCw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { PricingTable } from '@/components/pricing-table'
import { useUserStore, useUIStore } from '@/lib/store'
import { cn, generateApiKey } from '@/lib/utils'

type Tab = 'profile' | 'billing' | 'api' | 'notifications'

function SettingsContent() {
  const searchParams = useSearchParams()
  const checkoutStatus = searchParams.get('checkout')

  const { profile } = useUserStore()
  const { theme, toggleTheme } = useUIStore()

  const [activeTab, setActiveTab] = useState<Tab>('profile')
  const [copied, setCopied] = useState(false)
  const [apiKey, setApiKey] = useState(profile?.api_key || '')

  // Profile form state
  const [fullName, setFullName] = useState(profile?.full_name || '')
  const [timezone, setTimezone] = useState(profile?.timezone || 'America/Chicago')
  const [isSaving, setIsSaving] = useState(false)

  const handleCopyApiKey = () => {
    if (apiKey) {
      navigator.clipboard.writeText(apiKey)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleGenerateApiKey = () => {
    const newKey = generateApiKey()
    setApiKey(newKey)
    // In production, save to Supabase
  }

  const handleSaveProfile = async () => {
    setIsSaving(true)
    // In production, save to Supabase
    await new Promise((resolve) => setTimeout(resolve, 1000))
    setIsSaving(false)
  }

  const handleUpgrade = async (plan: string) => {
    if (plan === 'team') {
      // Contact sales
      window.open('mailto:sales@nexdo.ai?subject=Team Plan Inquiry', '_blank')
      return
    }

    try {
      const response = await fetch('/api/stripe/checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan }),
      })

      const { url } = await response.json()
      if (url) {
        window.location.href = url
      }
    } catch (error) {
      console.error('Error creating checkout session:', error)
    }
  }

  const tabs = [
    { key: 'profile' as Tab, label: 'Profile', icon: User },
    { key: 'billing' as Tab, label: 'Billing', icon: CreditCard },
    { key: 'api' as Tab, label: 'API', icon: Key },
    { key: 'notifications' as Tab, label: 'Notifications', icon: Bell },
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

              <Button onClick={handleSaveProfile} isLoading={isSaving}>
                Save Changes
              </Button>
            </div>

            <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-4">
              <h2 className="text-lg font-semibold text-zinc-100">
                Appearance
              </h2>

              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <Moon className="h-5 w-5 text-zinc-400" />
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      Dark Mode
                    </p>
                    <p className="text-xs text-zinc-500">
                      Use dark theme for the interface
                    </p>
                  </div>
                </div>
                <button
                  onClick={toggleTheme}
                  className={cn(
                    'relative w-12 h-6 rounded-full transition-colors',
                    theme === 'dark' ? 'bg-accent' : 'bg-zinc-700'
                  )}
                >
                  <span
                    className={cn(
                      'absolute top-1 w-4 h-4 bg-white rounded-full transition-transform',
                      theme === 'dark' ? 'left-7' : 'left-1'
                    )}
                  />
                </button>
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
                  <Button variant="outline" size="sm">
                    <ExternalLink className="h-4 w-4 mr-2" />
                    Manage Subscription
                  </Button>
                )}
              </div>
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
                <Button variant="ghost" size="sm" onClick={handleGenerateApiKey}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Regenerate
                </Button>
              </div>

              <p className="text-sm text-zinc-500">
                Use this key to authenticate API requests. Keep it secret!
              </p>

              <div className="flex gap-2">
                <Input
                  type="password"
                  value={apiKey || 'No API key generated'}
                  readOnly
                  className="font-mono"
                />
                <Button
                  variant="secondary"
                  onClick={handleCopyApiKey}
                  disabled={!apiKey}
                >
                  {copied ? (
                    <Check className="h-4 w-4" />
                  ) : (
                    <Copy className="h-4 w-4" />
                  )}
                </Button>
              </div>

              {profile?.subscription_tier === 'free' && (
                <div className="p-4 bg-amber-500/10 border border-amber-500/20 rounded-lg">
                  <p className="text-sm text-amber-400">
                    API access requires a Power plan or higher.{' '}
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

        {/* Notifications Tab */}
        {activeTab === 'notifications' && (
          <div className="bg-zinc-900/50 border border-zinc-800 rounded-xl p-6 space-y-6">
            <h2 className="text-lg font-semibold text-zinc-100">
              Notification Preferences
            </h2>

            <div className="space-y-4">
              {[
                {
                  title: 'Daily Briefing',
                  description: 'Receive your morning briefing via email',
                  enabled: true,
                },
                {
                  title: 'Task Reminders',
                  description: 'Get notified about upcoming due dates',
                  enabled: true,
                },
                {
                  title: 'Agent Completions',
                  description: 'Notification when an agent finishes a task',
                  enabled: false,
                },
                {
                  title: 'Weekly Summary',
                  description: 'Weekly productivity report',
                  enabled: true,
                },
              ].map((notification) => (
                <div
                  key={notification.title}
                  className="flex items-center justify-between py-3 border-b border-zinc-800 last:border-0"
                >
                  <div>
                    <p className="text-sm font-medium text-zinc-200">
                      {notification.title}
                    </p>
                    <p className="text-xs text-zinc-500">
                      {notification.description}
                    </p>
                  </div>
                  <button
                    className={cn(
                      'relative w-10 h-5 rounded-full transition-colors',
                      notification.enabled ? 'bg-accent' : 'bg-zinc-700'
                    )}
                  >
                    <span
                      className={cn(
                        'absolute top-0.5 w-4 h-4 bg-white rounded-full transition-transform',
                        notification.enabled ? 'left-5' : 'left-0.5'
                      )}
                    />
                  </button>
                </div>
              ))}
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
