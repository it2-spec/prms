import "server-only";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";
import type { RoleName } from "@/generated/prisma/client";

const SESSION_COOKIE = "prms_session";
const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret");

export type SessionUser = {
  id: string;
  username: string;
  name: string;
  role: RoleName;
  approvalLevel?: number; // 0=none, 1=Manager Purchasing, 2=Presdir
  supplierId?: string | null;
  warehouseId?: string | null;
};


export async function createSession(user: SessionUser) {
  const token = await new SignJWT({ ...user })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime("12h")
    .sign(secret);

  const cookieStore = await cookies();
  cookieStore.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge: 60 * 60 * 12,
  });
}

export async function destroySession() {
  const cookieStore = await cookies();
  cookieStore.delete(SESSION_COOKIE);
}

export async function getSession(): Promise<SessionUser | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  try {
    const { payload } = await jwtVerify(token, secret);
    return payload as unknown as SessionUser;
  } catch {
    return null;
  }
}

export async function getSessionUser(): Promise<{
  user: SessionUser | null;
  dbUser: Awaited<ReturnType<typeof loadDbUser>> | null;
}> {
  const session = await getSession();
  if (!session) return { user: null, dbUser: null };
  const dbUser = await loadDbUser(session.id);
  if (!dbUser || !dbUser.isActive) return { user: null, dbUser: null };
  return {
    user: {
      ...session,
      approvalLevel: dbUser.approvalLevel ?? session.approvalLevel ?? 0,
      name: dbUser.name,
      role: dbUser.role.name,
    },
    dbUser,
  };
}

async function loadDbUser(id: string) {
  return prisma.user.findUnique({
    where: { id },
    include: { role: true, supplier: true, warehouse: true },
  });
}

export function requireRole(
  sessionUser: SessionUser | null,
  allowed: RoleName[],
): sessionUser is SessionUser {
  if (!sessionUser) return false;
  return allowed.includes(sessionUser.role);
}
