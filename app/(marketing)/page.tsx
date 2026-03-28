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
  Star,
  ChevronDown,
  Play,
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
                href="/auth/signup"
                className="bg-accent hover:bg-accent/90 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors"
              >
                Get Started Free
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
            <span className="text-sm text-accent">AI-Native Task Management</span>
          </div>

          {/* Headline */}
          <h1 className="text-4xl sm:text-5xl lg:text-6xl font-bold tracking-tight text-zinc-100 mb-6">
            Your to-do list just{' '}
            <span className="bg-gradient-to-r from-accent to-blue-400 bg-clip-text text-transparent">
              learned to think
            </span>
          </h1>

          {/* Subhead */}
          <p className="text-xl text-zinc-400 max-w-2xl mx-auto mb-10">
            Nexdo is the AI-native task manager that understands context,
            prioritizes intelligently, and actually does your tasks.
          </p>

          {/* CTAs */}
          <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link
              href="/auth/signup"
              className="w-full sm:w-auto bg-accent hover:bg-accent/90 text-white font-medium px-8 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <Link
              href="/today"
              className="w-full sm:w-auto bg-zinc-800 hover:bg-zinc-700 text-zinc-100 font-medium px-8 py-3 rounded-lg transition-colors flex items-center justify-center gap-2"
            >
              <Play className="h-4 w-4" />
              Try Demo
            </Link>
          </div>

          {/* Social proof */}
          <div className="mt-12 flex items-center justify-center gap-8">
            <div className="flex -space-x-2">
              {[1, 2, 3, 4, 5].map((i) => (
                <div
                  key={i}
                  className="w-8 h-8 rounded-full bg-zinc-700 border-2 border-zinc-900"
                />
              ))}
            </div>
            <div className="text-left">
              <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((i) => (
                  <Star
                    key={i}
                    className="h-4 w-4 text-amber-400 fill-amber-400"
                  />
                ))}
              </div>
              <p className="text-sm text-zinc-400">
                Loved by 2,000+ power users
              </p>
            </div>
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
              Traditional to-do apps are broken
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
                title: 'Zero execution',
                description:
                  'The app shows tasks but does nothing to help complete them.',
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
              Three steps to AI-powered productivity
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
                title: 'AI organizes',
                description:
                  'Our AI parses your input, extracts key information, sets smart priorities, and builds your daily plan.',
                icon: Target,
              },
              {
                step: '03',
                title: 'Agent executes',
                description:
                  'For research, drafting, and prep tasks — our agents do the work and deliver results right in the app.',
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
              Everything you need to get things done
            </h2>
            <p className="text-lg text-zinc-400">
              Features designed for modern productivity
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
                  'AI analyzes urgency, dependencies, and context to rank your tasks.',
              },
              {
                icon: Clock,
                title: 'Daily Briefings',
                description:
                  'Start each day with an AI-generated summary of what matters most.',
              },
              {
                icon: Zap,
                title: 'Agent Execution',
                description:
                  'Research, draft, and prep tasks completed automatically.',
              },
              {
                icon: Users,
                title: 'People Context',
                description:
                  "Track who's waiting on what and never drop the ball.",
              },
              {
                icon: CheckCircle2,
                title: 'Agent Integrations',
                description:
                  'Connect Claude, ChatGPT, and other AI agents to your task layer.',
                comingSoon: true,
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
                    {feature.comingSoon && (
                      <span className="text-xs bg-zinc-700 text-zinc-400 px-2 py-0.5 rounded-full">
                        Soon
                      </span>
                    )}
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
              Built for two kinds of people
            </h2>
          </div>

          <div className="grid md:grid-cols-2 gap-8">
            {/* Everyday Users */}
            <div className="bg-gradient-to-br from-zinc-900 to-zinc-900/50 border border-zinc-800 rounded-2xl p-8">
              <div className="w-12 h-12 rounded-xl bg-emerald-500/10 flex items-center justify-center mb-6">
                <Users className="h-6 w-6 text-emerald-400" />
              </div>
              <h3 className="text-2xl font-bold text-zinc-100 mb-4">
                Everyday Users
              </h3>
              <p className="text-zinc-400 mb-6">
                A beautiful app that feels like magic. Dump your thoughts, and
                watch them transform into an organized, prioritized action plan.
              </p>
              <ul className="space-y-3">
                {[
                  'Natural language task input',
                  'AI-powered daily briefings',
                  'Smart prioritization',
                  'Beautiful, minimal design',
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
                AI Power Users
              </h3>
              <p className="text-zinc-400 mb-6">
                A unified task layer that all your AI agents can write to.
                Claude, OpenClaw, ChatGPT — they all connect here.
              </p>
              <ul className="space-y-3">
                {[
                  'API access for agents',
                  'MCP protocol support (coming)',
                  'Agent execution pipeline',
                  'Cross-platform sync',
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

          <PricingTable />
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
                a: 'Nexdo is AI-native from the ground up. Traditional apps just store tasks — we understand them. Our AI parses context, prioritizes intelligently, and can actually execute certain task types like research and drafting.',
              },
              {
                q: 'What are "agent executions"?',
                a: 'When you mark a task as research, draft, or prep, our AI agents can automatically complete the work. For example, a research task might result in a summary with key findings, sources, and recommended actions.',
              },
              {
                q: 'Can I connect my own AI agents?',
                a: "We're building MCP (Model Context Protocol) support that will let you connect any compatible AI agent — Claude, ChatGPT, and others — directly to your Nexdo task layer.",
              },
              {
                q: 'Is my data secure?',
                a: 'Absolutely. We use Supabase for database and auth, which provides enterprise-grade security. Your data is encrypted at rest and in transit. We never share or sell your data.',
              },
              {
                q: 'Can I use Nexdo offline?',
                a: "We're working on PWA support with offline sync. For now, Nexdo requires an internet connection to sync tasks and run AI features.",
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
              Ready to actually get things done?
            </h2>
            <p className="text-lg text-zinc-400 mb-8 max-w-2xl mx-auto">
              Join thousands of users who&apos;ve upgraded their productivity with
              AI-native task management.
            </p>
            <Link
              href="/auth/signup"
              className="inline-flex items-center gap-2 bg-accent hover:bg-accent/90 text-white font-medium px-8 py-3 rounded-lg transition-colors"
            >
              Get Started Free
              <ArrowRight className="h-4 w-4" />
            </Link>
            <p className="text-sm text-zinc-500 mt-4">
              No credit card required • Free tier forever
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
