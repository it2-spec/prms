import { NextRequest, NextResponse } from "next/server";
import { getSessionUser } from "@/lib/auth";
import fs from "fs";
import path from "path";

export const runtime = "nodejs";

const ALIAS_FILE = path.join(process.cwd(), "src", "data", "item-aliases.json");

function getAliases(): Record<string, string> {
  try {
    if (fs.existsSync(ALIAS_FILE)) {
      const data = fs.readFileSync(ALIAS_FILE, "utf-8");
      return JSON.parse(data || "{}");
    }
  } catch (e) {
    console.error("Error reading alias file:", e);
  }
  return {};
}

function saveAliases(aliases: Record<string, string>) {
  try {
    const dir = path.dirname(ALIAS_FILE);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(ALIAS_FILE, JSON.stringify(aliases, null, 2), "utf-8");
  } catch (e) {
    console.error("Error writing alias file:", e);
  }
}

// GET /api/import/reconcile-po/alias
export async function GET() {
  const aliases = getAliases();
  return NextResponse.json({ success: true, aliases });
}

// POST /api/import/reconcile-po/alias
// body: { incomingKey: string, targetItemDescription: string }
export async function POST(req: NextRequest) {
  try {
    const { user } = await getSessionUser();
    if (!user || user.role !== "PURCHASING") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const body = await req.json();
    const { incomingKey, targetItemDescription } = body;
    if (!incomingKey || !targetItemDescription) {
      return NextResponse.json({ error: "incomingKey and targetItemDescription are required" }, { status: 400 });
    }

    const aliases = getAliases();
    aliases[incomingKey.trim().toUpperCase()] = targetItemDescription.trim();
    saveAliases(aliases);

    return NextResponse.json({ success: true, aliases });
  } catch (err: any) {
    return NextResponse.json({ error: err.message }, { status: 500 });
  }
}
