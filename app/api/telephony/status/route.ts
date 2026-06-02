import { NextResponse } from "next/server";
import { runServerCallAction, type CallActionBody } from "@/lib/serverTelephonyApi";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CallActionBody;
  const result = await runServerCallAction("status", body);
  return NextResponse.json(result.data, { status: result.status });
}

export async function GET() {
  return NextResponse.json({
    ok: true,
    provider: process.env.TELEPHONY_PROVIDER ?? "mock",
    mode: process.env.TELEPHONY_PROVIDER ? "configured" : "mock",
    message: "Telephony status route is available."
  });
}
