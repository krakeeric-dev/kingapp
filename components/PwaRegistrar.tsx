"use client";

import { useEffect } from "react";

export function PwaRegistrar() {
  useEffect(() => {
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
  }, []);

  return null;
}
