/** @type {import('next').NextConfig} */
const nextConfig = {
  serverExternalPackages: ['@prisma/client', 'bcryptjs'],
  transpilePackages: ['date-fns', 'date-fns-tz'],
}

module.exports = nextConfig
