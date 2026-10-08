/** @type {import('next').NextConfig} */
const nextConfig = {
  transpilePackages: ['@mowaslaty/shared'],
  async rewrites() {
    const backend = process.env.BACKEND_URL || 'http://127.0.0.1:3001';
    return [
      {
        source: '/api/:path*',
        destination: `${backend}/api/:path*`,
      },
    ];
  },
};

export default nextConfig;
