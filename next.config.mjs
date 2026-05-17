

const nextConfig = {
  // Enable strict mode for better React practices
  reactStrictMode: true,

  // Keep local mobile QA screenshots and fixed-footers unobscured.
  devIndicators: false,

  // Image optimization domains (add Supabase storage when needed)
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: '*.supabase.co',
      },
    ],
  },

  // Experimental features
  experimental: {
    // Enable server actions
    serverActions: {
      bodySizeLimit: '2mb',
    },
  },
}

export default nextConfig
