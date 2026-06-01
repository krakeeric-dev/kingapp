"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, LogIn, ShieldCheck, UserRound } from "lucide-react";
import { mockUsers, roleLabels } from "@/lib/auth";
import { getSession, saveSession } from "@/lib/storage";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if ("serviceWorker" in navigator && isLocalhost()) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((registrations) =>
          Promise.all(registrations.map((registration) => registration.unregister()))
        )
        .catch(() => undefined);
    }

    if (getSession()) {
      router.replace("/dashboard");
    }
  }, [router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    try {
      const user = await withTimeout(
        Promise.resolve().then(() => authenticateLocalDefaultUser(username, password)),
        3000
      );

      if (!user) {
        setError("Incorrect username or password.");
        return;
      }

      saveSession(user);
      window.location.assign(user.role === "callcenter" ? "/call-center" : "/dashboard");
    } catch {
      setError(
        "Sign in could not be completed. Check your details and try again."
      );
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(217,251,230,0.95),transparent_34rem),linear-gradient(135deg,#f8fbf9_0%,#ffffff_45%,#edf7f1_100%)] px-4 py-8">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[0.95fr_1.05fr]">
        <div className="order-2 space-y-6 lg:order-1">
          <div className="inline-flex items-center gap-3 rounded-lg border border-brand-100 bg-white/80 px-3 py-2 text-sm font-bold text-brand-800 shadow-sm">
            <ShieldCheck className="h-4 w-4" />
            Live-ready sales operations
          </div>
          <div>
            <div className="mb-5 inline-flex h-16 w-16 items-center justify-center rounded-lg bg-gradient-to-br from-brand-700 to-brand-950 text-2xl font-black text-white shadow-soft">
              K
            </div>
            <h1 className="text-4xl font-black tracking-normal text-brand-950 sm:text-6xl">
              KingApp
            </h1>
            <p className="mt-3 text-xl font-bold text-brand-700">
              Sales & Stock Management
            </p>
          </div>
          <p className="max-w-xl text-base leading-7 text-slate-600">
            Manage beverage loading, marketer confirmations, sales, returns,
            cash collection, inventory, expenses, and closing reports from one
            premium business workspace.
          </p>
          <div className="grid max-w-xl gap-3 sm:grid-cols-3">
            {["Stock Control", "Cash Tracking", "Role Access"].map((item) => (
              <div
                className="rounded-lg border border-brand-100 bg-white/90 px-4 py-4 text-sm font-bold text-brand-900 shadow-sm"
                key={item}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="order-1 rounded-lg border border-slate-200 bg-white/95 p-6 shadow-executive backdrop-blur sm:p-8 lg:order-2">
          <div className="mb-7 text-center">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-lg bg-brand-50 text-brand-800">
              <UserRound className="h-7 w-7" />
            </div>
            <h2 className="text-2xl font-black text-slate-950">Sign in</h2>
            <p className="mt-2 text-sm text-slate-600">
              Use your assigned KingApp account to continue.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Username
              </span>
              <span className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100">
                <UserRound className="h-5 w-5 text-brand-700" />
                <input
                  className="w-full border-0 bg-transparent text-slate-950 outline-none"
                  autoComplete="username"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="admin"
                />
              </span>
            </label>

            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Password
              </span>
              <span className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 shadow-sm focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100">
                <LockKeyhole className="h-5 w-5 text-brand-700" />
                <input
                  className="w-full border-0 bg-transparent text-slate-950 outline-none"
                  autoComplete="current-password"
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  placeholder="admin123"
                  type="password"
                />
              </span>
            </label>

            {error ? (
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-bold text-red-700">
                {error}
              </div>
            ) : null}

            <button
              className="primary-button w-full !py-3"
              disabled={isSubmitting}
              type="submit"
            >
              <LogIn className="h-5 w-5" />
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-7 rounded-lg border border-brand-100 bg-brand-50/80 p-4">
            <p className="text-sm font-black text-brand-950">Test users</p>
            <div className="mt-3 grid gap-2 sm:grid-cols-2">
              {mockUsers.map((user) => (
                <div
                  className="rounded-lg border border-white bg-white px-3 py-2 text-xs shadow-sm"
                  key={user.username}
                >
                  <div className="font-bold text-slate-950">
                    {user.username} / {user.password}
                  </div>
                  <div className="mt-0.5 font-semibold text-brand-700">
                    {roleLabels[user.role]}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}

function authenticateLocalDefaultUser(username: string, password: string) {
  const normalizedUsername = username.trim().toLowerCase();
  const user = mockUsers.find(
    (item) =>
      item.username.toLowerCase() === normalizedUsername &&
      item.password === password &&
      item.status !== "inactive"
  );

  if (!user) {
    return null;
  }

  const { password: _password, ...sessionUser } = user;
  return sessionUser;
}

function isLocalhost() {
  return ["localhost", "127.0.0.1", "::1"].includes(window.location.hostname);
}

function withTimeout<T>(promise: Promise<T>, timeoutMs: number) {
  return Promise.race([
    promise,
    new Promise<never>((_, reject) => {
      window.setTimeout(() => reject(new Error("Login timed out")), timeoutMs);
    })
  ]);
}
