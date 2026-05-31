"use client";

import { useEffect, useState } from "react";
import { RefreshCw, Wifi, WifiOff } from "lucide-react";

type DebugState = {
  cacheNames: string[];
  cachedUrls: string[];
  controllerState: string;
  isOnline: boolean;
  serviceWorkerRegistered: boolean;
  serviceWorkerSupported: boolean;
};

const initialState: DebugState = {
  cacheNames: [],
  cachedUrls: [],
  controllerState: "Not checked",
  isOnline: true,
  serviceWorkerRegistered: false,
  serviceWorkerSupported: false
};

export default function DebugOfflinePage() {
  const [debugState, setDebugState] = useState(initialState);

  async function refreshDebugState() {
    const serviceWorkerSupported = "serviceWorker" in navigator;
    const cacheSupported = "caches" in window;
    const registrations = serviceWorkerSupported
      ? await navigator.serviceWorker.getRegistrations()
      : [];
    const cacheNames = cacheSupported ? await caches.keys() : [];
    const cachedUrls = cacheSupported
      ? (
          await Promise.all(
            cacheNames.map(async (cacheName) => {
              const cache = await caches.open(cacheName);
              const requests = await cache.keys();
              return requests.map((request) => request.url);
            })
          )
        ).flat()
      : [];

    setDebugState({
      cacheNames,
      cachedUrls,
      controllerState:
        navigator.serviceWorker?.controller?.state ?? "No active controller yet",
      isOnline: navigator.onLine,
      serviceWorkerRegistered: registrations.length > 0,
      serviceWorkerSupported
    });
  }

  useEffect(() => {
    void refreshDebugState();

    const refresh = () => void refreshDebugState();
    window.addEventListener("online", refresh);
    window.addEventListener("offline", refresh);

    return () => {
      window.removeEventListener("online", refresh);
      window.removeEventListener("offline", refresh);
    };
  }, []);

  return (
    <main className="min-h-screen bg-slate-50 px-4 py-8 text-slate-950 sm:px-6">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="app-card-soft p-5 sm:p-6">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-3">
              <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-brand-50 text-brand-700">
                {debugState.isOnline ? (
                  <Wifi className="h-6 w-6" />
                ) : (
                  <WifiOff className="h-6 w-6" />
                )}
              </div>
              <div>
                <p className="text-sm font-black uppercase tracking-normal text-brand-700">
                  KingApp PWA
                </p>
                <h1 className="mt-1 text-2xl font-black sm:text-3xl">
                  Offline Debug
                </h1>
              </div>
            </div>
            <button
              className="primary-button"
              onClick={refreshDebugState}
              type="button"
            >
              <RefreshCw className="h-4 w-4" />
              Refresh
            </button>
          </div>
        </section>

        <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <DebugCard
            label="Online Status"
            value={debugState.isOnline ? "Online" : "Offline"}
          />
          <DebugCard
            label="SW Supported"
            value={debugState.serviceWorkerSupported ? "Yes" : "No"}
          />
          <DebugCard
            label="SW Registered"
            value={debugState.serviceWorkerRegistered ? "Yes" : "No"}
          />
          <DebugCard label="Controller" value={debugState.controllerState} />
        </section>

        <section className="app-card p-5">
          <h2 className="text-lg font-black">Cache Names</h2>
          <div className="mt-4 flex flex-wrap gap-2">
            {debugState.cacheNames.length ? (
              debugState.cacheNames.map((cacheName) => (
                <span
                  className="rounded-lg border border-brand-100 bg-brand-50 px-3 py-2 text-sm font-bold text-brand-800"
                  key={cacheName}
                >
                  {cacheName}
                </span>
              ))
            ) : (
              <p className="text-sm font-semibold text-slate-500">
                No caches found yet.
              </p>
            )}
          </div>
        </section>

        <section className="app-card overflow-hidden">
          <div className="border-b border-slate-100 px-5 py-4">
            <h2 className="text-lg font-black">Cached URLs</h2>
          </div>
          <div className="max-h-[520px] overflow-auto px-5 py-4">
            {debugState.cachedUrls.length ? (
              <ul className="space-y-2 text-sm font-semibold text-slate-600">
                {debugState.cachedUrls.map((url) => (
                  <li className="break-all rounded-lg bg-slate-50 px-3 py-2" key={url}>
                    {url}
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-sm font-semibold text-slate-500">
                No cached URLs found yet.
              </p>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}

function DebugCard({ label, value }: { label: string; value: string }) {
  return (
    <article className="app-card p-5">
      <p className="text-sm font-bold text-slate-500">{label}</p>
      <p className="mt-3 break-words text-xl font-black text-brand-800">
        {value}
      </p>
    </article>
  );
}
