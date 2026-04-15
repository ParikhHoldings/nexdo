import Link from 'next/link'

const sections = [
  {
    title: 'What we collect',
    body: 'Nexdo stores the information you provide to run the product: your account details, tasks, task metadata, and settings. If you use AI-powered features, the task content required to fulfill that feature may be processed by our infrastructure and model providers.',
  },
  {
    title: 'How we use it',
    body: 'We use your data to authenticate you, sync your tasks, generate briefings, prioritize work, run requested AI actions, process billing, and improve reliability and security. We do not sell your personal data.',
  },
  {
    title: 'Third-party services',
    body: 'Nexdo relies on trusted vendors such as Supabase for authentication and database infrastructure, Stripe for billing, and AI model providers for task parsing and agent-style features. Those providers process only what is needed to deliver the requested functionality.',
  },
  {
    title: 'Data retention',
    body: 'We retain your account data while your account is active and for a reasonable period afterward for security, compliance, and recovery purposes. You can request account deletion by contacting support.',
  },
  {
    title: 'Security',
    body: 'We use industry-standard safeguards for data in transit and at rest. No system is perfect, but protecting user data is a core operating requirement, not an afterthought.',
  },
  {
    title: 'Contact',
    body: 'Questions about privacy can be sent to hello@nexdo.ai.',
  },
]

export default function PrivacyPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-accent hover:text-accent/80">
          ← Back to Nexdo
        </Link>

        <header className="mt-6 mb-10">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Legal</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-100">Privacy Policy</h1>
          <p className="mt-4 text-zinc-400">
            Effective date: April 5, 2026. Plain English version: we collect the minimum needed to run Nexdo, improve reliability, and provide the AI features you ask for.
          </p>
        </header>

        <div className="space-y-8">
          {sections.map((section) => (
            <section key={section.title} className="rounded-2xl border border-zinc-800 bg-zinc-900/40 p-6">
              <h2 className="text-xl font-semibold text-zinc-100">{section.title}</h2>
              <p className="mt-3 leading-7 text-zinc-400">{section.body}</p>
            </section>
          ))}
        </div>
      </div>
    </main>
  )
}
