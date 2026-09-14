import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "export",
  images: {
    unoptimized: true,
  },
  redirects: async () => [
    {
      source: "/tree",
      destination: "/",
      permanent: true,
    },
  ],
};

export default nextConfig;
