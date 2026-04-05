import Link from 'next/link'

const sections = [
  {
    title: 'Using Nexdo',
    body: 'You may use Nexdo only in compliance with applicable law. You are responsible for the content you create, import, or ask Nexdo to process.',
  },
  {
    title: 'Accounts and security',
    body: 'Keep your login credentials secure and notify us promptly if you believe your account has been compromised. You are responsible for activity that occurs under your account.',
  },
  {
    title: 'Billing',
    body: 'Paid plans renew automatically unless cancelled. Billing is processed by Stripe. If a payment fails, paid features may be limited until billing is resolved.',
  },
  {
    title: 'AI-generated output',
    body: 'Nexdo can generate summaries, drafts, and recommendations. Those outputs may be useful, but they are still machine-generated. You are responsible for reviewing anything important before relying on it or sending it onward.',
  },
  {
    title: 'Service availability',
    body: 'We aim for a reliable service, but availability is not guaranteed. Features may change as the product evolves.',
  },
  {
    title: 'Contact',
    body: 'Questions about these terms can be sent to hello@nexdo.ai.',
  },
]

export default function TermsPage() {
  return (
    <main className="min-h-screen bg-zinc-950 px-4 py-16 sm:px-6">
      <div className="mx-auto max-w-3xl">
        <Link href="/" className="text-sm text-accent hover:text-accent/80">
          ← Back to Nexdo
        </Link>

        <header className="mt-6 mb-10">
          <p className="text-sm uppercase tracking-[0.2em] text-zinc-500">Legal</p>
          <h1 className="mt-2 text-4xl font-bold tracking-tight text-zinc-100">Terms of Service</h1>
          <p className="mt-4 text-zinc-400">
            Effective date: April 5, 2026. This is the short version: use Nexdo responsibly, review AI output before acting on it, and do not abuse the service.
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
