import { site } from "@/lib/site";

export function GET() {
  const expires = new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString();
  const body = [
    `Contact: mailto:${site.securityEmail}`,
    `Expires: ${expires}`,
    "Preferred-Languages: en",
    `Canonical: ${site.url}/.well-known/security.txt`,
    `Policy: ${site.url}/security`,
    `Acknowledgments: ${site.url}/security`,
    "",
  ].join("\n");

  return new Response(body, {
    headers: {
      "Content-Type": "text/plain; charset=utf-8",
      "Cache-Control": "public, max-age=86400",
    },
  });
}
