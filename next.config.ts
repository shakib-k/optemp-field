import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  // The app must work with no network in the garden. Service-worker
  // registration is wired in a later PR (next-pwa), disabled in dev.
};

export default nextConfig;
