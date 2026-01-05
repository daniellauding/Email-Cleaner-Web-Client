/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  images: {
    domains: ['lh3.googleusercontent.com'],
  },
  // For Netlify deployment
  output: process.env.NETLIFY ? 'standalone' : undefined,
  trailingSlash: true,
}

module.exports = nextConfig