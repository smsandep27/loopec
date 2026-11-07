import Link from "next/link";
import type { ReactNode } from "react";
import { BrandMark } from "@/components/brand-mark";

export function PublicPage({
  eyebrow,
  title,
  description,
  children,
}: {
  eyebrow: string;
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <main className="min-h-screen bg-[#f7f6f4] text-[#302b37]">
      <header className="border-b border-[#e8e5e2] bg-white/90">
        <div className="mx-auto flex min-h-[72px] max-w-6xl items-center justify-between px-5 sm:px-8">
          <Link className="inline-flex items-center gap-2.5" href="/" aria-label="LOOPEC home">
            <BrandMark compact />
            <span className="text-sm font-extrabold tracking-[.14em] text-[#302546]">LOOPEC</span>
          </Link>
          <nav aria-label="Public navigation" className="flex items-center gap-4 text-xs font-semibold text-[#716b77] sm:gap-6">
            <Link className="hover:text-violet-900" href="/about">About</Link>
            <Link className="hover:text-violet-900" href="/auth/sign-in">Sign in</Link>
          </nav>
        </div>
      </header>
      <article className="mx-auto max-w-4xl px-5 py-12 sm:px-8 sm:py-16">
        <p className="text-[10px] font-bold uppercase tracking-[.15em] text-violet-700">{eyebrow}</p>
        <h1 className="mt-3 font-serif text-4xl tracking-[-.05em] text-[#28232f] sm:text-5xl">{title}</h1>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-[#716b77]">{description}</p>
        <div className="mt-8">{children}</div>
        <footer className="mt-14 flex flex-wrap gap-x-5 gap-y-2 border-t border-[#e8e5e2] pt-5 text-xs text-[#89828e]">
          <Link className="hover:text-violet-900" href="/terms">Terms</Link>
          <Link className="hover:text-violet-900" href="/privacy">Privacy</Link>
          <span>© LOOPEC · A CiGaRa Technologies product</span>
        </footer>
      </article>
    </main>
  );
}

export function PolicyDraftNotice() {
  return (
    <p className="mb-7 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs leading-5 text-amber-950">
      Pilot policy draft. The college operator must review and approve this page, fill in its contact and retention details, and publish the final policy before registration opens.
    </p>
  );
}

export function InfoSection({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="border-t border-[#e8e5e2] py-5 first:border-0 first:pt-0">
      <h2 className="text-base font-semibold text-[#393341]">{title}</h2>
      <div className="mt-2 space-y-3 text-sm leading-7 text-[#716b77]">{children}</div>
    </section>
  );
}
