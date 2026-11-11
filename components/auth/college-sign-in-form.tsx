"use client";

import { useState, useRef, useTransition } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import {
  ArrowRight,
  GraduationCap,
  Building2,
  Mail,
  Lock,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Sparkles,
  Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { labelClassName } from "@/components/auth/auth-shell";
import { signIn } from "@/app/auth/actions";

type CollegeSignInFormProps = {
  nextPath?: string;
  collegeName?: string;
  collegeDomain?: string;
  showDevHelpers?: boolean;
};

function SubmitButton({ label = "Sign in to LOOPEC" }: { label?: string }) {
  const { pending } = useFormStatus();

  return (
    <Button
      className="w-full font-semibold transition-all duration-200"
      size="lg"
      type="submit"
      disabled={pending}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Verifying credentials...</span>
        </>
      ) : (
        <>
          <span>{label}</span>
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </Button>
  );
}

export function CollegeSignInForm({
  nextPath = "",
  collegeName = "National Institute of Technology Calicut",
  collegeDomain = "nitc.ac.in",
  showDevHelpers = process.env.NODE_ENV === "development",
}: CollegeSignInFormProps) {
  const [role, setRole] = useState<"student" | "faculty">("student");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [showDevPanel, setShowDevPanel] = useState(false);
  const passwordInputRef = useRef<HTMLInputElement>(null);

  const cleanDomain = collegeDomain.trim().toLowerCase();
  const trimmedEmail = email.trim().toLowerCase();
  const hasAt = trimmedEmail.includes("@");
  const emailDomain = hasAt ? trimmedEmail.split("@").at(-1) : "";
  const isDomainValid = hasAt && emailDomain === cleanDomain;
  const isExternalDomain = hasAt && emailDomain !== cleanDomain && emailDomain !== "";

  // Roll number prompt: student typed roll without domain e.g. "b210045cs"
  const canSuggestDomain = trimmedEmail.length > 2 && !hasAt;

  const handleAppendDomain = () => {
    setEmail(`${trimmedEmail}@${cleanDomain}`);
    passwordInputRef.current?.focus();
  };

  const fillDemoAccount = (demoEmail: string, demoPass: string) => {
    setEmail(demoEmail);
    setPassword(demoPass);
    setShowDevPanel(false);
  };

  return (
    <div className="space-y-6">
      {/* Role Switcher */}
      <div className="flex rounded-xl bg-violet-50/70 p-1 border border-violet-100">
        <button
          type="button"
          onClick={() => setRole("student")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition ${
            role === "student"
              ? "bg-white text-violet-950 shadow-sm"
              : "text-violet-700/70 hover:text-violet-950"
          }`}
        >
          <GraduationCap className="h-4 w-4" />
          <span>Student Portal</span>
        </button>

        <button
          type="button"
          onClick={() => setRole("faculty")}
          className={`flex-1 flex items-center justify-center gap-2 rounded-lg py-2 text-xs font-semibold transition ${
            role === "faculty"
              ? "bg-white text-violet-950 shadow-sm"
              : "text-violet-700/70 hover:text-violet-950"
          }`}
        >
          <Building2 className="h-4 w-4" />
          <span>Faculty & Staff</span>
        </button>
      </div>

      <form action={signIn} className="space-y-4">
        <input type="hidden" name="next" value={nextPath} />

        {/* Email Field */}
        <div>
          <label className={labelClassName} htmlFor="college-email-input">
            College email address
          </label>
          <div className="relative mt-2">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
              <Mail className="h-4 w-4" />
            </div>
            <input
              id="college-email-input"
              className="min-h-12 w-full rounded-xl border border-[#e4e0e8] bg-white pl-10 pr-3.5 text-sm text-[#28232f] outline-none transition placeholder:text-[#aaa4af] focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              name="email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={
                role === "student"
                  ? `rollnumber@${cleanDomain}`
                  : `faculty@${cleanDomain}`
              }
              required
            />
          </div>

          {/* Quick Domain Suggestion Chip */}
          {canSuggestDomain && (
            <div className="mt-2 flex items-center gap-2">
              <span className="text-xs text-gray-500">Quick add:</span>
              <button
                type="button"
                onClick={handleAppendDomain}
                className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800 transition hover:bg-violet-100"
              >
                <span>+{`@${cleanDomain}`}</span>
              </button>
            </div>
          )}

          {/* Real-time Domain Feedback */}
          {isDomainValid && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
              <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
              <span>Valid NIT Calicut institutional domain</span>
            </div>
          )}

          {isExternalDomain && (
            <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg p-2 border border-amber-200">
              <AlertCircle className="h-3.5 w-3.5 shrink-0" />
              <span>
                Campus login is reserved for <strong>@{cleanDomain}</strong> email addresses.
              </span>
            </div>
          )}

          <p className="mt-1.5 text-xs text-gray-500">
            {role === "student"
              ? "Use your official NITC roll email (e.g., b210045cs@nitc.ac.in)"
              : "Use your official department faculty webmail"}
          </p>
        </div>

        {/* Password Field */}
        <div>
          <div className="flex items-center justify-between">
            <label className={labelClassName} htmlFor="college-password-input">
              Password
            </label>
            <Link
              className="text-xs font-semibold text-violet-800 hover:text-violet-950"
              href="/auth/forgot-password"
            >
              Forgot password?
            </Link>
          </div>
          <div className="relative mt-2">
            <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
              <Lock className="h-4 w-4" />
            </div>
            <input
              id="college-password-input"
              ref={passwordInputRef}
              className="min-h-12 w-full rounded-xl border border-[#e4e0e8] bg-white pl-10 pr-10 text-sm text-[#28232f] outline-none transition placeholder:text-[#aaa4af] focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
              name="password"
              type={showPassword ? "text" : "password"}
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••••••"
              required
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute inset-y-0 right-0 flex items-center pr-3.5 text-gray-400 hover:text-gray-600"
              aria-label={showPassword ? "Hide password" : "Show password"}
            >
              {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
            </button>
          </div>
        </div>

        {/* Submit Button */}
        <div className="pt-2">
          <SubmitButton label="Sign in to LOOPEC" />
        </div>
      </form>

      {/* Dev / Fast Demo Account Fill */}
      {showDevHelpers && (
        <div className="rounded-xl border border-dashed border-violet-200 bg-violet-50/50 p-3 text-xs">
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-1.5 font-semibold text-violet-900">
              <Sparkles className="h-3.5 w-3.5 text-violet-600" />
              Dev & Demo Quick Fill
            </span>
            <button
              type="button"
              onClick={() => setShowDevPanel(!showDevPanel)}
              className="text-violet-700 underline hover:text-violet-950"
            >
              {showDevPanel ? "Hide" : "Show sample logins"}
            </button>
          </div>

          {showDevPanel && (
            <div className="mt-3 space-y-2 border-t border-violet-200/60 pt-2.5">
              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-600">Student Account:</span>
                <button
                  type="button"
                  onClick={() =>
                    fillDemoAccount(`student@${cleanDomain}`, "LoopecCampus#2026")
                  }
                  className="rounded-md bg-white px-2 py-1 font-mono text-[11px] font-medium text-violet-800 shadow-sm border border-violet-200 hover:bg-violet-100"
                >
                  Fill student@{cleanDomain}
                </button>
              </div>

              <div className="flex items-center justify-between gap-2">
                <span className="text-gray-600">Faculty Account:</span>
                <button
                  type="button"
                  onClick={() =>
                    fillDemoAccount(`faculty@${cleanDomain}`, "LoopecCampus#2026")
                  }
                  className="rounded-md bg-white px-2 py-1 font-mono text-[11px] font-medium text-violet-800 shadow-sm border border-violet-200 hover:bg-violet-100"
                >
                  Fill faculty@{cleanDomain}
                </button>
              </div>

              <p className="text-[10px] text-gray-500">
                Tip: If credentials are not pre-created in your Supabase Auth instance, use &ldquo;Create an account&rdquo; to register them first.
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
