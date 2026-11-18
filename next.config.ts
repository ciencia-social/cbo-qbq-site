import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  outputFileTracingIncludes: {
    "/api/v1/[[...caminho]]": ["./data/cbo-qbq.sqlite"],
    "/mcp": ["./data/cbo-qbq.sqlite"],
  },
};

export default nextConfig;
