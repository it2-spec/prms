import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["@prisma/adapter-pg", "@prisma/client", "@prisma/query-plan-executor", "pg"],
};

export default nextConfig;
