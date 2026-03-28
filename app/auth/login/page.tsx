'use client'

import { Suspense } from 'react'
import { useState } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import Link from 'next/link'
import { Mail, Lock, ArrowRight, Sparkles } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { createClient } from '@/lib/supabase/client'

function LoginForm() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const redirect = searchParams.get('redirect') || '/today'

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError(null)

    const supabase = createClient()

    // Demo mode: if Supabase isn't configured, go straight to app
    if (!supabase) {
      router.push(redirect)
      return
    }

    try {
      const { error: authError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (authError) {
        setError(authError.message)
        return
      }

      router.push(redirect)
      router.refresh()
    } catch {
      setError('An unexpected error occurred. Please try again.')
    } finally {
      setIsLoading(false)
    }
  }

  const handleDemoMode = () => {
    router.push('/today')
  }

  return (
    <div className="min-h-screen flex">
      {/* Left side - Form */}
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {/* Logo */}
          <div className="space-y-2">
            <Link href="/" className="inline-block">
              <h1 className="text-3xl font-bold tracking-tight">nexdo</h1>
            </Link>
            <p className="text-zinc-400">
              Welcome back. Your tasks are waiting.
            </p>
          </div>

          {/* Form */}
          <form onSubmit={handleLogin} className="space-y-4">
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
              autoComplete="current-password"
            />

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
              Sign in
              <ArrowRight className="ml-2 h-4 w-4" />
            </Button>
          </form>

          {/* Divider */}
          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-zinc-800" />
            </div>
            <div className="relative flex justify-center text-sm">
              <span className="px-2 bg-zinc-950 text-zinc-500">or</span>
            </div>
          </div>

          {/* Demo mode */}
          <Button
            type="button"
            variant="outline"
            className="w-full"
            size="lg"
            onClick={handleDemoMode}
          >
            <Sparkles className="mr-2 h-4 w-4 text-accent" />
            Try demo mode
          </Button>

          {/* Sign up link */}
          <p className="text-center text-sm text-zinc-400">
            Don&apos;t have an account?{' '}
            <Link
              href="/auth/signup"
              className="text-accent hover:text-accent/80 font-medium"
            >
              Sign up free
            </Link>
          </p>
        </div>
      </div>

      {/* Right side - Hero */}
      <div className="hidden lg:flex flex-1 bg-zinc-900 items-center justify-center p-12">
        <div className="max-w-lg space-y-6">
          <div className="w-16 h-16 rounded-2xl bg-accent/10 flex items-center justify-center">
            <Sparkles className="h-8 w-8 text-accent" />
          </div>
          <h2 className="text-4xl font-bold tracking-tight">
            Your to-do list just learned to think.
          </h2>
          <p className="text-xl text-zinc-400">
            Nexdo understands context, prioritizes intelligently, and actually
            does your tasks. Welcome to AI-native productivity.
          </p>
          <div className="flex items-center gap-4 pt-4">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4].map((i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-zinc-700 border-2 border-zinc-900"
                />
              ))}
            </div>
            <p className="text-sm text-zinc-400">
              Join 2,000+ power users
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-zinc-950" />}>
      <LoginForm />
    </Suspense>
  )
}
