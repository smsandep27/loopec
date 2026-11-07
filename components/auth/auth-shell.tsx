import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

export function AuthShell({
  eyebrow,
  title,
  description,
  children,
  footer,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
  footer?: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f7f6f4] px-5 py-8 sm:px-8 sm:py-12">
      <div className="mx-auto flex max-w-6xl items-center justify-between">
        <Link className="flex items-center gap-2.5" href="/" aria-label="LOOPEC home">
          <BrandMark />
          <span className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC</span>
        </Link>
        <Link className="text-sm text-[#685e74] transition hover:text-violet-950" href="/">
          Back to home
        </Link>
      </div>
      <section className="mx-auto mt-12 max-w-[520px] rounded-[28px] border border-[#e9e5eb] bg-white p-6 shadow-[0_24px_80px_-50px_rgba(43,29,68,.35)] sm:mt-16 sm:p-10">
        <p className="text-[11px] font-bold uppercase tracking-[.15em] text-violet-700">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-[-.045em] text-[#28232f]">{title}</h1>
        <p className="mt-3 text-sm leading-6 text-[#77717e]">{description}</p>
        <div className="mt-8">{children}</div>
      </section>
      {footer ? <div className="mx-auto mt-6 max-w-[520px] text-center text-sm text-[#77717e]">{footer}</div> : null}
      <p className="mt-10 text-center text-xs text-[#918b96]">A private marketplace for your campus community.</p>
    </main>
  );
}

export function FormNotice({ children }: { children: ReactNode }) {
  return (
    <p role="alert" className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm leading-5 text-rose-800">
      {children}
    </p>
  );
}

export const inputClassName =
  "mt-2 min-h-12 w-full rounded-xl border border-[#e4e0e8] bg-white px-3.5 text-sm text-[#28232f] outline-none transition placeholder:text-[#aaa4af] focus:border-violet-500 focus:ring-4 focus:ring-violet-100";

export const labelClassName = "block text-sm font-semibold text-[#383240]";
