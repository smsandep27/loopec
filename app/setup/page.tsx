import Link from "next/link";
import { AuthShell, inputClassName, labelClassName } from "@/components/auth/auth-shell";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

export const instant = false;

type DataApiCheck =
  | { status: "missing_env" }
  | { status: "unavailable"; code: string | null; networkError: boolean }
  | { status: "available"; hasActiveCollege: boolean; marketplace: MarketplaceAccessCheck };

type MarketplaceAccessCheck =
  | { status: "sign_in_required" }
  | { status: "approval_required" }
  | { status: "ready" }
  | { status: "unavailable"; table: string; code: string | null };

async function checkMarketplaceAccess(supabase: Awaited<ReturnType<typeof createClient>>): Promise<MarketplaceAccessCheck> {
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) return { status: "sign_in_required" };

  const { data: profile, error: profileError } = await supabase
    .from("profiles")
    .select("college_id, verification_status, suspended_at")
    .eq("id", String(userId))
    .maybeSingle();
  if (profileError) return { status: "unavailable", table: "profiles", code: profileError.code ?? null };
  if (!profile || profile.verification_status !== "approved" || profile.suspended_at || !profile.college_id) {
    return { status: "approval_required" };
  }

  const checks = [
    ["categories", supabase.from("categories").select("id").eq("is_active", true).limit(1)],
    ["products", supabase.from("products").select("id").eq("college_id", profile.college_id).eq("status", "approved").gt("quantity", 0).limit(1)],
    ["product_images", supabase.from("product_images").select("id").limit(1)],
    ["profiles", supabase.from("profiles").select("id").limit(1)],
    ["wishlists", supabase.from("wishlists").select("product_id").eq("user_id", String(userId)).limit(1)],
    ["notifications", supabase.from("notifications").select("id").eq("user_id", String(userId)).limit(1)],
    ["pickup_locations", supabase.from("pickup_locations").select("id").eq("college_id", profile.college_id).eq("is_active", true).limit(1)],
  ] as const;

  const results = await Promise.all(checks.map(async ([table, query]) => ({ table, error: (await query).error })));
  const failed = results.find(({ error }) => error);
  if (failed?.error) return { status: "unavailable", table: failed.table, code: failed.error.code ?? null };
  return { status: "ready" };
}

async function checkDataApi(): Promise<DataApiCheck> {
  if (!isSupabaseConfigured()) return { status: "missing_env" };

  try {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("colleges")
      .select("id")
      .eq("is_active", true)
      .limit(1);

    if (error) {
      const message = error.message.toLowerCase();
      return {
        status: "unavailable",
        code: error.code ?? null,
        networkError: !error.code || /failed to fetch|network|timeout|aborted/.test(message),
      };
    }
    const hasActiveCollege = (data ?? []).length > 0;
    const marketplace = hasActiveCollege
      ? await checkMarketplaceAccess(supabase)
      : { status: "approval_required" as const };
    return { status: "available", hasActiveCollege, marketplace };
  } catch {
    return { status: "unavailable", code: null, networkError: true };
  }
}

function dataApiHelp(code: string | null, networkError: boolean) {
  if (networkError) return "The app could not connect to the configured Supabase project. Check the project URL in .env.local and confirm this computer has network access, then reload this page. Do not rerun database migrations for a connection error.";
  if (code === "PGRST106") return "The public schema is not exposed to the Data API. Add public under the project's Data API exposed schemas.";
  if (code === "PGRST205" || code === "42P01") return "The colleges table is missing from the API schema. Apply the pilot schema migration once, then refresh the schema cache.";
  if (code === "42501") return "The API reached the database, but the public role grants or row-level security setup is incomplete.";
  return "The project credentials are present, but the app could not query the colleges table. Check the Data API and public schema settings.";
}

export default async function SetupPage() {
  const api = await checkDataApi();
  const secretKeyConfigured = Boolean(process.env.SUPABASE_SECRET_KEY);

  return (
    <AuthShell
      eyebrow="Pilot setup"
      title={api.status === "available" && api.hasActiveCollege ? "Your pilot backend is reachable" : "Finish connecting the pilot backend"}
      description="This page checks the Supabase Data API and NITC setup instead of treating environment variables alone as a working connection."
    >
      {api.status === "missing_env" ? (
        <div className="space-y-4">
          <p className="text-sm leading-6 text-[#6e6875]">Add the public project settings to <code className="rounded bg-[#f2eff5] px-1.5 py-1 text-xs">.env.local</code>, then restart <code>npm run dev</code>.</p>
          <div className="space-y-4">
            <label className={labelClassName}>Supabase project URL<input className={inputClassName} readOnly value="NEXT_PUBLIC_SUPABASE_URL=" /></label>
            <label className={labelClassName}>Supabase publishable key<input className={inputClassName} readOnly value="NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=" /></label>
          </div>
          <p className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-900">The publishable key is intended for app clients. Never put a Supabase secret key in a <code>NEXT_PUBLIC_</code> variable.</p>
        </div>
      ) : api.status === "unavailable" ? (
        <div id="data-api" className="space-y-4">
          <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">Supabase credentials were found, but the app cannot reach the pilot <code>public.colleges</code> table. {dataApiHelp(api.code, api.networkError)}</p>
          {api.code ? <p className="text-xs text-[#625b6b]">Supabase response code: <code>{api.code}</code></p> : null}
          {api.networkError ? (
            <ol className="list-decimal space-y-2 pl-5 text-xs leading-5 text-[#625b6b]">
              <li>Open <code>.env.local</code> and confirm <code>NEXT_PUBLIC_SUPABASE_URL</code> is the project URL from Supabase, then restart <code>npm run dev</code>.</li>
              <li>Reload this page. If it reports a missing table or schema after connecting, follow the migration steps shown here.</li>
            </ol>
          ) : api.code === "PGRST106" ? (
            <ol className="list-decimal space-y-2 pl-5 text-xs leading-5 text-[#625b6b]">
              <li>In Supabase project settings, enable the Data API and add <code>public</code> to Exposed schemas.</li>
              <li>Save the setting and reload this page. Do not rerun the initial schema for an exposure setting error.</li>
            </ol>
          ) : api.code === "42501" ? (
            <ol className="list-decimal space-y-2 pl-5 text-xs leading-5 text-[#625b6b]">
              <li>The Data API reached PostgreSQL, but a grant or row-level security check denied access. Do not rerun the initial schema; inspect its grants and apply only migrations that are still missing.</li>
              <li>Reload this page after fixing access. If <code>community_role</code> already exists, do not rerun the initial schema file.</li>
            </ol>
          ) : (
            <>
              <ol className="list-decimal space-y-2 pl-5 text-xs leading-5 text-[#625b6b]">
                <li>In Supabase project settings, confirm the Data API is enabled and <code>public</code> is listed under Exposed schemas.</li>
                <li>Apply <code>20261107000000_initial_schema.sql</code> only if the LOOPEC tables and types do not already exist. If <code>community_role</code> already exists, do not rerun it.</li>
                <li>Once the table is reachable, run <code>supabase/seeds/nit_calicut.sql</code> if NITC is not already listed, then apply each missing follow-up migration in order.</li>
              </ol>
              <p className="text-xs leading-5 text-[#7b7482]">Do not rerun a migration that is already applied. The SQL Editor can apply a migration, but keep repository migration history in sync.</p>
            </>
          )}
        </div>
      ) : (
        <div id="data-api" className="space-y-4">
          <p className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">Supabase Data API is responding and the <code>public.colleges</code> table is readable.</p>
          {api.hasActiveCollege ? (
            <p className="rounded-2xl bg-violet-50 p-4 text-sm leading-6 text-violet-950">An active college is configured. This confirms public college lookup; marketplace data is restricted to signed-in, approved members.</p>
          ) : (
            <p className="rounded-2xl bg-amber-50 p-4 text-sm leading-6 text-amber-950">The API is working, but there is no active college row. Run <code>supabase/seeds/nit_calicut.sql</code> in the Supabase SQL Editor.</p>
          )}
          {api.hasActiveCollege && api.marketplace.status === "sign_in_required" ? (
            <p className="rounded-2xl border border-[#e8e3ec] bg-white p-4 text-sm leading-6 text-[#625b6b]">No signed-in Supabase session is available to test marketplace permissions. Sign in with a confirmed NITC account after college-ID approval. A local developer preview uses sample listings and does not test live marketplace access.</p>
          ) : null}
          {api.hasActiveCollege && api.marketplace.status === "approval_required" ? (
            <p className="rounded-2xl border border-[#e8e3ec] bg-white p-4 text-sm leading-6 text-[#625b6b]">The signed-in account is not an active approved member yet. Marketplace access can be checked after an admin approves its college-ID verification.</p>
          ) : null}
          {api.hasActiveCollege && api.marketplace.status === "ready" ? (
            <p className="rounded-2xl bg-emerald-50 p-4 text-sm leading-6 text-emerald-950">Marketplace table access passed for this approved member. This checks read access, not file uploads or checkout.</p>
          ) : null}
          {api.hasActiveCollege && api.marketplace.status === "unavailable" ? (
            <p role="alert" className="rounded-2xl border border-amber-200 bg-amber-50 p-4 text-sm leading-6 text-amber-950">The approved account cannot read <code>public.{api.marketplace.table}</code>. Supabase code: <code>{api.marketplace.code ?? "unknown"}</code>. Check that the required migration is applied and that the authenticated role has its intended table grant and RLS policy. Do not grant anonymous access to marketplace tables.</p>
          ) : null}
          <ol className="list-decimal space-y-2 pl-5 text-xs leading-5 text-[#625b6b]">
            <li>{api.hasActiveCollege ? <>The active NITC college row is already present, so skip the seed.</> : <>Run <code>supabase/seeds/nit_calicut.sql</code> to add the NITC college row.</>} Apply only missing follow-up migrations, in order: <code>20261109000000_admin_pickup_locations.sql</code>, <code>20261109000001_realtime_messages.sql</code>, and <code>20261109000002_action_rate_limits.sql</code>.</li>
            <li>Before applying <code>20261110044017_pilot_security_fixes.sql</code>, set <code>SUPABASE_SECRET_KEY</code> in <code>.env.local</code> and the hosting environment. Apply this migration only once.</li>
            <li>Configure Supabase Auth email delivery and the local callback URL, then register and confirm the first admin account.</li>
            <li>Set that account&apos;s confirmed email in <code>supabase/operations/promote_first_college_admin.sql</code> and run it as the project owner.</li>
          </ol>
          <p className="text-xs leading-5 text-[#7b7482]">NITC sign-in accepts confirmed student, faculty, and staff addresses ending in <code>nitc.ac.in</code>.</p>
          {api.hasActiveCollege ? <Link className="inline-flex min-h-12 items-center justify-center rounded-full bg-violet-950 px-5 text-sm font-semibold text-white" href="/auth/sign-up">Continue to registration</Link> : null}
        </div>
      )}

      <section id="storage-key" className="mt-6 rounded-2xl border border-[#e8e3ec] bg-white p-4">
        <h2 className="text-sm font-semibold text-[#403a47]">Secure file uploads</h2>
        {secretKeyConfigured ? (
          <p className="mt-2 text-xs leading-5 text-[#625b6b]">The server-only Supabase secret key is configured. It is used only by protected server actions to validate and store private files.</p>
        ) : (
          <p className="mt-2 text-xs leading-5 text-[#625b6b]">Uploads need <code>SUPABASE_SECRET_KEY</code> in <code>.env.local</code> and the hosting environment. Copy the secret key from Supabase API Keys settings; do not add a <code>NEXT_PUBLIC_</code> prefix and never share this value in chat. Restart the dev server after setting it.</p>
        )}
      </section>
    </AuthShell>
  );
}
