/** @type {import('next').NextConfig} */
const nextConfig = {
  experimental: {
    serverComponentsExternalPackages: ['@prisma/client', 'bcryptjs'],
  },
  transpilePackages: ['date-fns', 'date-fns-tz'],
}

module.exports = nextConfig
