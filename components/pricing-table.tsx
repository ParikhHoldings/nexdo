'use client'

import Link from 'next/link'
import { Check, Sparkles, Zap, Building2 } from 'lucide-react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'
import { PLAN_LIMITS } from '@/lib/stripe'

interface PricingTableProps {
  currentPlan?: string
  onSelectPlan?: (plan: string) => void
  showCurrentPlan?: boolean
  planLinks?: Partial<Record<string, string>>
  planCtaLabels?: Partial<Record<string, string>>
}

const plans = [
  {
    name: 'Free',
    key: 'free',
    price: 0,
    description: 'Perfect for getting started',
    icon: Sparkles,
    features: PLAN_LIMITS.free.features,
    limits: '25 tasks/month',
  },
  {
    name: 'Pro',
    key: 'pro',
    price: 15,
    description: 'For power users who want more',
    icon: Zap,
    features: PLAN_LIMITS.pro.features,
    limits: 'Unlimited tasks',
    popular: true,
  },
  {
    name: 'Power',
    key: 'power',
    price: 30,
    description: 'For AI power users',
    icon: Sparkles,
    features: PLAN_LIMITS.power.features,
    limits: 'Unlimited everything',
  },
  {
    name: 'Team',
    key: 'team',
    price: null,
    description: 'For organizations',
    icon: Building2,
    features: PLAN_LIMITS.team.features,
    limits: 'Custom limits',
    cta: 'Contact Sales',
  },
]

export function PricingTable({
  currentPlan,
  onSelectPlan,
  showCurrentPlan = true,
  planLinks = {},
  planCtaLabels = {},
}: PricingTableProps) {
  const handleSelect = (planKey: string) => {
    if (onSelectPlan) {
      onSelectPlan(planKey)
    }
  }

  return (
    <div className="w-full max-w-6xl mx-auto">
      {/* Plans grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {plans.map((plan) => {
          const Icon = plan.icon
          const isCurrentPlan = showCurrentPlan && currentPlan === plan.key
          const displayPrice = typeof plan.price === 'number' ? plan.price : null
          const ctaLabel = isCurrentPlan
            ? 'Current Plan'
            : planCtaLabels[plan.key] || plan.cta || (plan.price === 0 ? 'Get Started' : 'Upgrade')
          const ctaHref = planLinks[plan.key]
          const ctaClassName = cn(
            'inline-flex w-full items-center justify-center rounded-lg px-4 py-2 text-sm font-medium transition-all duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-zinc-950',
            plan.popular
              ? 'bg-accent text-white hover:bg-accent/90 focus:ring-accent'
              : 'bg-zinc-800 text-zinc-100 hover:bg-zinc-700 focus:ring-zinc-600'
          )
          const isExternalHref = ctaHref?.startsWith('mailto:')

          return (
            <div
              key={plan.key}
              className={cn(
                'relative bg-zinc-900/50 border rounded-xl p-6 flex flex-col',
                plan.popular
                  ? 'border-accent ring-1 ring-accent'
                  : 'border-zinc-800',
                isCurrentPlan && 'ring-1 ring-emerald-500'
              )}
            >
              {plan.popular && (
                <div className="absolute -top-3 left-1/2 -translate-x-1/2">
                  <span className="bg-accent text-white text-xs font-medium px-3 py-1 rounded-full">
                    Most Popular
                  </span>
                </div>
              )}

              {isCurrentPlan && (
                <div className="absolute -top-3 right-4">
                  <span className="bg-emerald-500 text-white text-xs font-medium px-3 py-1 rounded-full">
                    Current Plan
                  </span>
                </div>
              )}

              {/* Header */}
              <div className="mb-6">
                <div className="w-10 h-10 rounded-lg bg-zinc-800 flex items-center justify-center mb-4">
                  <Icon className="h-5 w-5 text-accent" />
                </div>
                <h3 className="text-lg font-semibold text-zinc-100">
                  {plan.name}
                </h3>
                <p className="text-sm text-zinc-500">{plan.description}</p>
              </div>

              {/* Price */}
              <div className="mb-6">
                {displayPrice !== null ? (
                  <div className="flex items-baseline gap-1">
                    <span className="text-3xl font-bold text-zinc-100">
                      ${displayPrice}
                    </span>
                    <span className="text-zinc-500">/mo</span>
                  </div>
                ) : (
                  <div className="text-2xl font-semibold text-zinc-100">
                    Custom
                  </div>
                )}
                <p className="text-xs text-zinc-500 mt-1">{plan.limits}</p>
              </div>

              {/* Features */}
              <ul className="space-y-3 mb-6 flex-1">
                {plan.features.map((feature) => (
                  <li key={feature} className="flex items-start gap-2">
                    <Check className="h-5 w-5 text-emerald-400 flex-shrink-0" />
                    <span className="text-sm text-zinc-300">{feature}</span>
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {ctaHref && !isCurrentPlan ? (
                isExternalHref ? (
                  <a href={ctaHref} className={ctaClassName}>
                    {ctaLabel}
                  </a>
                ) : (
                  <Link href={ctaHref} className={ctaClassName}>
                    {ctaLabel}
                  </Link>
                )
              ) : (
                <Button
                  variant={plan.popular ? 'primary' : 'secondary'}
                  className="w-full"
                  onClick={() => handleSelect(plan.key)}
                  disabled={isCurrentPlan || !onSelectPlan}
                >
                  {ctaLabel}
                </Button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
