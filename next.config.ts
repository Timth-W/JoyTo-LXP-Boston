import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  devIndicators: false,
  // ESLint is not configured yet; type safety is enforced by `npm run typecheck`.
  eslint: { ignoreDuringBuilds: true },
};

export default nextConfig;
