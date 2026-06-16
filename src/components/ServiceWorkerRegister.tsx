"use client";

import { useEffect } from "react";

/**
 * Mendaftarkan service worker (/sw.js) di sisi klien agar aplikasi installable
 * sebagai PWA & punya fallback offline. Tidak merender apa pun.
 */
export function ServiceWorkerRegister() {
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator)) return;
    const onLoad = () => {
      navigator.serviceWorker
        .register("/sw.js", { scope: "/", updateViaCache: "none" })
        .catch((err) => console.error("SW registration gagal:", err));
    };
    window.addEventListener("load", onLoad);
    return () => window.removeEventListener("load", onLoad);
  }, []);
  return null;
}
