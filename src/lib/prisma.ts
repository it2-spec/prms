import { PrismaClient } from "@/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { Pool } from "pg";

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
  prismaVersion?: string;
  pgPool?: Pool;
};

const SCHEMA_VERSION = "2026-09-18-v11-outgoing-status";

function getPool(): Pool {
  if (!globalForPrisma.pgPool) {
    const isProduction = process.env.NODE_ENV === "production";
    const dbUrl = process.env.DATABASE_URL || "";
    const isSupabase =
      dbUrl.includes("supabase.co") || dbUrl.includes("pooler.supabase.com");
    // Strip sslmode from URI so pg honors ssl: { rejectUnauthorized: false }
    const sanitizedUrl = dbUrl.replace(/[?&]sslmode=[^&]+/g, "");

    globalForPrisma.pgPool = new Pool({
      connectionString: sanitizedUrl,
      max: isProduction ? 1 : 10,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 10000,
      ssl: isProduction || isSupabase ? { rejectUnauthorized: false } : undefined,
    });
    globalForPrisma.pgPool.on("error", (err) => {
      console.warn("[pgPool] Client error on idle connection:", err.message);
    });
  }
  return globalForPrisma.pgPool;
}

function createClient(): PrismaClient {
  const pool = getPool();
  const adapter = new PrismaPg(pool);
  return new PrismaClient({ adapter });
}

function getClient(): PrismaClient {
  if (!globalForPrisma.prisma || globalForPrisma.prismaVersion !== SCHEMA_VERSION) {
    if (globalForPrisma.prisma) {
      try {
        globalForPrisma.prisma.$disconnect();
      } catch {}
    }
    globalForPrisma.prisma = createClient();
    globalForPrisma.prismaVersion = SCHEMA_VERSION;
  }
  return globalForPrisma.prisma;
}

export const prisma = new Proxy({} as PrismaClient, {
  get(_, prop) {
    const client = getClient();
    const value = Reflect.get(client, prop, client);
    return typeof value === "function" ? value.bind(client) : value;
  },
});

