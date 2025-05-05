/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  eslint: {
    ignoreDuringBuilds: true, // Temporarily skip ESLint during builds
  },
};
module.exports = nextConfig;
