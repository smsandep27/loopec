import type { Metadata } from "next";
import { InfoSection, PublicPage } from "@/components/public-page";

export const metadata: Metadata = { title: "About LOOPEC", description: "A verified campus marketplace for students, faculty, and staff." };

export default function AboutPage() {
  return (
    <PublicPage eyebrow="A CiGaRa Technologies product" title="Keep good things in good company." description="LOOPEC helps one college community pass useful things along, find what it needs, and arrange a familiar campus pickup.">
      <InfoSection title="Made for one campus at a time"><p>Students, faculty, and staff use one account to buy and sell. College email and identity review help keep listings within the college community.</p></InfoSection>
      <InfoSection title="A simple exchange"><p>Members create listings, message each other, place orders, and choose an approved campus pickup point. LOOPEC supports the coordination; members arrange and complete the handover together.</p></InfoSection>
      <InfoSection title="Built around trust"><p>Identity documents are stored in private storage for administrator review. Listings and reports have moderation workflows, and order changes are recorded in the marketplace database.</p></InfoSection>
      <InfoSection title="The team"><p>LOOPEC is a product of CiGaRa Technologies, part of CiGaRa Group. Pilot support is provided through the college’s designated LOOPEC administrator.</p></InfoSection>
    </PublicPage>
  );
}
