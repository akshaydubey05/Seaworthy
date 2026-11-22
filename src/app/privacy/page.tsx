import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { site, mailto } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy — Seaworthy",
  description: "How Seaworthy collects, uses, and retains scan and waitlist data.",
};

export default function PrivacyPage() {
  return (
    <LegalPage
      title="Privacy Policy"
      intro="This policy explains what Seaworthy collects, why we collect it, and the choices you have. It applies to the Seaworthy website, scans, reports, and waitlist."
    >
      <LegalSection title="1. Data we collect">
        <p>
          <strong className="text-[var(--text)]/85">Scan data.</strong> When you run a scan, we process the URL you
          submit, the public response from that URL, generated findings, evidence snippets, scores, coverage, and
          timestamps. We also collect limited technical data such as request time, IP-derived rate-limit identifiers,
          user agent, and error logs.
        </p>
        <p>
          <strong className="text-[var(--text)]/85">Waitlist data.</strong> If you join the waitlist, we collect your
          email address, the signup source, and the time of signup.
        </p>
        <p>
          <strong className="text-[var(--text)]/85">Account and billing data (when enabled).</strong> If paid features
          launch, we may collect account details and billing identifiers from our payment processor. We do not store
          full card numbers.
        </p>
      </LegalSection>

      <LegalSection title="2. How we use data">
        <p>We use data to:</p>
        <ul className="list-disc space-y-1 pl-5">
          <li>run scans and generate reports;</li>
          <li>maintain receipts and let you revisit reports;</li>
          <li>prevent abuse, enforce rate limits, and secure the service;</li>
          <li>debug failures and improve detection quality;</li>
          <li>contact you about the waitlist or paid features you requested; and</li>
          <li>comply with legal obligations.</li>
        </ul>
        <p>We do not sell personal information.</p>
      </LegalSection>

      <LegalSection title="3. Legal bases">
        <p>
          Where required, we rely on contract performance (providing scans you request), legitimate interests (securing
          and improving the service), consent (waitlist emails where required), and legal obligation. You can withdraw
          consent at any time for future processing.
        </p>
      </LegalSection>

      <LegalSection title="4. Sharing and subprocessors">
        <p>
          We use service providers for hosting, database storage, rate limiting, error monitoring, and email delivery.
          They process data on our behalf under appropriate terms. We may also disclose data if required by law, to
          protect rights and safety, or as part of a merger or acquisition.
        </p>
        <p>
          A current list of subprocessors is available on request. We do not share scan targets with advertisers.
        </p>
      </LegalSection>

      <LegalSection title="5. Retention">
        <p>
          Scan records and reports are retained for up to 90 days by default, unless a longer period is needed for a
          paid report, security investigation, or legal obligation. Waitlist emails are retained until you unsubscribe
          or ask us to delete them. Technical logs are retained for up to 30 days.
        </p>
      </LegalSection>

      <LegalSection title="6. Security">
        <p>
          We use access controls, encryption in transit, rate limiting, secret redaction in logs, and least-privilege
          infrastructure. No system is perfectly secure. If you believe you have found a vulnerability, please follow
          our{" "}
          <a className="underline decoration-[rgba(236,241,236,0.25)] underline-offset-2 hover:text-[var(--text)]" href="/security">
            responsible disclosure policy
          </a>
          .
        </p>
      </LegalSection>

      <LegalSection title="7. International transfers">
        <p>
          Our providers may process data in countries other than yours. Where required, we rely on appropriate
          safeguards such as standard contractual clauses.
        </p>
      </LegalSection>

      <LegalSection title="8. Your rights">
        <p>
          Depending on where you live, you may have rights to access, correct, delete, restrict, or export your personal
          data, and to object to certain processing. To make a request, email{" "}
          <a className="underline decoration-[rgba(236,241,236,0.25)] underline-offset-2 hover:text-[var(--text)]" href={mailto(site.contactEmail)}>
            {site.contactEmail}
          </a>
          . We may need to verify your identity before acting.
        </p>
      </LegalSection>

      <LegalSection title="9. Cookies and analytics">
        <p>
          The core Seaworthy experience does not require advertising cookies. If we add privacy-conscious analytics, we
          will describe it here and provide choices where required.
        </p>
      </LegalSection>

      <LegalSection title="10. Children">
        <p>Seaworthy is not directed to children under 16, and we do not knowingly collect their personal data.</p>
      </LegalSection>

      <LegalSection title="11. Changes">
        <p>
          We may update this policy. Material changes will be posted here with a new “last updated” date. If a change
          materially affects waitlist subscribers, we will notify them by email where appropriate.
        </p>
      </LegalSection>

      <LegalSection title="12. Contact">
        <p>
          Privacy questions:{" "}
          <a className="underline decoration-[rgba(236,241,236,0.25)] underline-offset-2 hover:text-[var(--text)]" href={mailto(site.contactEmail)}>
            {site.contactEmail}
          </a>
          . Security reports:{" "}
          <a className="underline decoration-[rgba(236,241,236,0.25)] underline-offset-2 hover:text-[var(--text)]" href={mailto(site.securityEmail)}>
            {site.securityEmail}
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
