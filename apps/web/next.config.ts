import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  transpilePackages: ['@zxkit/ui', '@zxkit/qrix', '@zxkit/surface'],
  reactCompiler: true,
}

export default nextConfig
