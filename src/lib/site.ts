const rawUrl = process.env.NEXT_PUBLIC_APP_URL?.trim();
const rawContact = process.env.NEXT_PUBLIC_CONTACT_EMAIL?.trim();
const rawSecurity = process.env.NEXT_PUBLIC_SECURITY_EMAIL?.trim();
const rawCompany = process.env.NEXT_PUBLIC_COMPANY_NAME?.trim();
const rawJurisdiction = process.env.NEXT_PUBLIC_JURISDICTION?.trim();

export const site = {
  name: "Seaworthy",
  url: (rawUrl || "https://seaworthy.dev").replace(/\/+$/, ""),
  contactEmail: rawContact || "hello@seaworthy.dev",
  securityEmail: rawSecurity || "security@seaworthy.dev",
  companyName: rawCompany || "Seaworthy",
  jurisdiction: rawJurisdiction || "",
  legalUpdated: "2026-11-23",
} as const;

export function mailto(email: string, subject?: string) {
  return subject ? `mailto:${email}?subject=${encodeURIComponent(subject)}` : `mailto:${email}`;
}
