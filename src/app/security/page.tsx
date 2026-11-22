import type { Metadata } from "next";
import { LegalPage, LegalSection } from "@/components/legal-page";
import { site, mailto } from "@/lib/site";

export const metadata: Metadata = {
  title: "Security & Responsible Disclosure — Seaworthy",
  description: "How to report a vulnerability in Seaworthy, and what is in scope.",
};

export default function SecurityPage() {
  return (
    <LegalPage
      eyebrow="Trust"
      title="Security & Responsible Disclosure"
      intro="We want to hear about security issues in Seaworthy. This page explains what is in scope, how to report, and what you can expect."
    >
      <LegalSection title="Report a vulnerability">
        <p>
          Email{" "}
          <a className="underline decoration-[rgba(236,241,236,0.25)] underline-offset-2 hover:text-[var(--text)]" href={mailto(site.securityEmail, "Seaworthy vulnerability report")}>
            {site.securityEmail}
          </a>{" "}
          with a description, reproduction steps, impact, and any supporting evidence. Please do not open a public issue
          for a suspected vulnerability.
        </p>
        <p>
          We aim to acknowledge reports within 2 business days and provide an initial assessment within 5 business days.
          These are best-effort targets, not a contractual SLA.
        </p>
      </LegalSection>

      <LegalSection title="In scope">
        <ul className="list-disc space-y-1 pl-5">
          <li>The Seaworthy website, application, and public API.</li>
          <li>Authentication, authorization, and session handling (when accounts are enabled).</li>
          <li>Server-side request forgery, injection, and access-control issues in Seaworthy itself.</li>
          <li>Exposure of Seaworthy secrets, customer data, or internal systems.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Out of scope">
        <ul className="list-disc space-y-1 pl-5">
          <li>Applications scanned by Seaworthy. Those belong to their owners; report issues to them.</li>
          <li>Denial-of-service, volumetric testing, or social engineering.</li>
          <li>Reports from automated scanners without a demonstrated impact.</li>
          <li>Missing headers or best-practice suggestions with no exploitable impact.</li>
          <li>Third-party services we use, unless the issue affects Seaworthy data.</li>
        </ul>
      </LegalSection>

      <LegalSection title="Safe harbor">
        <p>
          If you make a good-faith effort to follow this policy, avoid privacy violations and service disruption, and
          give us reasonable time to fix the issue before disclosure, we will not pursue legal action for that research.
          This safe harbor does not protect unlawful activity or testing outside the scope above.
        </p>
      </LegalSection>

      <LegalSection title="Disclosure and recognition">
        <p>
          Please give us a reasonable window to remediate before public disclosure. We are happy to credit researchers
          who want recognition. We do not currently run a paid bounty program; any reward is discretionary and agreed in
          writing before work begins.
        </p>
      </LegalSection>

      <LegalSection title="Our own posture">
        <p>
          Seaworthy scans are best-effort automated reviews and are not a penetration test or certification. We apply
          security headers, rate limiting, SSRF protections, secret redaction, and least-privilege infrastructure to our
          own service. Our public health endpoint is available at{" "}
          <a className="underline decoration-[rgba(236,241,236,0.25)] underline-offset-2 hover:text-[var(--text)]" href="/api/health">
            /api/health
          </a>
          .
        </p>
      </LegalSection>
    </LegalPage>
  );
}
