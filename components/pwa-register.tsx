"use client";

import { useEffect } from "react";

export function PwaRegister() {
  useEffect(() => {
    if (!("serviceWorker" in navigator)) return;

    void navigator.serviceWorker.register("/sw.js", { scope: "/" }).catch(() => {
      // Service worker support is optional; the site remains fully usable without it.
    });
  }, []);

  return null;
}
