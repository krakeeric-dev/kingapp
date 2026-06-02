import { NextResponse } from "next/server";
import { runServerCallAction, type CallActionBody } from "@/lib/serverTelephonyApi";

export async function POST(request: Request) {
  const body = (await request.json().catch(() => ({}))) as CallActionBody;
  const result = await runServerCallAction("answer-call", body);
  return NextResponse.json(result.data, { status: result.status });
}
