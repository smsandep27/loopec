import type { Metadata } from "next";
import { InfoSection, PolicyDraftNotice, PublicPage } from "@/components/public-page";

export const metadata: Metadata = { title: "Terms of use", description: "Draft terms for the LOOPEC campus marketplace pilot." };

export default function TermsPage() {
  return (
    <PublicPage eyebrow="Marketplace policies" title="Terms of use" description="These draft terms describe the intended rules for using LOOPEC at a participating college.">
      <PolicyDraftNotice />
      <InfoSection title="Eligibility and accounts"><p>LOOPEC is intended for current students, faculty, and staff of the participating college. Use your own account, keep your sign-in details secure, and provide accurate information. Administrators may approve, reject, or suspend access under the college’s verification and conduct rules.</p></InfoSection>
      <InfoSection title="Listings and member conduct"><p>List only items you are permitted to sell, describe them honestly, set an accurate price and availability, and use images that represent the item. Do not list illegal, unsafe, counterfeit, recalled, or college-prohibited items. Do not harass, mislead, threaten, or try to bypass another member’s privacy.</p></InfoSection>
      <InfoSection title="Orders and pickup"><p>LOOPEC records an order between members and supports coordination at an approved campus pickup point. Members must confirm item condition, price, pickup arrangements, and handover in person. Do not share passwords, one-time codes, or unnecessary identity documents in messages.</p></InfoSection>
      <InfoSection title="Manual payment review"><p>During the pilot, payment may use a clearly labelled manual UPI workflow. A submitted reference is not proof that a payment succeeded. An administrator must verify the payment independently before the order is marked paid. Confirm the recipient and amount before paying; LOOPEC does not hold funds or guarantee a bank transfer.</p></InfoSection>
      <InfoSection title="Reports and access"><p>Report safety concerns or prohibited listings through the available report tools. Administrators may review reports, moderate listings, restrict accounts, or preserve records needed to investigate a dispute, subject to the college’s approved rules.</p></InfoSection>
      <InfoSection title="Marketplace limits"><p>Members transact with each other. LOOPEC does not inspect or guarantee an item, a member’s performance, or a successful exchange. Resolve item and payment questions with the other member and the college’s designated support contact.</p></InfoSection>
      <InfoSection title="Pilot operator details"><p>Before launch, the college operator must identify the responsible entity, effective date, support contact, prohibited-item rules, dispute process, and applicable legal terms here.</p></InfoSection>
    </PublicPage>
  );
}
