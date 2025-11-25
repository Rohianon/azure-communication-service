import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // React Strict Mode double-invokes effects in dev, which makes
  // @azure/communication-react close the same AudioContext twice.
  reactStrictMode: false
};

export default nextConfig;
