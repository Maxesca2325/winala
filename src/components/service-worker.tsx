"use client";

import { useEffect } from "react";
import { BASE_PATH } from "@/lib/base-path";

const OFFLINE_URL = `${BASE_PATH}/offline${process.env.NEXT_PUBLIC_TRAILING_SLASH === "1" ? "/" : ""}`;

/** Registers /sw.js in production only (dev reloads would fight the cache). */
export function ServiceWorker() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    const register = () => {
      navigator.serviceWorker
        .register(`${BASE_PATH}/sw.js?offline=${encodeURIComponent(OFFLINE_URL)}`, {
          scope: `${BASE_PATH}/`,
          updateViaCache: "none",
        })
        .catch(() => {
          /* offline-first is a bonus, never a blocker */
        });
    };
    if (document.readyState === "complete") register();
    else window.addEventListener("load", register, { once: true });
  }, []);
  return null;
}
