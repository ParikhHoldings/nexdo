import Link from 'next/link'
import {
  Sparkles,
  ArrowRight,
  Brain,
  Zap,
  Target,
  Users,
  Clock,
  CheckCircle2,
  ChevronDown,
} from 'lucide-react'
import { PricingTable } from '@/components/pricing-table'

export default function LandingPage() {
  return (
    <>
      {/* Navigation */}
      <nav className="fixed top-0 left-0 right-0 z-50 bg-zinc-950/80 backdrop-blur-xl border-b border-zinc-800/50">
        <div className="max-w-6xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2">
              <Sparkles className="h-6 w-6 text-accent" />
              <span className="text-xl font-bold tracking-tight">nexdo</span>
            </Link>
            <div className="hidden md:flex items-center gap-8">
              <a href="#features" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
                Features
              </a>
              <a href="#how-it-works" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
                How it works
              </a>
              <a href="#pricing" className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors">
                Pricing
              </a>
            </div>
            <div className="flex items-center gap-4">
              <Link
                href="/auth/login"
                className="text-sm text-zinc-400 hover:text-zinc-100 transition-colors"
              >
                Sign in
              </Link>
              <Link
                href="/today"
                className="bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Try demo
              </Link>
            </div>
          </div>
        </div>
      </nav>

      {/* Hero Section */}
      <section className="pt-32 pb-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          {/* Badge */}
          <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-accent/10 border border-accent/20 mb-8">
            <Sparkles className="h-4 w-4 text-accent" />
            <span className="text-sm text-accent">Early-access task workspace</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-100 mb-6">
            Move tasks from capture to{' '}
            <span className="bg-gradient-to-r from-accent to-blue-400 bg-clip-text text-transparent">
              forward motion
            </span>
          </h1>

          {/* Subhead */}
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
            Nexdo turns messy task capture into structured priorities, daily
            briefings, and reviewable AI assistance for bounded work.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/today"
              className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-white font-medium px-8 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Try the demo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium px-8 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Create account
            </Link>
          </div>

          {/* Product trust */}
          <div className="mt-12 inline-flex items-center gap-3 rounded-full border border-zinc-800 bg-zinc-900/60 px-4 py-2 text-sm text-zinc-400">
            <CheckCircle2 className="h-4 w-4 text-emerald-400" />
            <span>Demo path: capture, prioritize, brief, and review bounded AI output.</span>
          </div>
        </div>

        {/* Scroll indicator */}
        <div className="flex justify-center mt-16">
          <a
            href="#problem"
            className="text-zinc-500 hover:text-zinc-300 transition-colors animate-bounce"
          >
            <ChevronDown className="h-6 w-6" />
          </a>
        </div>
      </section>

      {/* Problem Section */}
      <section id="problem" className="py-20 px-4 sm:px-6 bg-zinc-900/50">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100 mb-4">
              Static to-do lists lose the context
            </h2>
            <p className="text-lg text-zinc-400 max-w-2xl mx-auto">
              They strip the &quot;why&quot; from your tasks, leaving you with a lifeless
              list that doesn&apos;t understand context, urgency, or who&apos;s waiting.
            </p>
          </div>

          <div className="grid sm:grid-cols-3 gap-6">
            {[
              {
                title: 'No context',
                description:
                  'Tasks become generic items disconnected from their real-world importance.',
              },
              {
                title: 'Manual prioritization',
                description:
                  "You waste mental energy deciding what to do next instead of just doing it.",
              },
              {
                title: 'Little execution support',
                description:
                  'The app stores tasks but gives little help preparing the next move.',
              },
            ].map((problem) => (
              <div
                key={problem.title}
                className="bg-zinc-800/50 border border-zinc-700 rounded-xl p-6"
              >
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                  {problem.title}
                </h3>
                <p className="text-sm text-zinc-400">{problem.description}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100 mb-4">
              How Nexdo works
            </h2>
            <p className="text-lg text-zinc-400">
              Three steps from capture to reviewable output
            </p>
          </div>

          <div className="space-y-12">
            {[
              {
                step: '01',
                title: 'Capture naturally',
                description:
                  'Dump your thoughts in natural language. Tell us the context, the people involved, and why it matters.',
                icon: Brain,
              },
              {
                step: '02',
                title: 'Nexdo structures',
                description:
                  'Nexdo extracts key information, ranks tasks by due dates, priority, and context, and builds your daily plan.',
                icon: Target,
              },
              {
                step: '03',
                title: 'Agent assists',
                description:
                  'For research, drafting, and prep tasks, Nexdo can generate a useful starting point directly in the app.',
                icon: Zap,
              },
            ].map((item) => {
              const Icon = item.icon
              return (
                <div
                  key={item.step}
                  className="flex gap-6 items-start"
                >
                  <div className="flex-shrink-0">
                    <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                      <Icon className="h-6 w-6 text-accent" />
                    </div>
                  </div>
                  <div>
                    <span className="text-sm text-accent font-mono">
                      {item.step}
                    </span>
                    <h3 className="text-xl font-semibold text-zinc-100 mt-1 mb-2">
                      {item.title}
                    </h3>
                    <p className="text-zinc-400">{item.description}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Features Grid */}
      <section id="features" className="py-20 px-4 sm:px-6 bg-zinc-900/50">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100 mb-4">
              The core workflow Nexdo is proving first
            </h2>
            <p className="text-lg text-zinc-400">
              Launch-focused capabilities in the current product
            </p>
          </div>

          <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {[
              {
                icon: Brain,
                title: 'AI Task Parsing',
                description:
                  'Natural language input converted to structured, actionable tasks.',
              },
              {
                icon: Target,
                title: 'Smart Prioritization',
                description:
                  'Nexdo uses due dates, priority, and task context to rank your day.',
              },
              {
                icon: Clock,
                title: 'Daily Briefings',
                description:
                  'Start each day with a summary of priorities, quick wins, overdue work, and people waiting.',
              },
              {
                icon: Zap,
                title: 'Bounded AI Outputs',
                description:
                  'Research, draft, and prep tasks can get reviewable AI-generated starting points.',
              },
              {
                icon: Users,
                title: 'People Context',
                description:
                  'See who is involved, waiting, or relevant to the next step.',
              },
              {
                icon: CheckCircle2,
                title: 'Agent-Ready Access',
                description:
                  'Scoped API-key task access for MCP-style and ChatGPT Actions workflows.',
              },
            ].map((feature) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.title}
                  className="bg-zinc-800/30 border border-zinc-800 rounded-xl p-6 hover:border-zinc-700 transition-colors"
                >
                  <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center mb-4">
                    <Icon className="h-5 w-5 text-accent" />
                  </div>
                  <h3 className="text-lg font-semibold text-zinc-100 mb-2 flex items-center gap-2">
                    {feature.title}
                  </h3>
                  <p className="text-sm text-zinc-400">{feature.description}</p>
                </div>
              )
            })}
          </div>
        </div>
      </section>

      {/* Two Markets */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-5xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100 mb-4">
              Built for today&apos;s users and tomorrow&apos;s agents
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Everyday Users */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6">
                <Users className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-100 mb-4">
                Human Operators
              </h3>
              <p className="text-zinc-400 mb-6">
                Capture messy work in plain language and turn it into an
                organized, prioritized action plan.
              </p>
              <ul className="space-y-3">
                {[
                  'Natural language task input',
                  'Contextual daily briefings',
                  'Smart prioritization',
                  'Reviewable AI output',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400 flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>

            {/* AI Power Users */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center mb-6">
                <Zap className="h-6 w-6 text-accent" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-100 mb-4">
                Agent Workflows
              </h3>
              <p className="text-zinc-400 mb-6">
                A task layer for external AI tools to inspect and update
                through scoped, reviewable access.
              </p>
              <ul className="space-y-3">
                {[
                  'Power-plan API access',
                  'MCP-style tool definitions',
                  'ChatGPT Actions schema',
                  'Human-readable task state',
                  'Reviewable task changes',
                  'Scoped key permissions',
                ].map((item) => (
                  <li key={item} className="flex items-center gap-3 text-sm text-zinc-300">
                    <CheckCircle2 className="h-4 w-4 text-accent flex-shrink-0" />
                    {item}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* Pricing */}
      <section id="pricing" className="py-20 px-4 sm:px-6 bg-zinc-900/50">
        <div className="max-w-6xl mx-auto">
          <div className="text-center mb-16">
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100 mb-4">
              Simple, transparent pricing
            </h2>
            <p className="text-lg text-zinc-400">
              Start free. Upgrade when you need more power.
            </p>
          </div>

          <PricingTable
            showCurrentPlan={false}
            planLinks={{
              free: '/today',
              pro: '/auth/signup',
              power: '/auth/signup',
              team: 'mailto:sales@nexdo.ai?subject=Team Plan Inquiry',
            }}
            planCtaLabels={{
              free: 'Try demo',
              pro: 'Create account',
              power: 'Create account',
            }}
          />
        </div>
      </section>

      {/* FAQ */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-3xl mx-auto">
          <h2 className="text-3xl font-bold text-zinc-100 mb-12 text-center">
            Frequently asked questions
          </h2>

          <div className="space-y-6">
            {[
              {
                q: 'How is Nexdo different from other to-do apps?',
                a: 'Nexdo is built around structured task context. It parses natural-language capture, helps prioritize the day, and can generate bounded outputs for research, drafting, and prep tasks.',
              },
              {
                q: 'What are "agent executions"?',
                a: 'When a task is marked as research, draft, or prep, Nexdo can generate a working output such as a summary, email draft, or meeting prep brief. Users should still review and verify important results.',
              },
              {
                q: 'Can I connect my own AI agents?',
                a: 'Nexdo includes Power-plan API-key access, MCP-style tools, and a ChatGPT Actions OpenAPI surface for task access. External-agent use should start with scoped keys and reviewed task changes.',
              },
              {
                q: 'Is my data secure?',
                a: 'Nexdo is designed around Supabase auth, row-level security, and server-side API checks. Production security should still be verified before relying on it for sensitive workloads.',
              },
              {
                q: 'Can I use Nexdo offline?',
                a: 'Not yet. Nexdo currently requires an internet connection to sync tasks and run AI features.',
              },
            ].map((item) => (
              <div
                key={item.q}
                className="border-b border-zinc-800 pb-6"
              >
                <h3 className="text-lg font-semibold text-zinc-100 mb-2">
                  {item.q}
                </h3>
                <p className="text-zinc-400">{item.a}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 px-4 sm:px-6">
        <div className="max-w-4xl mx-auto text-center">
          <div className="bg-gradient-to-br from-accent/20 to-blue-500/10 border border-accent/20 rounded-2xl p-12">
            <h2 className="text-3xl sm:text-4xl font-bold text-zinc-100 mb-4">
              Ready to move tasks forward?
            </h2>
            <p className="text-lg text-zinc-400 mb-8 max-w-2xl mx-auto">
              Try a task manager built around context, prioritization, and
              bounded AI assistance.
            </p>
            <Link
              href="/today"
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-medium px-8 py-3 rounded-lg transition-colors"
            >
              Try the demo
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-sm text-zinc-500 mt-4">
              Demo available without a credit card.
            </p>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="py-12 px-4 sm:px-6 border-t border-zinc-800">
        <div className="max-w-6xl mx-auto">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div className="flex items-center gap-2">
              <Sparkles className="h-5 w-5 text-accent" />
              <span className="font-bold">nexdo</span>
            </div>
            <div className="flex items-center gap-6 text-sm text-zinc-500">
              <Link href="/privacy" className="hover:text-zinc-300 transition-colors">
                Privacy
              </Link>
              <Link href="/terms" className="hover:text-zinc-300 transition-colors">
                Terms
              </Link>
              <a href="mailto:hello@nexdo.ai" className="hover:text-zinc-300 transition-colors">
                Contact
              </a>
            </div>
            <p className="text-sm text-zinc-500">
              © {new Date().getFullYear()} Nexdo. All rights reserved.
            </p>
          </div>
        </div>
      </footer>
    </>
  )
}
