import { NextResponse, type NextRequest } from "next/server";
import { jwtVerify } from "jose";

const secret = new TextEncoder().encode(process.env.AUTH_SECRET || "dev-secret");

const publicPaths = ["/login", "/verify", "/manifest", "/sw.js"];

const roleHome: Record<string, string> = {
  PURCHASING: "/purchasing",
  WAREHOUSE: "/warehouse",
  SUPPLIER: "/supplier",
};

export async function proxy(request: NextRequest) {
  const { pathname } = request.nextUrl;
  const isPublic =
    publicPaths.some((p) => pathname.startsWith(p)) ||
    pathname.endsWith(".webmanifest") ||
    pathname.endsWith(".json");

  const token = request.cookies.get("prms_session")?.value;
  let payload: { role?: string } | null = null;
  if (token) {
    try {
      const { payload: p } = await jwtVerify(token, secret);
      payload = p as { role?: string };
    } catch {
      payload = null;
    }
  }

  // Not logged in -> go to login
  if (!payload && !isPublic) {
    const url = new URL("/login", request.url);
    return NextResponse.redirect(url);
  }

  // Logged in visiting login -> go to role home
  if (payload && pathname === "/login") {
    const url = new URL(payload.role ? (roleHome[payload.role] ?? "/dashboard") : "/dashboard", request.url);
    return NextResponse.redirect(url);
  }

  // Role-based access for protected sections
  if (payload?.role) {
    const sections: Record<string, string[]> = {
      PURCHASING: ["/purchasing", "/reports", "/dashboard"],
      WAREHOUSE: ["/warehouse", "/dashboard"],
      SUPPLIER: ["/supplier", "/dashboard"],
    };
    const allowed = sections[payload.role] ?? [];
    const inAllowed = allowed.some((s) => pathname.startsWith(s));
    if (!isPublic && !inAllowed) {
      const url = new URL(roleHome[payload.role] ?? "/dashboard", request.url);
      return NextResponse.redirect(url);
    }

  }

  return NextResponse.next();
}

export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|cuba|favicon.ico|.*\\.(?:png|jpg|jpeg|svg|gif|css|js|woff2?|ttf|eot|ico|map|webmanifest|json)$).*)",
  ],
};
