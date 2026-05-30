"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { LockKeyhole, LogIn, UserRound } from "lucide-react";
import { authenticateUser } from "@/lib/auth";
import { syncSupabaseToLocalStorage } from "@/lib/live-data";
import { getSession, saveSession } from "@/lib/storage";

export default function LoginPage() {
  const router = useRouter();
  const [username, setUsername] = useState("admin");
  const [password, setPassword] = useState("admin123");
  const [error, setError] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    void syncSupabaseToLocalStorage();

    if (getSession()) {
      router.replace("/dashboard");
    }
  }, [router]);

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError("");
    setIsSubmitting(true);

    const user = authenticateUser(username, password);

    if (!user) {
      setIsSubmitting(false);
      setError("Incorrect username or password.");
      return;
    }

    saveSession(user);
    router.replace("/dashboard");
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,#dcfce7,transparent_36%),linear-gradient(135deg,#f6faf7_0%,#ffffff_46%,#eaf7ef_100%)] px-4 py-8">
      <section className="mx-auto grid min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center gap-8 lg:grid-cols-[1.05fr_0.95fr]">
        <div className="space-y-7">
          <div>
            <div className="mb-4 inline-flex h-14 w-14 items-center justify-center rounded-lg bg-brand-700 text-xl font-bold text-white shadow-soft">
              K
            </div>
            <h1 className="text-4xl font-bold tracking-normal text-brand-900 sm:text-5xl">
              KingApp
            </h1>
            <p className="mt-3 text-xl font-medium text-brand-700">
              Sales & Stock Management
            </p>
          </div>
          <p className="max-w-xl text-base leading-7 text-slate-700">
            Manage beverage loading, marketer confirmations, sales, returns,
            cash collection, and reporting from one clean business dashboard.
          </p>
          <div className="grid max-w-xl gap-3 sm:grid-cols-3">
            {["Stock Control", "Cash Tracking", "Role Access"].map((item) => (
              <div
                className="rounded-lg border border-brand-100 bg-white/80 px-4 py-3 text-sm font-semibold text-brand-800 shadow-sm"
                key={item}
              >
                {item}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-lg border border-brand-100 bg-white p-6 shadow-soft sm:p-8">
          <div className="mb-7">
            <h2 className="text-2xl font-bold text-slate-950">Sign in</h2>
            <p className="mt-2 text-sm text-slate-600">
              Use your assigned KingApp account to continue.
            </p>
          </div>

          <form className="space-y-5" onSubmit={handleSubmit}>
            <label className="block">
              <span className="mb-2 block text-sm font-semibold text-slate-700">
                Username
              </span>
              <span className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100">
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
              <span className="flex items-center gap-3 rounded-lg border border-slate-200 bg-white px-3 py-3 focus-within:border-brand-600 focus-within:ring-4 focus-within:ring-brand-100">
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
              <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm font-medium text-red-700">
                {error}
              </div>
            ) : null}

            <button
              className="inline-flex w-full items-center justify-center gap-2 rounded-lg bg-brand-700 px-5 py-3 font-semibold text-white transition hover:bg-brand-800 focus:outline-none focus:ring-4 focus:ring-brand-100 disabled:cursor-not-allowed disabled:opacity-70"
              disabled={isSubmitting}
              type="submit"
            >
              <LogIn className="h-5 w-5" />
              {isSubmitting ? "Signing in..." : "Sign in"}
            </button>
          </form>

          <div className="mt-6 rounded-lg bg-brand-50 px-4 py-3 text-sm text-brand-900">
            Phase 1 test account: <strong>admin</strong> /{" "}
            <strong>admin123</strong>
          </div>
        </div>
      </section>
    </main>
  );
}
