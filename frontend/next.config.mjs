/** @type {import('next').NextConfig} */
const nextConfig = {
  output: 'export',
  reactStrictMode: true,
  webpack: (config, { isServer }) => {
    // Web Worker support
    if (!isServer) {
      config.output.globalObject = 'self';
    }

    return config;
  },
};

export default nextConfig;
