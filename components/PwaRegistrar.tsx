"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

export function PwaRegistrar() {
  const pathname = usePathname();

  useEffect(() => {
    if (pathname === "/login") {
      return;
    }

    if (!("serviceWorker" in navigator)) {
      console.log("[KingApp PWA] Service worker not supported");
      return;
    }

    navigator.serviceWorker
      .register("/sw.js", { scope: "/" })
      .then((registration) => {
        console.log("[KingApp PWA] Service worker registered", registration.scope);
      })
      .catch((error) => {
        console.warn("[KingApp PWA] Service worker registration failed", error);
      });
  }, [pathname]);

  return null;
}
