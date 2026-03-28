'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, User, ArrowRight, Check } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

const features = [
  'AI-powered task parsing',
  'Smart prioritization',
  'Agent execution (research, draft, prep)',
  'Daily briefings',
]

export default function SignupPage() {
  const router = useRouter()

  const [fullName, setFullName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [success, setSuccess] = useState(false)

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    // Demo mode: if Supabase isn't configured, go straight to app
    if (!supabase) {
      router.push('/today')
      return
    }

    try {
      const { error: authError } = await supabase.auth.signUp({
        email,
        password,
        options: {
          data: {
            full_name: fullName,
          },
          emailRedirectTo: `${window.location.origin}/auth/callback`,
        },
      })

      if (authError) {
        setError(authError.message)
        return
      }

      setSuccess(true)
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-6 text-center">
          <div className="w-16 h-16 rounded-full bg-emerald-500/10 flex items-center justify-center mx-auto">
            <Check className="h-8 w-8 text-emerald-400" />
          </div>
          <h1 className="text-2xl font-bold">Check your email</h1>
          <p className="text-zinc-400">
            We&apos;ve sent a confirmation link to <strong>{email}</strong>.
            Click the link to activate your account.
          </p>
          <Button variant="outline" onClick={() => router.push('/auth/login')}>
            Back to login
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Hero */}
      <div className="hidden lg:flex flex-1 bg-zinc-900 items-center justify-center p-12">
        <div className="max-w-lg space-y-8">
          <div>
            <h2 className="text-4xl font-bold tracking-tight">
              Start getting things done
            </h2>
            <p className="mt-4 text-xl text-zinc-400">
              The last to-do app you&apos;ll ever need — because this one actually
              does your tasks.
            </p>
          </div>

          <div className="space-y-4">
            {features.map((feature) => (
              <div key={feature} className="flex items-center gap-3">
                <div className="w-5 h-5 rounded-full bg-accent/20 flex items-center justify-center flex-shrink-0">
                  <Check className="h-3 w-3 text-accent" />
                </div>
                <span className="text-zinc-300">{feature}</span>
              </div>
            ))}
          </div>

          <div className="pt-8 border-t border-zinc-800">
            <p className="text-sm text-zinc-500">
              Free tier includes 25 tasks/month. No credit card required.
            </p>
          </div>
        </div>
      </div>

      {/* Right side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="space-y-2">
            <Link href="/" className="inline-block">
              <h1 className="text-3xl font-bold tracking-tight">nexdo</h1>
            </Link>
            <p className="text-zinc-400">Create your account to get started.</p>
          </div>

          {/* Form */}
          <form onSubmit={handleSignup} className="space-y-4">
            <Input
              type="text"
              label="Full name"
              placeholder="John Doe"
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              icon={<User className="h-4 w-4" />}
              required
              autoComplete="name"
            />

            <Input
              type="email"
              label="Email"
              placeholder="you@example.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              icon={<Mail className="h-4 w-4" />}
              required
              autoComplete="email"
            />

            <Input
              type="password"
              label="Password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              icon={<Lock className="h-4 w-4" />}
              required
              autoComplete="new-password"
              minLength={8}
            />
            <p className="text-xs text-zinc-500">
              Must be at least 8 characters
            </p>

            {error && (
              <div className="text-sm text-red-400 bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <Button
              type="submit"
              className="w-full"
              size="lg"
              isLoading={isLoading}
            >
              Create account
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          {/* Terms */}
          <p className="text-xs text-zinc-500 text-center">
            By signing up, you agree to our{' '}
            <Link href="/terms" className="text-zinc-400 hover:text-zinc-300">
              Terms of Service
            </Link>{' '}
            and{' '}
            <Link href="/privacy" className="text-zinc-400 hover:text-zinc-300">
              Privacy Policy
            </Link>
          </p>

          {/* Login link */}
          <p className="text-center text-sm text-zinc-400">
            Already have an account?{' '}
            <Link
              href="/auth/login"
              className="text-accent hover:text-accent/80 font-medium"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
