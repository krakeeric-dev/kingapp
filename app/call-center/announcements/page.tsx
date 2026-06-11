"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import { AlertTriangle, Building2, Megaphone, Plus, Search, ShieldAlert, UsersRound } from "lucide-react";
import { CallCenterShell } from "@/components/CallCenterShell";
import type { SessionUser } from "@/lib/auth";
import {
  announcementAudiences,
  announcementPriorities,
  createAnnouncementCenterItem,
  getAnnouncementCenterItems,
  type AnnouncementAudience,
  type AnnouncementCenterItem
} from "@/lib/announcementService";
import type { AnnouncementPriority } from "@/lib/messageService";
import { getCompanies } from "@/lib/companies-data";

export default function CallCenterAnnouncementsPage() {
  return (
    <CallCenterShell title="Announcements" subtitle="Broadcasts, Alerts & Company Notices">
      {(user) => <AnnouncementsContent user={user} />}
    </CallCenterShell>
  );
}

function AnnouncementsContent({ user }: { user: SessionUser }) {
  const [announcements, setAnnouncements] = useState<AnnouncementCenterItem[]>([]);
  const [query, setQuery] = useState("");
  const [companyFilter, setCompanyFilter] = useState("All Companies");
  const companies = useMemo(() => getCompanies().map((company) => company.name), []);
  const [form, setForm] = useState({
    audience: "All users" as AnnouncementAudience,
    body: "",
    companyName: "",
    priority: "Normal" as AnnouncementPriority,
    title: ""
  });

  useEffect(() => {
    setAnnouncements(getAnnouncementCenterItems(user));
  }, [user]);

  const filteredAnnouncements = useMemo(() => {
    const search = query.trim().toLowerCase();
    return announcements.filter((announcement) => {
      const matchesText = !search || `${announcement.title} ${announcement.body} ${announcement.createdBy} ${announcement.audience}`.toLowerCase().includes(search);
      const matchesCompany = companyFilter === "All Companies" || announcement.companyName === companyFilter || announcement.audience !== "Specific company";
      return matchesText && matchesCompany;
    });
  }, [announcements, companyFilter, query]);

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!form.title.trim() || !form.body.trim()) return;
    createAnnouncementCenterItem({
      audience: form.audience,
      body: form.body,
      companyName: form.audience === "Specific company" ? form.companyName : undefined,
      priority: form.priority,
      title: form.title
    }, user);
    setAnnouncements(getAnnouncementCenterItems(user));
    setForm((current) => ({ ...current, body: "", priority: "Normal", title: "" }));
  }

  const canCreate = user.role === "admin" || user.role === "manager";
  const criticalCount = announcements.filter((announcement) => announcement.priority === "Critical" || announcement.priority === "Emergency").length;

  return (
    <div className="space-y-6">
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        <Kpi icon={Megaphone} label="Announcements" value={announcements.length.toLocaleString()} />
        <Kpi icon={ShieldAlert} label="Critical Alerts" value={criticalCount.toLocaleString()} />
        <Kpi icon={UsersRound} label="Audiences" value={announcementAudiences.length.toLocaleString()} />
        <Kpi icon={Building2} label="Companies" value={companies.length.toLocaleString()} />
      </div>

      {announcements[0] ? (
        <section className={`rounded-xl border p-5 shadow-sm ${priorityClass(announcements[0].priority, "banner")}`}>
          <div className="flex items-start gap-3">
            <Megaphone className="mt-1 h-5 w-5" />
            <div>
              <p className="text-xs font-black uppercase">Latest Announcement</p>
              <h3 className="mt-1 text-2xl font-black">{announcements[0].title}</h3>
              <p className="mt-1 text-sm font-semibold">{announcements[0].body}</p>
            </div>
          </div>
        </section>
      ) : null}

      {canCreate ? (
        <form className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm" onSubmit={submit}>
          <div className="flex items-center justify-between gap-3">
            <div>
              <h3 className="text-lg font-black text-slate-950">Create Announcement</h3>
              <p className="text-sm font-semibold text-slate-500">Send notices to teams or a specific company.</p>
            </div>
            <button className="primary-button"><Plus className="h-4 w-4" /> Publish</button>
          </div>
          <div className="mt-5 grid gap-4 lg:grid-cols-2">
            <Field label="Title">
              <input className="form-input" onChange={(event) => setForm((current) => ({ ...current, title: event.target.value }))} value={form.title} />
            </Field>
            <Field label="Priority">
              <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, priority: event.target.value as AnnouncementPriority }))} value={form.priority}>
                {announcementPriorities.map((priority) => <option key={priority}>{priority}</option>)}
              </select>
            </Field>
            <Field label="Audience">
              <select className="form-input" onChange={(event) => setForm((current) => ({ ...current, audience: event.target.value as AnnouncementAudience }))} value={form.audience}>
                {announcementAudiences.map((audience) => <option key={audience}>{audience}</option>)}
              </select>
            </Field>
            <Field label="Company">
              <select className="form-input" disabled={form.audience !== "Specific company"} onChange={(event) => setForm((current) => ({ ...current, companyName: event.target.value }))} value={form.companyName}>
                {companies.map((company) => <option key={company}>{company}</option>)}
              </select>
            </Field>
            <Field label="Description">
              <textarea className="form-input min-h-28" onChange={(event) => setForm((current) => ({ ...current, body: event.target.value }))} value={form.body} />
            </Field>
          </div>
        </form>
      ) : null}

      <section className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
          <div>
            <h3 className="text-lg font-black text-slate-950">Announcement Center</h3>
            <p className="text-sm font-semibold text-slate-500">Priority colors, audiences, read counts, and company-wide notices.</p>
          </div>
          <div className="grid gap-2 sm:grid-cols-2">
            <label className="relative block">
              <Search className="absolute left-3 top-3 h-4 w-4 text-slate-400" />
              <input className="form-input pl-9" onChange={(event) => setQuery(event.target.value)} placeholder="Search announcements" value={query} />
            </label>
            <select className="form-input" onChange={(event) => setCompanyFilter(event.target.value)} value={companyFilter}>
              <option>All Companies</option>
              {companies.map((company) => <option key={company}>{company}</option>)}
            </select>
          </div>
        </div>

        <div className="mt-5 grid gap-3">
          {filteredAnnouncements.map((announcement) => (
            <article className="rounded-xl border border-slate-200 p-4" key={announcement.id}>
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className={`rounded-full px-3 py-1 text-xs font-black ${priorityClass(announcement.priority, "badge")}`}>{announcement.priority}</span>
                    <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-black text-blue-700">{announcement.audience}</span>
                    {announcement.companyName ? <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-black text-slate-600">{announcement.companyName}</span> : null}
                  </div>
                  <h4 className="mt-3 text-lg font-black text-slate-950">{announcement.title}</h4>
                  <p className="mt-1 text-sm font-semibold text-slate-600">{announcement.body}</p>
                  <p className="mt-3 text-xs font-bold text-slate-400">By {announcement.createdBy} - {announcement.createdAt.slice(0, 16).replace("T", " ")}</p>
                </div>
                <div className="rounded-xl bg-slate-50 p-4 text-center">
                  <p className="text-2xl font-black text-slate-950">{announcement.readCount.toLocaleString()}</p>
                  <p className="text-xs font-black uppercase text-slate-500">Read count</p>
                </div>
              </div>
            </article>
          ))}
          {!filteredAnnouncements.length ? (
            <div className="rounded-xl border border-dashed border-slate-300 p-8 text-center">
              <AlertTriangle className="mx-auto h-6 w-6 text-slate-400" />
              <p className="mt-2 font-black text-slate-700">No announcements match this filter.</p>
            </div>
          ) : null}
        </div>
      </section>
    </div>
  );
}

function priorityClass(priority: AnnouncementPriority, mode: "badge" | "banner") {
  if (priority === "Emergency") return mode === "badge" ? "bg-red-600 text-white" : "border-red-200 bg-red-50 text-red-800";
  if (priority === "Critical") return mode === "badge" ? "bg-red-100 text-red-700" : "border-red-200 bg-red-50 text-red-800";
  if (priority === "Important" || priority === "Urgent") return mode === "badge" ? "bg-amber-100 text-amber-700" : "border-amber-200 bg-amber-50 text-amber-800";
  return mode === "badge" ? "bg-emerald-50 text-emerald-700" : "border-emerald-200 bg-emerald-50 text-emerald-800";
}

function Kpi({ icon: Icon, label, value }: { icon: typeof Megaphone; label: string; value: string }) {
  return (
    <article className="rounded-xl border border-slate-200 bg-white p-5 shadow-sm">
      <div className="flex items-start justify-between gap-3">
        <div>
          <p className="text-xs font-black uppercase text-slate-500">{label}</p>
          <p className="mt-3 text-3xl font-black text-slate-950">{value}</p>
        </div>
        <div className="rounded-xl bg-blue-50 p-3 text-blue-700"><Icon className="h-5 w-5" /></div>
      </div>
    </article>
  );
}

function Field({ children, label }: { children: React.ReactNode; label: string }) {
  return <label className="block"><span className="mb-1 block text-xs font-black uppercase text-slate-500">{label}</span>{children}</label>;
}
