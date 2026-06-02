"use client";

import { useEffect, useState } from "react";
import { ArrowRightLeft, Delete, MicOff, Pause, Phone, PhoneCall, PhoneOff, UserRound } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import { getAgents } from "@/lib/call-center-data";
import { handleMockPhoneWebhook } from "@/lib/callWebhookHandler";
import { defaultSoftphoneState, mockSoftphoneAction, type SoftphoneState } from "@/lib/softphoneService";
import { appendTelephonyAudit } from "@/lib/telephonyAudit";
import { recognizeClientByPhone } from "@/lib/telephonyService";

const keys = ["1", "2", "3", "4", "5", "6", "7", "8", "9", "+", "0", "#"];

export default function SoftphonePage() {
  return (
    <CallCenterShell title="Browser Softphone" subtitle="Mock Calling Panel">
      <SoftphoneContent />
    </CallCenterShell>
  );
}

function SoftphoneContent() {
  const [state, setState] = useState<SoftphoneState>(defaultSoftphoneState);
  const [message, setMessage] = useState("");
  const [recognized, setRecognized] = useState<ReturnType<typeof recognizeClientByPhone>>(null);
  const [mode, setMode] = useState<"mock" | "real">("mock");

  useEffect(() => {
    setState((current) => ({
      ...current,
      agentStatus: getAgents().find((agent) => agent.status !== "Offline")?.status ?? "Available"
    }));
  }, []);

  function append(value: string) {
    setState((current) => ({ ...current, callerId: `${current.callerId}${value}` }));
  }

  function clear() {
    setState((current) => ({ ...current, callerId: current.callerId.slice(0, -1) }));
  }

  async function action(name: "dial" | "answer" | "hold" | "mute" | "transfer" | "end") {
    const response =
      mode === "real"
        ? await callBackendAction(name, state.callerId)
        : await mockSoftphoneAction(name, state.callerId);
    setMessage(response.message ?? "Call action completed.");
    appendTelephonyAudit("provider_action", "Softphone", `${mode} ${name} ${state.callerId || "mock-call"}`);

    if (name === "dial") {
      const client = recognizeClientByPhone(state.callerId);
      setRecognized(client);
      await handleMockPhoneWebhook({ event: "incoming_call", phone: state.callerId || "0788000001", agentName: "Alice Agent" });
      setState((current) => ({ ...current, status: "Dialing", timer: "00:00:04" }));
    }
    if (name === "answer") setState((current) => ({ ...current, status: "Connected", timer: "00:00:12" }));
    if (name === "hold") setState((current) => ({ ...current, status: "Hold" }));
    if (name === "mute") setState((current) => ({ ...current, status: "Muted" }));
    if (name === "transfer") setState((current) => ({ ...current, status: "Connected" }));
    if (name === "end") setState((current) => ({ ...current, status: "Ended", timer: "00:00:00" }));
  }

  return (
    <div className="grid gap-6 xl:grid-cols-[420px_1fr]">
      <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="mb-5 flex items-center justify-between">
          <div>
            <h3 className="text-xl font-black">KingApp Softphone</h3>
            <p className="text-sm font-semibold text-slate-500">Browser calling panel with mock and real-mode placeholders</p>
          </div>
          <span className="status-badge border-emerald-200 bg-emerald-50 text-emerald-700">{state.status}</span>
        </div>
        <div className="mb-4 grid grid-cols-2 rounded-lg bg-slate-100 p-1">
          <button className={`rounded-md px-3 py-2 text-sm font-black ${mode === "mock" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`} onClick={() => setMode("mock")} type="button">Mock Mode</button>
          <button className={`rounded-md px-3 py-2 text-sm font-black ${mode === "real" ? "bg-white text-blue-700 shadow-sm" : "text-slate-500"}`} onClick={() => setMode("real")} type="button">Real Mode</button>
        </div>
        <div className="rounded-xl bg-slate-950 p-5 text-white">
          <p className="text-xs font-bold uppercase text-slate-400">Caller ID</p>
          <p className="mt-2 min-h-10 text-3xl font-black">{state.callerId || "Enter number"}</p>
          <p className="mt-2 text-sm font-semibold text-blue-200">Timer: {state.timer} · Agent: {state.agentStatus}</p>
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          {keys.map((key) => (
            <button className="rounded-xl border border-slate-200 bg-slate-50 py-4 text-xl font-black hover:bg-blue-50" key={key} onClick={() => append(key)} type="button">{key}</button>
          ))}
        </div>
        <div className="mt-5 grid grid-cols-3 gap-3">
          <button className="primary-button" onClick={() => action("dial")} type="button"><PhoneCall className="h-4 w-4" /> Dial</button>
          <button className="secondary-button" onClick={() => action("answer")} type="button"><Phone className="h-4 w-4" /> Answer</button>
          <button className="secondary-button" onClick={clear} type="button"><Delete className="h-4 w-4" /> Clear</button>
          <button className="secondary-button" onClick={() => action("hold")} type="button"><Pause className="h-4 w-4" /> Hold</button>
          <button className="secondary-button" onClick={() => action("mute")} type="button"><MicOff className="h-4 w-4" /> Mute</button>
          <button className="secondary-button" onClick={() => action("transfer")} type="button"><ArrowRightLeft className="h-4 w-4" /> Transfer</button>
          <button className="danger-button col-span-3" onClick={() => action("end")} type="button"><PhoneOff className="h-4 w-4" /> End Call</button>
        </div>
      </section>

      <section className="space-y-4">
        {message ? <div className="rounded-lg border border-blue-200 bg-blue-50 px-4 py-3 text-sm font-bold text-blue-700">{message}</div> : null}
        <div className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-blue-50 p-3 text-blue-700"><UserRound className="h-5 w-5" /></div>
            <div>
              <h3 className="font-black">Client Auto Recognition</h3>
              <p className="text-sm font-semibold text-slate-500">Incoming phone numbers are matched against KingApp clients.</p>
            </div>
          </div>
          {recognized ? (
            <div className="mt-5 grid gap-3 rounded-lg bg-emerald-50 p-4 text-sm font-bold text-emerald-800 md:grid-cols-2">
              <p>Client: {recognized.clientName}</p>
              <p>Phone: {recognized.phone}</p>
              <p>Location: {recognized.area}</p>
              <p>Balance: {recognized.currentBalance.toLocaleString()} RWF</p>
            </div>
          ) : (
            <div className="mt-5 rounded-lg bg-amber-50 p-4">
              <p className="font-black text-amber-800">Unknown Caller Screen</p>
              <div className="mt-3 flex flex-wrap gap-2">
                <button className="primary-button" type="button">Create New Client</button>
                <button className="secondary-button" type="button">Save as Prospect</button>
                <button className="secondary-button" type="button">Schedule Callback</button>
                <button className="danger-button" type="button">Ignore</button>
              </div>
            </div>
          )}
        </div>
      </section>
    </div>
  );
}

async function callBackendAction(
  action: "dial" | "answer" | "hold" | "mute" | "transfer" | "end",
  phone: string
) {
  const routeMap = {
    dial: "/api/telephony/make-call",
    answer: "/api/telephony/answer-call",
    hold: "/api/telephony/hold-call",
    mute: "/api/telephony/hold-call",
    transfer: "/api/telephony/transfer-call",
    end: "/api/telephony/end-call"
  };
  const body =
    action === "dial"
      ? { phone }
      : { callId: "mock-call", target: action === "transfer" ? "Supervisor" : undefined };

  try {
    const response = await fetch(routeMap[action], {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body)
    });
    const payload = (await response.json()) as { message?: string; ok?: boolean };
    return {
      ok: response.ok && payload.ok !== false,
      message: payload.message ?? (response.ok ? "Backend call action completed." : "Call provider returned an error.")
    };
  } catch {
    return {
      ok: false,
      message: "Network error. Phone provider route could not be reached."
    };
  }
}
