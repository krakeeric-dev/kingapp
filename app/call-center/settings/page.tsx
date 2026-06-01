"use client";

import { FormEvent, useEffect, useState } from "react";
import { PhoneCall, Save, Server, ShieldCheck } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import { getAgents, type AgentPhoneType } from "@/lib/call-center-data";
import type { TelephonyProvider } from "@/lib/providerAdapters";
import {
  getDeviceMappings,
  getTelephonySettings,
  saveTelephonySettings,
  updateAgentPhoneType,
  type DeviceMapping,
  type TelephonySettings
} from "@/lib/telephonyService";

const providers: TelephonyProvider[] = ["3CX", "Twilio", "Asterisk / FreePBX", "SIP Provider", "Manual Mode"];
const phoneTypes: AgentPhoneType[] = ["Browser Softphone", "IP Desk Phone", "Mobile App", "Fixed Line"];

export default function CallCenterSettingsPage() {
  return (
    <CallCenterShell title="Telephony Settings" subtitle="Provider Integration Setup">
      <SettingsContent />
    </CallCenterShell>
  );
}

function SettingsContent() {
  const [settings, setSettings] = useState<TelephonySettings>({
    provider: "Manual Mode",
    providerName: "Manual Mode",
    apiKey: "",
    sipServer: "",
    webhookUrl: "/api/mock-phone-webhook",
    companyPhoneNumber: "+250 788 000 000",
    defaultQueue: "Sales Queue",
    recordingEnabled: false,
    callPopupEnabled: true
  });
  const [agents, setAgents] = useState<ReturnType<typeof getAgents>>([]);
  const [devices, setDevices] = useState<DeviceMapping[]>([]);
  const [message, setMessage] = useState("");

  useEffect(() => {
    setSettings(getTelephonySettings());
    setAgents(getAgents());
    setDevices(getDeviceMappings());
  }, []);

  function update(field: keyof TelephonySettings, value: string | boolean) {
    setSettings((current) => ({ ...current, [field]: value }));
  }

  function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    saveTelephonySettings(settings);
    setMessage("Telephony settings saved in mock mode.");
  }

  function updatePhoneType(agentId: string, phoneType: AgentPhoneType) {
    setAgents(updateAgentPhoneType(agentId, phoneType));
  }

  return (
    <div className="space-y-6">
      {message ? <Notice message={message} /> : null}
      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <div className="mb-5 flex items-center gap-3">
          <div className="rounded-lg bg-blue-50 p-3 text-blue-700"><Server className="h-5 w-5" /></div>
          <div>
            <h3 className="text-lg font-black text-slate-950">Provider Settings</h3>
            <p className="text-sm font-semibold text-slate-500">Mock configuration for 3CX, Twilio, Asterisk, SIP, and manual mode.</p>
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
          <Field label="API Key" onChange={(value) => update("apiKey", value)} value={settings.apiKey} />
          <Field label="SIP Server" onChange={(value) => update("sipServer", value)} value={settings.sipServer} />
          <Field label="Webhook URL" onChange={(value) => update("webhookUrl", value)} value={settings.webhookUrl} />
          <Field label="Company Phone Number" onChange={(value) => update("companyPhoneNumber", value)} value={settings.companyPhoneNumber} />
          <Field label="Default Queue" onChange={(value) => update("defaultQueue", value)} value={settings.defaultQueue} />
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

function Field({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return (
    <label className="block">
      <span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span>
      <input className="form-input" onChange={(event) => onChange(event.target.value)} value={value} />
    </label>
  );
}

function Notice({ message }: { message: string }) {
  return <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm font-bold text-emerald-700">{message}</div>;
}
