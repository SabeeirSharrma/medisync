import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  transpilePackages: ["@medisync/shared"],
  output: "standalone",
};

export default nextConfig;
