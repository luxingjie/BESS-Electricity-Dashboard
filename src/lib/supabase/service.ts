import "server-only";

import { createClient } from "@supabase/supabase-js";

import { requireSupabaseConfig } from "./config";

/**
 * Service-role client for trusted server jobs (e.g. cron policy ingest).
 * Bypasses RLS — never expose this client to the browser.
 */
export function createServiceSupabaseClient() {
  const config = requireSupabaseConfig();
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!serviceRoleKey) {
    throw new Error(
      "SUPABASE_SERVICE_ROLE_KEY is required for cron / service-role jobs",
    );
  }
  return createClient(config.url, serviceRoleKey, {
    auth: {
      persistSession: false,
      autoRefreshToken: false,
    },
  });
}
