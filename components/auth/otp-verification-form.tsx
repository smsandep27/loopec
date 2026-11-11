"use client";

import { useState, useRef, useEffect, useTransition } from "react";
import { useFormStatus } from "react-dom";
import Link from "next/link";
import {
  ArrowRight,
  ShieldCheck,
  Mail,
  RotateCw,
  CheckCircle2,
  AlertCircle,
  Loader2,
  KeyRound,
  Edit2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { verifyEmailOtp, resendConfirmation } from "@/app/auth/actions";

type OtpVerificationFormProps = {
  initialEmail: string;
};

function SubmitButton({ isReady }: { isReady: boolean }) {
  const { pending } = useFormStatus();

  return (
    <Button
      className="w-full font-semibold transition-all duration-200"
      size="lg"
      type="submit"
      disabled={!isReady || pending}
    >
      {pending ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Verifying OTP code...</span>
        </>
      ) : (
        <>
          <span>Verify OTP & Continue</span>
          <ArrowRight className="h-4 w-4" />
        </>
      )}
    </Button>
  );
}

export function OtpVerificationForm({ initialEmail }: OtpVerificationFormProps) {
  const [email, setEmail] = useState(initialEmail);
  const [isEditingEmail, setIsEditingEmail] = useState(!initialEmail);
  const [digits, setDigits] = useState<string[]>(["", "", "", "", "", ""]);
  const [resendCooldown, setResendCooldown] = useState(30);
  const [isResending, startResendTransition] = useTransition();
  const inputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Timer countdown for resend
  useEffect(() => {
    if (resendCooldown <= 0) return;
    const interval = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(interval);
  }, [resendCooldown]);

  // Focus first input on mount
  useEffect(() => {
    if (!isEditingEmail) {
      inputRefs.current[0]?.focus();
    }
  }, [isEditingEmail]);

  const otpCode = digits.join("");
  const isComplete = otpCode.length === 6;

  const handleDigitChange = (index: number, value: string) => {
    // Only accept numeric digits
    const cleaned = value.replace(/\D/g, "");
    if (!cleaned) {
      const nextDigits = [...digits];
      nextDigits[index] = "";
      setDigits(nextDigits);
      return;
    }

    // Single digit entry
    const nextDigits = [...digits];
    nextDigits[index] = cleaned[cleaned.length - 1]; // take latest char
    setDigits(nextDigits);

    // Auto-focus next input
    if (index < 5 && cleaned.length > 0) {
      inputRefs.current[index + 1]?.focus();
    }
  };

  const handleKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Backspace" && !digits[index] && index > 0) {
      // Focus previous input on backspace in empty box
      inputRefs.current[index - 1]?.focus();
    }
  };

  const handlePaste = (e: React.ClipboardEvent) => {
    e.preventDefault();
    const pasted = e.clipboardData.getData("text").replace(/\D/g, "").slice(0, 6);
    if (!pasted) return;

    const nextDigits = [...digits];
    for (let i = 0; i < 6; i++) {
      nextDigits[i] = pasted[i] || "";
    }
    setDigits(nextDigits);

    // Focus last filled box
    const lastFilledIndex = Math.min(pasted.length, 5);
    inputRefs.current[lastFilledIndex]?.focus();
  };

  const handleResend = () => {
    if (resendCooldown > 0 || isResending) return;
    startResendTransition(async () => {
      const formData = new FormData();
      formData.set("email", email);
      await resendConfirmation(formData);
      setResendCooldown(45);
    });
  };

  return (
    <div className="space-y-6">
      {/* College Email Identity Card */}
      <div className="rounded-2xl border border-violet-100 bg-violet-50/60 p-4">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="grid h-8 w-8 place-items-center rounded-xl bg-violet-600/10 text-violet-700">
              <Mail className="h-4 w-4" />
            </div>
            <div>
              <p className="text-xs font-semibold text-violet-950">
                NITC Webmail Inbox
              </p>
              {isEditingEmail ? (
                <div className="mt-1 flex items-center gap-2">
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="rollno@nitc.ac.in"
                    className="h-8 rounded-lg border border-violet-300 bg-white px-2.5 text-xs text-gray-900 outline-none focus:ring-2 focus:ring-violet-400"
                  />
                  <button
                    type="button"
                    onClick={() => setIsEditingEmail(false)}
                    className="text-xs font-semibold text-violet-800 hover:text-violet-950"
                  >
                    Done
                  </button>
                </div>
              ) : (
                <p className="font-mono text-xs font-medium text-violet-900">
                  {email || "your.email@nitc.ac.in"}
                </p>
              )}
            </div>
          </div>

          {!isEditingEmail && (
            <button
              type="button"
              onClick={() => setIsEditingEmail(true)}
              className="inline-flex items-center gap-1 rounded-lg px-2 py-1 text-xs text-violet-700 hover:bg-violet-100/60"
            >
              <Edit2 className="h-3 w-3" />
              <span>Change</span>
            </button>
          )}
        </div>
      </div>

      {/* 6-Digit OTP Form */}
      <form action={verifyEmailOtp} className="space-y-5">
        <input type="hidden" name="email" value={email} />
        <input type="hidden" name="token" value={otpCode} />

        <div>
          <label className="block text-center text-xs font-bold uppercase tracking-wider text-gray-600 mb-3">
            Enter 6-Digit Verification Code
          </label>

          {/* 6 Input Boxes */}
          <div
            className="flex items-center justify-center gap-2 sm:gap-3"
            onPaste={handlePaste}
          >
            {digits.map((digit, index) => (
              <input
                key={index}
                ref={(el) => {
                  inputRefs.current[index] = el;
                }}
                type="text"
                inputMode="numeric"
                pattern="[0-9]*"
                maxLength={1}
                value={digit}
                onChange={(e) => handleDigitChange(index, e.target.value)}
                onKeyDown={(e) => handleKeyDown(index, e)}
                className={`h-13 w-11 sm:h-16 sm:w-13 rounded-2xl border text-center font-mono text-2xl font-bold shadow-xs transition-all duration-150 outline-none ${
                  digit
                    ? "border-violet-600 bg-violet-50/30 text-violet-950 ring-2 ring-violet-200"
                    : "border-gray-200 bg-white text-gray-900 hover:border-gray-300 focus:border-violet-500 focus:ring-4 focus:ring-violet-100"
                }`}
                aria-label={`Digit ${index + 1}`}
              />
            ))}
          </div>

          <p className="mt-3 text-center text-xs text-gray-500">
            Check your NITC inbox or spam folder for the 6-digit code.
          </p>
        </div>

        {/* Submit Button */}
        <SubmitButton isReady={isComplete} />
      </form>

      {/* Resend OTP Section */}
      <div className="rounded-xl border border-gray-100 bg-gray-50/70 p-4 text-center">
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <span className="text-gray-600">Didn&apos;t receive the code?</span>

          {resendCooldown > 0 ? (
            <span className="font-mono text-violet-700 bg-violet-50 px-2.5 py-1 rounded-lg border border-violet-200">
              Resend in {resendCooldown}s
            </span>
          ) : (
            <button
              type="button"
              onClick={handleResend}
              disabled={isResending}
              className="inline-flex items-center gap-1.5 font-semibold text-violet-800 hover:text-violet-950 hover:underline disabled:opacity-50"
            >
              <RotateCw className={`h-3.5 w-3.5 ${isResending ? "animate-spin" : ""}`} />
              <span>Resend 6-Digit OTP</span>
            </button>
          )}
        </div>

        <div className="mt-3 border-t border-gray-200/60 pt-2 text-[11px] text-gray-500">
          💡 <strong>Tip:</strong> The verification email also includes a direct clickable link. You can either enter this OTP or click the link in your email.
        </div>
      </div>
    </div>
  );
}
