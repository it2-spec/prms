import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import LoginForm from "./LoginForm";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string; msg?: string }>;
}) {
  const params = await searchParams;
  const session = await getSession();
  if (session) {
    redirect(roleHome(session.role));
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-50 px-4 py-12 sm:px-6 lg:px-8">
      <div className="max-w-md w-full space-y-8 bg-white p-8 rounded-2xl border border-slate-200 shadow-xl">
        <div className="flex flex-col items-center">
          <img
            className="h-16 w-auto object-contain drop-shadow-xs"
            src="/prms.png"
            alt="PRMS"
          />
          <h2 className="mt-6 text-center text-3xl font-extrabold text-slate-900">
            PRMS Portal
          </h2>
          <p className="mt-2 text-center text-sm text-slate-500">
            Procurement Receiving Management System
          </p>
        </div>
        <LoginForm msg={params.msg} />
      </div>
    </div>
  );
}

function roleHome(role: string) {
  return role === "PURCHASING" ? "/purchasing" : role === "WAREHOUSE" ? "/warehouse" : "/supplier";
}
