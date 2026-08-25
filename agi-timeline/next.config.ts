import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  async redirects() {
    return [
      // The Map used to live at /canvas before it became the home page.
      { source: "/canvas", destination: "/", permanent: true },
    ];
  },
};

export default nextConfig;
