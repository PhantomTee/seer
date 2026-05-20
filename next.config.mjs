/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  typedRoutes: true,
  // Transpile the ESM-only Fairblock SDK so webpack can bundle it + its WASM
  transpilePackages: ['@fairblock/stabletrust'],
  images: {
    remotePatterns: [
      {
        protocol: 'https',
        hostname: 'images.unsplash.com'
      }
    ]
  },
  webpack: (config) => {
    // Enable async WebAssembly for @fairblock/stabletrust's WASM crypto module
    config.experiments = { ...config.experiments, asyncWebAssembly: true }
    return config
  }
}

export default nextConfig
