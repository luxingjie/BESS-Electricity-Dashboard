import "server-only";

import { createServerClient } from "@supabase/ssr";
import { cookies, headers } from "next/headers";

import { requireSupabaseConfig } from "./config";

export async function createServerSupabaseClient() {
  const config = requireSupabaseConfig();
  const cookieStore = await cookies();
  const requestHeaders = await headers();
  const authorization = requestHeaders.get("authorization");

  // Only forward well-formed Bearer JWTs to Supabase. Some proxies or browser
  // extensions may inject an Authorization header without a token which causes
  // the Supabase server-side JWT parser to throw "Expected 3 parts in JWT; got 1".
  let globalAuthHeader: { headers: { Authorization: string } } | undefined;
  if (authorization) {
    const m = authorization.match(/^Bearer\s+(.+)$/i);
    const token = m?.[1] ?? authorization;
    // crude check: JWTs have 3 dot-separated parts
    if (typeof token === "string" && token.split(".").length === 3) {
      globalAuthHeader = { headers: { Authorization: `Bearer ${token}` } };
    }
  }

  return createServerClient(config.url, config.publishableKey, {
    cookieOptions: {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
    },
    global: globalAuthHeader,
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet) {
        try {
          cookiesToSet.forEach(({ name, value, options }) => {
            cookieStore.set(name, value, options);
          });
        } catch {
          // Server Components cannot always write cookies. The root proxy keeps
          // sessions refreshed for those requests.
        }
      },
    },
  });
}
