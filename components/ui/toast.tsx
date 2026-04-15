'use client'

import { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react'
import { CheckCircle2, X, AlertCircle, Info } from 'lucide-react'
import { cn } from '@/lib/utils'

export type ToastKind = 'success' | 'error' | 'info'

export interface Toast {
  id: string
  kind: ToastKind
  title: string
  message?: string
  action?: {
    label: string
    href: string
  }
}

interface ToastContextValue {
  push: (toast: Omit<Toast, 'id'>) => void
  success: (title: string, message?: string) => void
  error: (title: string, message?: string) => void
  info: (title: string, message?: string) => void
}

const ToastContext = createContext<ToastContextValue | null>(null)

/**
 * Tiny toast system intentionally written without any dependency. Stores
 * an array of toasts in state and auto-dismisses after ~5s. It's good
 * enough for launch — we can swap in sonner/radix if we need clusters.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([])
  const timers = useRef<Record<string, ReturnType<typeof setTimeout>>>({})

  const remove = useCallback((id: string) => {
    setToasts((t) => t.filter((x) => x.id !== id))
    const timer = timers.current[id]
    if (timer) {
      clearTimeout(timer)
      delete timers.current[id]
    }
  }, [])

  const push = useCallback(
    (toast: Omit<Toast, 'id'>) => {
      const id = crypto.randomUUID()
      setToasts((t) => [...t, { ...toast, id }])
      timers.current[id] = setTimeout(() => remove(id), 5000)
    },
    [remove]
  )

  const api: ToastContextValue = {
    push,
    success: (title, message) => push({ kind: 'success', title, message }),
    error: (title, message) => push({ kind: 'error', title, message }),
    info: (title, message) => push({ kind: 'info', title, message }),
  }

  useEffect(() => {
    const handlers = timers.current
    return () => {
      Object.values(handlers).forEach(clearTimeout)
    }
  }, [])

  return (
    <ToastContext.Provider value={api}>
      {children}
      <div
        role="region"
        aria-label="Notifications"
        className="fixed bottom-4 right-4 z-[100] flex flex-col gap-2 pointer-events-none max-w-sm"
      >
        {toasts.map((t) => {
          const Icon =
            t.kind === 'success' ? CheckCircle2 : t.kind === 'error' ? AlertCircle : Info
          const tone =
            t.kind === 'success'
              ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-300'
              : t.kind === 'error'
              ? 'border-red-500/30 bg-red-500/10 text-red-300'
              : 'border-zinc-700 bg-zinc-900 text-zinc-200'
          return (
            <div
              key={t.id}
              className={cn(
                'pointer-events-auto rounded-xl border px-4 py-3 shadow-lg backdrop-blur-sm',
                tone
              )}
              role="status"
            >
              <div className="flex items-start gap-3">
                <Icon className="h-4 w-4 mt-0.5 flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium">{t.title}</p>
                  {t.message && (
                    <p className="text-xs text-zinc-400 mt-1 whitespace-pre-wrap break-words">
                      {t.message}
                    </p>
                  )}
                  {t.action && (
                    <a
                      href={t.action.href}
                      className="mt-2 inline-block text-xs font-medium underline"
                    >
                      {t.action.label}
                    </a>
                  )}
                </div>
                <button
                  onClick={() => remove(t.id)}
                  className="text-zinc-400 hover:text-zinc-200"
                  aria-label="Dismiss"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </ToastContext.Provider>
  )
}

export function useToast(): ToastContextValue {
  const ctx = useContext(ToastContext)
  if (!ctx) {
    // Fail-safe: never crash the UI. Developers see a console warning.
    if (typeof window !== 'undefined') {
      console.warn('useToast called outside ToastProvider — using console fallback.')
    }
    return {
      push: (t) => console.log('[toast]', t),
      success: (title, message) => console.log('[toast success]', title, message),
      error: (title, message) => console.error('[toast error]', title, message),
      info: (title, message) => console.log('[toast info]', title, message),
    }
  }
  return ctx
}
