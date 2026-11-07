import type { Metadata } from "next";
import { InfoSection, PolicyDraftNotice, PublicPage } from "@/components/public-page";

export const metadata: Metadata = { title: "Privacy notice", description: "Draft privacy notice for the LOOPEC campus marketplace pilot." };

export default function PrivacyPage() {
  return (
    <PublicPage eyebrow="Marketplace policies" title="Privacy notice" description="This draft explains the information LOOPEC needs to operate a verified campus marketplace.">
      <PolicyDraftNotice />
      <InfoSection title="Information collected"><p>LOOPEC processes your account email, name, handle, optional profile details, college affiliation, requested member role, and verification status. If you request college-ID verification, you upload an identity document and provide a college email for review.</p><p>Marketplace use also creates listing, image, wishlist, cart, order, pickup, message, report, review, notification, and payment-reference records, as applicable. The service may record security and administrator audit events.</p></InfoSection>
      <InfoSection title="How information is used"><p>Information is used to authenticate members, verify college eligibility, display listings and seller profiles to approved members, coordinate orders and pickup, provide support, moderate content, prevent misuse, and meet operational or legal obligations.</p></InfoSection>
      <InfoSection title="Who can see it"><p>Approved members can see eligible marketplace listings and limited profile information. Order participants can access order details and related messages. College administrators can review verification documents and scoped moderation records. Identity documents are kept in private storage and are not intended for public access.</p></InfoSection>
      <InfoSection title="Service providers and storage"><p>The planned service uses Supabase for authentication, database, and private file storage, with a web host for the application. The pilot operator must configure the project region, access, backups, and any additional providers before launch. Do not use a production database until those settings have been reviewed.</p></InfoSection>
      <InfoSection title="Retention and requests"><p>Identity documents, messages, order records, and account data need an approved retention schedule. Before launch, the college operator must state that schedule and provide a monitored contact for access, correction, deletion, and privacy requests. Some order or audit records may need to be retained for legitimate operational or legal reasons.</p></InfoSection>
      <InfoSection title="Security and your choices"><p>LOOPEC uses private storage policies and database access controls. No online service can guarantee absolute security. Keep your account credentials private, avoid placing sensitive details in listings or messages, and report suspected unauthorized access promptly to the college’s designated LOOPEC administrator.</p></InfoSection>
      <InfoSection title="Operator details"><p>Before launch, add the responsible data controller/operator, effective date, privacy contact, data region, approved retention periods, and the process for exercising privacy rights.</p></InfoSection>
    </PublicPage>
  );
}
