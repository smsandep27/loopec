import {
  GraduationCap,
  ShieldCheck,
  MapPin,
  Sparkles,
  Lock,
  ArrowRight,
  CheckCircle2,
  Building2,
  Wallet,
} from "lucide-react";

type CollegeTrustShowcaseProps = {
  collegeName?: string;
  collegeDomain?: string;
};

export function CollegeTrustShowcase({
  collegeName = "National Institute of Technology Calicut",
  collegeDomain = "nitc.ac.in",
}: CollegeTrustShowcaseProps) {
  return (
    <div className="flex flex-col justify-between space-y-8 rounded-[28px] border border-violet-100 bg-gradient-to-br from-violet-950 via-[#271b42] to-[#1a1230] p-7 text-white shadow-xl lg:p-9">
      {/* College Institution Header */}
      <div className="space-y-4">
        <div className="inline-flex items-center gap-2 rounded-full border border-violet-400/30 bg-violet-400/10 px-3.5 py-1 text-xs font-semibold text-violet-200">
          <GraduationCap className="h-4 w-4 text-violet-300" />
          <span>Official Campus Portal</span>
        </div>

        <div className="space-y-1">
          <h2 className="font-serif text-2xl font-normal tracking-tight text-white sm:text-3xl">
            {collegeName}
          </h2>
          <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-violet-200/80">
            <span className="flex items-center gap-1">
              <MapPin className="h-3.5 w-3.5 text-violet-400" />
              NIT Campus P.O., Kozhikode, Kerala
            </span>
            <span className="text-violet-400/50">•</span>
            <span className="font-mono font-medium text-violet-300">
              @{collegeDomain}
            </span>
          </div>
        </div>

        <p className="text-xs leading-relaxed text-violet-200/70 sm:text-sm">
          A closed-loop, peer-to-peer marketplace reserved strictly for students,
          researchers, and faculty members of NIT Calicut.
        </p>
      </div>

      {/* Trust Pillars */}
      <div className="space-y-4">
        <p className="text-[11px] font-bold uppercase tracking-[.15em] text-violet-300">
          Why Campus Authentication?
        </p>

        <div className="space-y-3">
          <div className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-3.5 transition hover:bg-white/10">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-300">
              <ShieldCheck className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-white sm:text-sm">
                100% Verified NITC Peers
              </h3>
              <p className="text-xs leading-5 text-violet-200/70">
                Only members with verified <code className="rounded bg-violet-900/60 px-1 py-0.5 text-violet-200">@{collegeDomain}</code> credentials and campus ID cards can trade. No outsiders.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-3.5 transition hover:bg-white/10">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-300">
              <Building2 className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-white sm:text-sm">
                Hostel & Campus Pickup Points
              </h3>
              <p className="text-xs leading-5 text-violet-200/70">
                Physical handover at recognized campus spots: MBH, LH, PG Hostels, SAC, Central Library, or Mega Mess.
              </p>
            </div>
          </div>

          <div className="flex items-start gap-3.5 rounded-2xl border border-white/10 bg-white/5 p-3.5 transition hover:bg-white/10">
            <div className="mt-0.5 grid h-8 w-8 shrink-0 place-items-center rounded-xl bg-violet-500/20 text-violet-300">
              <Wallet className="h-4 w-4" />
            </div>
            <div className="space-y-0.5">
              <h3 className="text-xs font-bold text-white sm:text-sm">
                Escrow Payments & 95% UPI Payout
              </h3>
              <p className="text-xs leading-5 text-violet-200/70">
                Razorpay holds buyer funds securely until item inspection. 95% net payout transfers straight to seller&apos;s UPI upon OTP verification.
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Campus Metrics & Status */}
      <div className="border-t border-white/10 pt-5">
        <div className="grid grid-cols-3 gap-2 text-center">
          <div className="rounded-xl bg-white/5 p-2.5">
            <p className="font-mono text-base font-bold text-white sm:text-lg">6,500+</p>
            <p className="text-[10px] text-violet-300">Campus Peers</p>
          </div>
          <div className="rounded-xl bg-white/5 p-2.5">
            <p className="font-mono text-base font-bold text-white sm:text-lg">12+</p>
            <p className="text-[10px] text-violet-300">Hostel Zones</p>
          </div>
          <div className="rounded-xl bg-white/5 p-2.5">
            <p className="font-mono text-base font-bold text-emerald-300 sm:text-lg">5%</p>
            <p className="text-[10px] text-violet-300">Platform Fee</p>
          </div>
        </div>

        <div className="mt-4 flex items-center justify-between text-[11px] text-violet-300/80">
          <span className="flex items-center gap-1.5">
            <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
            NITC Pilot Campus Live
          </span>
          <span className="font-mono text-violet-400">CiGaRa Group</span>
        </div>
      </div>
    </div>
  );
}
