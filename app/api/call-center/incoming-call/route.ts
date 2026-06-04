import { NextResponse } from "next/server";
import {
  addIncomingProviderCall,
  getIncomingProviderCalls,
  type IncomingProviderCall
} from "@/lib/call-provider-events";

export async function GET() {
  return NextResponse.json({
    ok: true,
    calls: getIncomingProviderCalls()
  });
}

export async function POST(request: Request) {
  let payload: Partial<IncomingProviderCall>;

  try {
    payload = (await request.json()) as Partial<IncomingProviderCall>;
  } catch {
    return NextResponse.json(
      { ok: false, message: "Invalid incoming call payload." },
      { status: 400 }
    );
  }

  if (!payload.callerNumber || !payload.calledNumber) {
    return NextResponse.json(
      { ok: false, message: "callerNumber and calledNumber are required." },
      { status: 400 }
    );
  }

  const call = addIncomingProviderCall(payload);

  return NextResponse.json({
    ok: true,
    message: "Incoming call received.",
    call
  });
}
