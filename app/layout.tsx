import type { Metadata, Viewport } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Nexdo - The AI-Native Task Manager',
    template: '%s | Nexdo',
  },
  description:
    'The last to-do app you\'ll ever need — because this one actually does your tasks. AI-native task management for humans and AI agents.',
  keywords: [
    'task manager',
    'AI',
    'productivity',
    'todo',
    'ai agents',
    'automation',
  ],
  authors: [{ name: 'Nexdo' }],
  creator: 'Nexdo',
  openGraph: {
    type: 'website',
    locale: 'en_US',
    url: 'https://nexdo.ai',
    title: 'Nexdo - The AI-Native Task Manager',
    description:
      'The last to-do app you\'ll ever need — because this one actually does your tasks.',
    siteName: 'Nexdo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexdo - The AI-Native Task Manager',
    description:
      'The last to-do app you\'ll ever need — because this one actually does your tasks.',
  },
  robots: {
    index: true,
    follow: true,
  },
  manifest: '/manifest.json',
}

export const viewport: Viewport = {
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#fafafa' },
    { media: '(prefers-color-scheme: dark)', color: '#09090b' },
  ],
  width: 'device-width',
  initialScale: 1,
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="en" className="dark">
      <head>
        <link rel="icon" href="/favicon.ico" sizes="any" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
      </head>
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
        {children}
      </body>
    </html>
  )
}
