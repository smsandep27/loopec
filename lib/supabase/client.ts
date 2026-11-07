"use client";

import { createBrowserClient } from "@supabase/ssr";
import type { SupabaseClient } from "@supabase/supabase-js";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

let browserClient: SupabaseClient | undefined;

export function createClient() {
  if (browserClient) return browserClient;

  const { url, publishableKey } = getSupabasePublicConfig();
  browserClient = createBrowserClient(url, publishableKey);
  return browserClient;
}
