"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import { useFormStatus } from "react-dom";
import {
  ArrowRight,
  GraduationCap,
  Mail,
  Lock,
  User,
  Eye,
  EyeOff,
  CheckCircle2,
  AlertCircle,
  Building2,
  Loader2,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { labelClassName } from "@/components/auth/auth-shell";
import { signUp } from "@/app/auth/actions";

type College = {
  id: string;
  name: string;
  email_domains: string[];
};

type CollegeSignUpFormProps = {
  colleges: College[];
};

function SubmitButton() {
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
          <span>Creating your account...</span>
        </>
      ) : (
        <>
          <span>Create campus account</span>
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </Button>
  );
}

export function CollegeSignUpForm({ colleges }: CollegeSignUpFormProps) {
  const defaultCollege = colleges[0] ?? null;
  const [selectedCollegeId, setSelectedCollegeId] = useState<string>(
    defaultCollege?.id ?? ""
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  const selectedCollege =
    colleges.find((c) => c.id === selectedCollegeId) ?? defaultCollege;
  const primaryDomain = selectedCollege?.email_domains?.[0]?.trim().toLowerCase() ?? "nitc.ac.in";

  const trimmedEmail = email.trim().toLowerCase();
  const hasAt = trimmedEmail.includes("@");
  const emailDomain = hasAt ? trimmedEmail.split("@").at(-1) : "";
  const isDomainValid =
    hasAt &&
    (selectedCollege?.email_domains ?? []).some(
      (d) => d.trim().toLowerCase() === emailDomain
    );
  const isExternalDomain = hasAt && !isDomainValid && emailDomain !== "";

  // Roll number helper
  const canSuggestDomain = trimmedEmail.length > 2 && !hasAt;

  const handleAppendDomain = () => {
    setEmail(`${trimmedEmail}@${primaryDomain}`);
    passwordRef.current?.focus();
  };

  return (
    <form action={signUp} className="space-y-4">
      {/* Full Name */}
      <div>
        <label className={labelClassName} htmlFor="full-name-input">
          Full name
        </label>
        <div className="relative mt-2">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
            <User className="h-4 w-4" />
          </div>
          <input
            id="full-name-input"
            className="min-h-12 w-full rounded-xl border border-[#e4e0e8] bg-white pl-10 pr-3.5 text-sm text-[#28232f] outline-none transition placeholder:text-[#aaa4af] focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            name="full_name"
            autoComplete="name"
            minLength={2}
            maxLength={120}
            placeholder="e.g., Rohit Sharma"
            required
          />
        </div>
      </div>

      {/* College Selection */}
      <div>
        <label className={labelClassName} htmlFor="college-select">
          Campus / Institution
        </label>
        <div className="relative mt-2">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
            <Building2 className="h-4 w-4" />
          </div>
          <select
            id="college-select"
            className="min-h-12 w-full rounded-xl border border-[#e4e0e8] bg-white pl-10 pr-3.5 text-sm text-[#28232f] outline-none transition focus:border-violet-500 focus:ring-4 focus:ring-violet-100 appearance-none font-medium"
            name="college_id"
            value={selectedCollegeId}
            onChange={(e) => setSelectedCollegeId(e.target.value)}
            required
          >
            {colleges.map((college) => (
              <option key={college.id} value={college.id}>
                {college.name}
              </option>
            ))}
          </select>
        </div>
        <p className="mt-1 text-xs text-violet-700 font-medium">
          Locked to verified college domain: @{primaryDomain}
        </p>
      </div>

      {/* College Email */}
      <div>
        <label className={labelClassName} htmlFor="signup-email-input">
          College email address
        </label>
        <div className="relative mt-2">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
            <Mail className="h-4 w-4" />
          </div>
          <input
            id="signup-email-input"
            className="min-h-12 w-full rounded-xl border border-[#e4e0e8] bg-white pl-10 pr-3.5 text-sm text-[#28232f] outline-none transition placeholder:text-[#aaa4af] focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            name="email"
            type="email"
            autoComplete="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder={`rollnumber@${primaryDomain}`}
            required
          />
        </div>

        {/* Quick Domain Suggestion */}
        {canSuggestDomain && (
          <div className="mt-2 flex items-center gap-2">
            <span className="text-xs text-gray-500">Quick add:</span>
            <button
              type="button"
              onClick={handleAppendDomain}
              className="inline-flex items-center gap-1 rounded-full border border-violet-300 bg-violet-50 px-2.5 py-0.5 text-xs font-medium text-violet-800 transition hover:bg-violet-100"
            >
              <span>+{`@${primaryDomain}`}</span>
            </button>
          </div>
        )}

        {/* Real-time Domain Feedback */}
        {isDomainValid && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-emerald-600">
            <CheckCircle2 className="h-3.5 w-3.5 shrink-0" />
            <span>Valid {selectedCollege?.name} webmail address</span>
          </div>
        )}

        {isExternalDomain && (
          <div className="mt-2 flex items-center gap-1.5 text-xs text-amber-700 bg-amber-50 rounded-lg p-2 border border-amber-200">
            <AlertCircle className="h-3.5 w-3.5 shrink-0" />
            <span>
              Registration is restricted to <strong>@{primaryDomain}</strong> email addresses.
            </span>
          </div>
        )}

        <span className="mt-1.5 block text-xs font-normal text-[#87818c]">
          Use your official college email. We will send a secure confirmation link to verify enrollment.
        </span>
      </div>

      {/* Password */}
      <div>
        <label className={labelClassName} htmlFor="signup-password-input">
          Password
        </label>
        <div className="relative mt-2">
          <div className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3.5 text-gray-400">
            <Lock className="h-4 w-4" />
          </div>
          <input
            id="signup-password-input"
            ref={passwordRef}
            className="min-h-12 w-full rounded-xl border border-[#e4e0e8] bg-white pl-10 pr-10 text-sm text-[#28232f] outline-none transition placeholder:text-[#aaa4af] focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
            name="password"
            type={showPassword ? "text" : "password"}
            autoComplete="new-password"
            minLength={12}
            maxLength={128}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="At least 12 characters"
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
        <div className="mt-1.5 flex items-center justify-between text-xs text-[#87818c]">
          <span>Minimum 12 characters</span>
          {password.length > 0 && (
            <span
              className={
                password.length >= 12
                  ? "text-emerald-600 font-semibold flex items-center gap-1"
                  : "text-amber-600"
              }
            >
              {password.length >= 12 ? (
                <>
                  <CheckCircle2 className="h-3 w-3" /> Strong password
                </>
              ) : (
                `${12 - password.length} more chars needed`
              )}
            </span>
          )}
        </div>
      </div>

      {/* Submit Button */}
      <div className="pt-2">
        <SubmitButton />
      </div>

      <p className="text-center text-xs leading-5 text-[#8b8590]">
        By joining, you agree to follow the campus community rules. Account access begins after your college email and ID are verified.
      </p>
    </form>
  );
}
