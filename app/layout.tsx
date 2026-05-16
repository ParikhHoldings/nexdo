import type { Metadata, Viewport } from 'next'
import '@fontsource/inter'
import './globals.css'

export const metadata: Metadata = {
  title: {
    default: 'Nexdo - The AI-Native Task Manager',
    template: '%s | Nexdo',
  },
  description:
    'AI-native task management for humans and AI agents. Capture tasks, preserve context, prioritize work, and run bounded AI execution.',
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
      'Capture tasks, preserve context, prioritize work, and run bounded AI execution.',
    siteName: 'Nexdo',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'Nexdo - The AI-Native Task Manager',
    description:
      'Capture tasks, preserve context, prioritize work, and run bounded AI execution.',
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
        <link rel="icon" href="/icon.svg" type="image/svg+xml" />
      </head>
      <body className="min-h-screen bg-zinc-950 text-zinc-50 antialiased">
        {children}
      </body>
    </html>
  )
}
