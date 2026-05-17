'use client'

import { useEffect } from 'react'
import { useUIStore } from '@/lib/store'

export function ThemeController() {
  const theme = useUIStore((state) => state.theme)

  useEffect(() => {
    const root = document.documentElement
    const body = document.body

    root.classList.toggle('dark', theme === 'dark')
    root.classList.toggle('light', theme === 'light')
    root.dataset.theme = theme

    body.classList.toggle('dark', theme === 'dark')
    body.classList.toggle('light', theme === 'light')
    body.dataset.theme = theme
  }, [theme])

  return null
}
