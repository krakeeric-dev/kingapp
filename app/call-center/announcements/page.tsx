"use client";

import { FormEvent, useEffect, useState } from "react";
import { Megaphone, Plus } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import {
  createAnnouncement,
  getAnnouncements,
  type AnnouncementPriority,
  type TeamAnnouncement
} from "@/lib/messageService";

export default function CallCenterAnnouncementsPage() {
  return (
    <CallCenterShell title="Announcements" subtitle="Team Broadcasts & Alerts">
      {(user) => <AnnouncementsContent user={user} />}
    </CallCenterShell>
  );
}

function AnnouncementsContent({ user }: { user: SessionUser }) {
  const [announcements, setAnnouncements] = useState<TeamAnnouncement[]>([]);
  const [form, setForm] = useState({
    title: "",
    body: "",
    priority: "Normal" as AnnouncementPriority,
    audience: "All" as TeamAnnouncement["audience"]
  });

  useEffect(() => {
    setAnnouncements(getAnnouncements());
  }, []);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    setAnnouncements(createAnnouncement(form, user));
    setForm({ title: "", body: "", priority: "Normal", audience: "All" });
  }

  const canCreate = user.role === "admin" || user.role === "manager";

  return (
    <div className="space-y-6">
      {announcements[0] ? (
        <section className="rounded-lg border border-amber-200 bg-amber-50 p-5 shadow-sm">
          <div className="flex items-start gap-3">
            <Megaphone className="mt-1 h-5 w-5 text-amber-700" />
            <div>
              <p className="text-xs font-black uppercase text-amber-700">Announcement Banner</p>
              <h3 className="mt-1 text-xl font-black text-slate-950">{announcements[0].title}</h3>
              <p className="mt-1 text-sm font-semibold text-slate-700">{announcements[0].body}</p>
            </div>
          </div>
        </section>
      ) : null}

      {canCreate ? (
        <form className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm" onSubmit={submit}>
          <h3 className="text-lg font-black text-slate-950">Send Team Announcement</h3>
          <div className="mt-4 grid gap-3 md:grid-cols-2">
            <Field label="Title">
              <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} />
            </Field>
            <Field label="Audience">
              <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value as TeamAnnouncement["audience"] }))} value={form.audience}>
                <option>All</option>
                <option>Managers</option>
                <option>Agents</option>
              </select>
            </Field>
            <Field label="Priority">
              <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as AnnouncementPriority }))} value={form.priority}>
                <option>Normal</option>
                <option>Important</option>
                <option>Urgent</option>
              </select>
            </Field>
            <Field label="Message">
              <textarea className="form-input min-h-24" onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} value={form.body} />
            </Field>
            <button className="primary-button md:col-span-2"><Plus className="h-4 w-4" /> Publish Announcement</button>
          </div>
        </form>
      ) : null}

      <section className="rounded-lg border border-slate-200 bg-white p-5 shadow-sm">
        <h3 className="text-lg font-black text-slate-950">Announcement History</h3>
        <div className="mt-4 grid gap-3">
          {announcements.map((announcement) => (
            <article className="rounded-lg border border-slate-200 p-4" key={announcement.id}>
              <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <h4 className="font-black text-slate-950">{announcement.title}</h4>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{announcement.body}</p>
                  <p className="mt-2 text-xs font-bold text-slate-400">By {announcement.createdBy} - {announcement.createdAt.slice(0, 16).replace("T", " ")}</p>
                </div>
                <div className="flex gap-2">
                  <span className="status-badge border-blue-200 bg-blue-50 text-blue-700">{announcement.audience}</span>
                  <span className={`status-badge ${announcement.priority === "Urgent" ? "border-red-200 bg-red-50 text-red-700" : "border-amber-200 bg-amber-50 text-amber-700"}`}>{announcement.priority}</span>
                </div>
              </div>
            </article>
          ))}
        </div>
      </section>
    </div>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span>{children}</label>;
}
