import { NextResponse, type NextRequest } from "next/server";
import { isSupabaseConfigured } from "@/lib/supabase/env";
import { createClient } from "@/lib/supabase/server";

function safeNext(value: string | null) {
  return value && value.startsWith("/") && !value.startsWith("//") && !value.startsWith("/\\")
    ? value
    : "/verification";
}

export async function GET(request: NextRequest) {
  if (!isSupabaseConfigured()) return NextResponse.redirect(new URL("/setup", request.url));
  const { searchParams, origin } = request.nextUrl;
  const code = searchParams.get("code");
  if (!code) return NextResponse.redirect(new URL("/auth/sign-in?error=expired", origin));

  const supabase = await createClient();
  const { error } = await supabase.auth.exchangeCodeForSession(code);
  if (error) return NextResponse.redirect(new URL("/auth/sign-in?error=expired", origin));

  return NextResponse.redirect(new URL(safeNext(searchParams.get("next")), origin));
}
