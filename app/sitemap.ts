import type { MetadataRoute } from 'next'

const DEFAULT_SITE_URL = 'https://nexdo.ai'

function siteUrl() {
  return (process.env.NEXT_PUBLIC_APP_URL || DEFAULT_SITE_URL).replace(/\/$/, '')
}

export default function sitemap(): MetadataRoute.Sitemap {
  const baseUrl = siteUrl()
  const lastModified = new Date()

  return [
    {
      url: `${baseUrl}/`,
      lastModified,
      changeFrequency: 'weekly',
      priority: 1,
    },
    {
      url: `${baseUrl}/privacy`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
    {
      url: `${baseUrl}/terms`,
      lastModified,
      changeFrequency: 'monthly',
      priority: 0.3,
    },
  ]
}
