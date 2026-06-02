"use client";

import { Monitor } from "lucide-react";
import { useEffect, useState } from "react";

export function useIsMobileScreen() {
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const query = window.matchMedia("(max-width: 1023px)");
    const update = () => setIsMobile(query.matches);

    update();
    query.addEventListener("change", update);

    return () => query.removeEventListener("change", update);
  }, []);

  return isMobile;
}

export function CallCenterMobileBlock() {
  return (
    <main className="flex min-h-screen items-center justify-center bg-[#061b33] px-5 py-10 text-white">
      <section className="w-full max-w-md rounded-2xl border border-white/10 bg-white/10 p-8 text-center shadow-2xl backdrop-blur">
        <div className="mx-auto flex h-16 w-16 items-center justify-center rounded-2xl bg-blue-500/20 text-blue-100">
          <Monitor className="h-8 w-8" />
        </div>
        <h1 className="mt-6 text-2xl font-black">
          Call Center is available on desktop only.
        </h1>
        <p className="mt-3 text-sm font-semibold text-blue-100">
          Please open KingApp on a desktop or laptop.
        </p>
      </section>
    </main>
  );
}
