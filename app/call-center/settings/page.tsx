"use client";

import { FormEvent, useEffect, useState } from "react";
import { KeyRound, PhoneCall, Save, Server, ShieldCheck } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import { getAgents, type AgentPhoneType } from "@/lib/call-center-data";
import type { SessionUser } from "@/lib/auth";
import { getCompanyAgents } from "@/lib/call-center-operations";
import type { TelephonyProvider } from "@/lib/providerAdapters";
import {
  getDeviceMappings,
  getTelephonySettings,
  saveTelephonySettings,
  updateAgentPhoneType,
  type DeviceMapping,
  type TelephonySettings
} from "@/lib/telephonyService";

const providers: TelephonyProvider[] = ["Manual Mode", "Twilio", "3CX", "Asterisk / SIP"];
const phoneTypes: AgentPhoneType[] = ["Browser Softphone", "IP Desk Phone", "Mobile App", "Fixed Line"];
const webhookUrl = "https://kingapp-delta.vercel.app/api/call-center/incoming-call";

export default function CallCenterSettingsPage() {
  return (
    <CallCenterShell title="Telephony Settings" subtitle="Provider Integration Setup">
      {(user) => <SettingsContent user={user} />}
    </CallCenterShell>
  );
}

function SettingsContent({ user }: { user: SessionUser }) {
  const [settings, setSettings] = useState<TelephonySettings>({
    provider: "Manual Mode",
    providerName: "Manual Mode",
    apiKey: "",
    sipServer: "",
    webhookUrl,
    companyPhoneNumber: "+250 788 000 000",
    providerStatus: "Not Connected",
    defaultQueue: "Sales Queue",
    recordingEnabled: false,
    callPopupEnabled: true
  });
  const [agents, setAgents] = useState<ReturnType<typeof getAgents>>([]);
  const [devices, setDevices] = useState<DeviceMapping[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSettings(getTelephonySettings());
    setAgents(getCompanyAgents(user));
    setDevices(getDeviceMappings());
  }, [user]);

  function update(field: keyof TelephonySettings, value: string | boolean) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveTelephonySettings(settings);
    setMessage("Telephony settings saved.");
  }

  function updatePhoneType(agentId: string, phoneType: AgentPhoneType) {
    setAgents(updateAgentPhoneType(agentId, phoneType));
  }

  return (
    <div className="space-y-6">
      {message ? <Notice message={message} /> : null}
      {settings.providerStatus !== "Connected" ? (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm font-bold text-amber-900">
          Your phone rings physically, but KingApp will not detect calls until your provider sends calls to this webhook.
        </div>
      ) : null}

      <section className="rounded-lg border border-blue-200 bg-blue-50 p-5">
        <p className="text-xs font-black uppercase text-blue-700">Incoming Call Webhook URL</p>
        <p className="mt-2 break-all rounded-lg bg-white px-4 py-3 text-sm font-black text-slate-950 shadow-sm">
          {webhookUrl}
        </p>
      </section>

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-3 text-blue-700"><Server className="h-5 w-5" /></div>
          <div>
            <h3 className="text-lg font-black text-slate-950">Provider Settings</h3>
            <p className="text-sm font-semibold text-slate-500">Configuration for 3CX, Twilio, Asterisk, SIP, and manual mode.</p>
          </div>
        </div>
        <form className="grid gap-4 md:grid-cols-2 xl:grid-cols-3" onSubmit={save}>
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-slate-500">Provider</span>
            <select className="form-input" onChange={(event) => update("provider", event.target.value as TelephonyProvider)} value={settings.provider}>
              {providers.map((provider) => <option key={provider}>{provider}</option>)}
            </select>
          </label>
          <Field label="Provider Name" onChange={(value) => update("providerName", value)} value={settings.providerName} />
          <Field label={providerServerLabel(settings.provider)} onChange={(value) => update("sipServer", value)} value={settings.sipServer} />
          <Field label="Webhook URL" onChange={(value) => update("webhookUrl", value)} value={settings.webhookUrl} />
          <Field label="API Key" onChange={(value) => update("apiKey", value)} placeholder="Enter provider key" type="password" value={settings.apiKey} />
          <Field label={settings.provider === "Twilio" ? "Twilio Phone Number" : "Company Phone Number"} onChange={(value) => update("companyPhoneNumber", value)} value={settings.companyPhoneNumber} />
          <label className="block">
            <span className="mb-1 block text-xs font-black uppercase text-slate-500">Status</span>
            <select className="form-input" onChange={(event) => update("providerStatus", event.target.value)} value={settings.providerStatus ?? "Not Connected"}>
              <option value="Connected">Connected</option>
              <option value="Not Connected">Not Connected</option>
            </select>
          </label>
          <Field label={settings.provider === "Asterisk / SIP" || settings.provider === "3CX" ? "Extension Range" : "Default Queue"} onChange={(value) => update("defaultQueue", value)} value={settings.defaultQueue} />
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black">
            <input checked={settings.recordingEnabled} onChange={(event) => update("recordingEnabled", event.target.checked)} type="checkbox" />
            Recording Enabled
          </label>
          <label className="flex items-center gap-3 rounded-lg border border-slate-200 bg-slate-50 px-4 py-3 text-sm font-black">
            <input checked={settings.callPopupEnabled} onChange={(event) => update("callPopupEnabled", event.target.checked)} type="checkbox" />
            Call Popup Enabled
          </label>
          <button className="primary-button md:col-span-2 xl:col-span-3"><Save className="h-4 w-4" /> Save Settings</button>
        </form>
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        {secretCards(settings.provider).map((secret) => (
          <SecretCard key={secret.value} label={secret.label} value={secret.value} />
        ))}
      </section>

      <section className="grid gap-4 xl:grid-cols-2">
        <Panel title="Agent Extensions" icon={PhoneCall}>
          <div className="space-y-3">
            {agents.map((agent) => (
              <div className="grid gap-3 rounded-lg border border-slate-200 p-3 md:grid-cols-[1fr_100px_180px] md:items-center" key={agent.id}>
                <div>
                  <p className="font-black">{agent.name}</p>
                  <p className="text-sm font-semibold text-slate-500">Extension {agent.extension}</p>
                </div>
                <span className="status-badge border-blue-100 bg-blue-50 text-blue-700">{agent.status}</span>
                <select className="form-input" onChange={(event) => updatePhoneType(agent.id, event.target.value as AgentPhoneType)} value={agent.phoneType ?? "Browser Softphone"}>
                  {phoneTypes.map((type) => <option key={type}>{type}</option>)}
                </select>
              </div>
            ))}
          </div>
        </Panel>

        <Panel title="Fixed Phone / IP Phone Mapping" icon={ShieldCheck}>
          <div className="overflow-x-auto">
            <table className="data-table">
              <thead>
                <tr><th>Extension</th><th>Agent</th><th>Device Type</th><th>Device Name</th><th>Status</th><th>Last Seen</th></tr>
              </thead>
              <tbody>
                {devices.map((device) => (
                  <tr key={device.id}>
                    <td>{device.extension}</td>
                    <td className="font-bold text-slate-950">{device.agent}</td>
                    <td>{device.deviceType}</td>
                    <td>{device.deviceName}</td>
                    <td>{device.status}</td>
                    <td>{device.lastSeen}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Panel>
      </section>
    </div>
  );
}

function providerServerLabel(provider: TelephonyProvider) {
  if (provider === "Twilio") return "Account SID";
  if (provider === "3CX") return "PBX URL";
  if (provider === "Asterisk / SIP") return "PBX Host / SIP Trunk";
  return "SIP Server / Provider";
}

function secretCards(provider: TelephonyProvider) {
  if (provider === "Twilio") {
    return [
      { label: "Twilio Auth Token", value: "TWILIO_AUTH_TOKEN" },
      { label: "Twilio Webhook Secret", value: "TWILIO_WEBHOOK_SECRET" }
    ];
  }
  if (provider === "3CX") {
    return [
      { label: "3CX Client ID / API Key", value: "THREE_CX_CLIENT_ID" },
      { label: "3CX Client Secret", value: "THREE_CX_CLIENT_SECRET" },
      { label: "3CX Webhook Secret", value: "THREE_CX_WEBHOOK_SECRET" }
    ];
  }
  if (provider === "Asterisk / SIP") {
    return [
      { label: "Asterisk AMI Username", value: "ASTERISK_AMI_USERNAME" },
      { label: "Asterisk AMI Password", value: "ASTERISK_AMI_PASSWORD" },
      { label: "Asterisk Webhook Secret", value: "ASTERISK_WEBHOOK_SECRET" }
    ];
  }
  return [
    { label: "Provider API Key", value: "TELEPHONY_API_KEY" },
    { label: "Webhook Secret", value: "TELEPHONY_WEBHOOK_SECRET" }
  ];
}

function Panel({ children, icon: Icon, title }: { children: React.ReactNode; icon: typeof Server; title: string }) {
  return (
    <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
      <div className="mb-4 flex items-center gap-2">
        <Icon className="h-5 w-5 text-blue-700" />
        <h3 className="font-black text-slate-950">{title}</h3>
      </div>
      {children}
    </section>
  );
}

function Field({
  label,
  onChange,
  placeholder,
  type = "text",
  value
}: {
  label: string;
  onChange: (value: string) => void;
  placeholder?: string;
  type?: string;
  value: string;
}) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span>
      <input className="form-input" onChange={(event) => onChange(event.target.value)} placeholder={placeholder} type={type} value={value} />
    </label>
  );
}

function Notice({ message }: { message: string }) {
  return <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>;
}

function SecretCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-lg border border-amber-200 bg-amber-50 p-5">
      <div className="flex items-start gap-3">
        <div className="rounded-lg bg-white p-2 text-amber-700">
          <KeyRound className="h-5 w-5" />
        </div>
        <div>
          <p className="font-black text-slate-950">{label}</p>
          <p className="mt-1 text-sm font-semibold text-amber-800">
            Stored securely in environment variable: {value}
          </p>
          <p className="mt-2 text-xs font-bold text-slate-500">
            Secrets are never displayed or saved in browser localStorage.
          </p>
        </div>
      </div>
    </article>
  );
}
