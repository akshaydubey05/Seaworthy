import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { site, mailto } from "@/lib/site";

export const metadata: Metadata = {
  title: "Terms of Use — Seaworthy",
  description: "Terms for using Seaworthy scans, reports, and related services.",
};

const jurisdiction = site.jurisdiction || "the jurisdiction in which the operator is established";

export default function TermsPage() {
  return (
    <LegalPage
      title="Terms of Use"
      intro="These terms govern your use of Seaworthy. By using the service, you agree to them. If you do not agree, do not use Seaworthy."
    >
      <LegalSection title="1. The service">
        <p>
          Seaworthy provides automated security checks for publicly reachable web applications, together with reports,
          scores, coverage information, and related workflows. Features may be added, changed, or removed over time.
        </p>
        <p>
          Unless a separate written agreement says otherwise, Seaworthy is a <strong className="text-[var(--text)]/85">best-effort automated review</strong>.
          It is not a penetration test, security certification, compliance audit, or guarantee that an application is secure.
        </p>
      </LegalSection>

      <LegalSection title="2. Authorized use only">
        <p>
          You may only submit URLs that you own or have explicit permission to test. You are responsible for confirming
          that your use complies with applicable law, contracts, and third-party terms.
        </p>
        <p>
          You must not use Seaworthy to attack, overload, scrape, or disrupt systems, to bypass access controls, or to
          process data you are not authorized to handle. We may block requests that appear abusive or unlawful.
        </p>
      </LegalSection>

      <LegalSection title="3. Reports and findings">
        <p>
          Reports are informational. Automated checks can produce false positives, false negatives, and incomplete
          coverage. Findings labeled <em>needs validation</em> require independent verification. You are responsible for
          validating findings and deciding what to fix before launch or before handling sensitive data.
        </p>
        <p>
          A high score does not mean an application is secure, and a low score does not by itself prove exploitation.
        </p>
      </LegalSection>

      <LegalSection title="4. Accounts, paid features, and billing">
        <p>
          Some features may require an account or payment. If you purchase a paid feature, the price, scope, and renewal
          terms shown at checkout apply. Unless required by law or stated otherwise, payments are non-refundable once a
          report or audit has been delivered.
        </p>
        <p>
          You are responsible for keeping account credentials secure and for activity under your account.
        </p>
      </LegalSection>

      <LegalSection title="5. Your content and data">
        <p>
          You retain ownership of the URLs, configuration, and materials you submit. You grant us a limited license to
          process them to provide the service, prevent abuse, and improve detection quality.
        </p>
        <p>
          Do not submit secrets, personal data, or other sensitive information that is not necessary for the scan. If a
          report contains sensitive evidence, treat it as confidential.
        </p>
      </LegalSection>

      <LegalSection title="6. Intellectual property">
        <p>
          Seaworthy, its branding, and its software are owned by {site.companyName} or its licensors. Open-source
          components remain under their respective licenses. You may not copy, resell, or reverse engineer the service
          except as permitted by law or a separate agreement.
        </p>
      </LegalSection>

      <LegalSection title="7. Third-party services">
        <p>
          The service may rely on third-party infrastructure and integrations. We are not responsible for third-party
          services, and their terms may apply. Seaworthy&apos;s security-audit concepts are informed in part by
          Cloudflare&apos;s MIT-licensed security-audit-skill; Cloudflare does not endorse Seaworthy.
        </p>
      </LegalSection>

      <LegalSection title="8. Disclaimer of warranties">
        <p>
          The service is provided “as is” and “as available” without warranties of any kind, whether express, implied,
          or statutory, including merchantability, fitness for a particular purpose, and non-infringement. We do not
          warrant that the service will be uninterrupted, error-free, or complete.
        </p>
      </LegalSection>

      <LegalSection title="9. Limitation of liability">
        <p>
          To the maximum extent permitted by law, {site.companyName} will not be liable for indirect, incidental,
          special, consequential, or punitive damages, or for lost profits, revenue, data, or goodwill. Our aggregate
          liability for claims relating to the service will not exceed the greater of the amount you paid us in the
          twelve months before the claim or USD 100.
        </p>
      </LegalSection>

      <LegalSection title="10. Indemnity">
        <p>
          You will indemnify and hold harmless {site.companyName} from claims, damages, and expenses arising from your
          use of the service, your submitted targets, or your violation of these terms or applicable law.
        </p>
      </LegalSection>

      <LegalSection title="11. Suspension and termination">
        <p>
          We may suspend or terminate access if we believe you have violated these terms, created risk for others, or
          used the service unlawfully. You may stop using the service at any time. Sections that by their nature should
          survive termination will survive.
        </p>
      </LegalSection>

      <LegalSection title="12. Changes">
        <p>
          We may update these terms as the service evolves. Material changes will be posted on this page with a new
          “last updated” date. Continued use after a change means you accept the updated terms.
        </p>
      </LegalSection>

      <LegalSection title="13. Governing law">
        <p>
          These terms are governed by the laws of {jurisdiction}, without regard to conflict-of-law rules. Courts in
          that jurisdiction will have exclusive jurisdiction, unless mandatory law provides otherwise.
        </p>
      </LegalSection>

      <LegalSection title="14. Contact">
        <p>
          Questions about these terms:{" "}
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
