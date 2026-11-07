import Link from "next/link";
import { AuthShell } from "@/components/auth/auth-shell";

export default function SuspendedPage() {
  return (
    <AuthShell
      eyebrow="Account access"
      title="Please contact your college admin"
      description="This account cannot access the marketplace right now. If you believe this is a mistake, contact your college marketplace administrator for help."
      footer={<Link className="font-semibold text-violet-800 hover:text-violet-950" href="/">Return to LOOPEC</Link>}
    >
      <p className="rounded-2xl bg-[#f6f3fa] p-4 text-sm leading-6 text-[#625b6b]">Your account state is checked by the server and database before marketplace data is shown.</p>
    </AuthShell>
  );
}
