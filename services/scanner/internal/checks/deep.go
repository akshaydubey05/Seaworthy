package checks

import (
	"net/url"
	"strings"

	"github.com/akshaydubey05/seaworthy/scanner/internal/model"
)

var DeepChecks = []Check{
	{
		ID: "D-01", Name: "Source map disclosure", Category: "Exposure", Severity: "high", Type: "exposure", Source: "body",
		Run: func(c *Context) *model.Finding {
			count := 0
			for _, script := range c.Scripts {
				if scriptMapInJS.MatchString(script.Content) {
					count++
				}
			}
			if count == 0 {
				return nil
			}
			return finding("D-01", "JavaScript source maps appear publicly reachable", "high", "exposure", "needs_validation", fmtInt(count)+" scanned bundle(s) reference source maps. Source maps can expose original source, routes, and secrets.", "Disable production source maps or serve them only behind authenticated access.")
		},
	},
	{
		ID: "D-02", Name: "Security.txt", Category: "Trust/compliance", Severity: "low", Type: "hardening", Source: "url",
		AsyncRun: func(c *Context) (*model.Finding, error) {
			if c.FetchText == nil {
				return nil, nil
			}
			u := c.FinalURL.ResolveReference(&url.URL{Path: "/.well-known/security.txt"})
			text, err := c.FetchText(c.Ctx, u)
			if err != nil {
				return nil, nil
			}
			if regexpMatch(`(?i)contact:`, text) {
				return nil, nil
			}
			return finding("D-02", "security.txt not detected", "low", "hardening", "needs_validation", "No /.well-known/security.txt with a Contact field was found.", "Add /.well-known/security.txt so researchers can report vulnerabilities responsibly."), nil
		},
	},
	{
		ID: "D-03", Name: "TLS certificate", Category: "Transport", Severity: "high", Type: "exposure", Source: "url",
		AsyncRun: func(c *Context) (*model.Finding, error) {
			if c.FinalURL.Scheme != "https" || c.TLSProbe == nil {
				return nil, nil
			}
			days, err := c.TLSProbe(c.FinalURL.Hostname())
			if err != nil {
				return finding("D-03", "TLS connection could not be verified", "high", "signal", "needs_validation", "TLS probe failed: "+err.Error()+".", "Verify the certificate chain, hostname, and TLS configuration."), nil
			}
			if days <= 14 {
				severity := "medium"
				if days <= 3 {
					severity = "high"
				}
				return finding("D-03", "TLS certificate expires soon", severity, "exposure", "confirmed", "Certificate expires in "+fmtInt(days)+" day(s).", "Renew the certificate and enable automatic renewal."), nil
			}
			return nil, nil
		},
	},
	{
		ID: "D-04", Name: "Email spoofing posture", Category: "Trust/compliance", Severity: "medium", Type: "signal", Source: "url",
		AsyncRun: func(c *Context) (*model.Finding, error) {
			if c.TXTLookup == nil {
				return nil, nil
			}
			host := strings.TrimPrefix(strings.ToLower(c.FinalURL.Hostname()), "www.")
			spfRecords, spfErr := c.TXTLookup(host)
			dmarcRecords, dmarcErr := c.TXTLookup("_dmarc." + host)
			if spfErr != nil && dmarcErr != nil {
				return nil, nil
			}
			spf := containsRecord(spfRecords, "v=spf1")
			dmarc := containsRecord(dmarcRecords, "v=DMARC1")
			if spf && dmarc {
				return nil, nil
			}
			var missing []string
			if !spf {
				missing = append(missing, "SPF")
			}
			if !dmarc {
				missing = append(missing, "DMARC")
			}
			return finding("D-04", "Email authentication records missing", "medium", "signal", "needs_validation", strings.Join(missing, " and ")+" record not found for "+host+".", "Add SPF and DMARC records to reduce spoofing/phishing risk from your domain."), nil
		},
	},
	{
		ID: "D-05", Name: "Cross-origin isolation", Category: "Headers", Severity: "low", Type: "hardening", Source: "headers",
		Run: func(c *Context) *model.Finding {
			if !c.Sensitive {
				return nil
			}
			coop := header(c, "Cross-Origin-Opener-Policy")
			corp := header(c, "Cross-Origin-Resource-Policy")
			if coop != "" && corp != "" {
				return nil
			}
			var missing []string
			if coop == "" {
				missing = append(missing, "COOP")
			}
			if corp == "" {
				missing = append(missing, "CORP")
			}
			return finding("D-05", "Cross-origin isolation headers missing", "low", "hardening", "needs_validation", "Missing "+strings.Join(missing, " and ")+" on a sensitive page.", "Consider COOP/CORP for sensitive surfaces to reduce cross-origin attack surface.")
		},
	},
	{
		ID: "D-06", Name: "CORS credentials with wildcard", Category: "API security", Severity: "high", Type: "exposure", Source: "headers",
		Run: func(c *Context) *model.Finding {
			if header(c, "Access-Control-Allow-Origin") == "*" && regexpMatch(`(?i)true`, header(c, "Access-Control-Allow-Credentials")) {
				return finding("D-06", "Dangerous CORS configuration", "high", "exposure", "confirmed", "Access-Control-Allow-Origin is * while credentials are allowed.", "Never combine wildcard origin with credentials. Restrict to trusted origins.")
			}
			return nil
		},
	},
	{
		ID: "D-07", Name: "Robots disclosure", Category: "Exposure", Severity: "low", Type: "signal", Source: "url",
		AsyncRun: func(c *Context) (*model.Finding, error) {
			if c.FetchText == nil {
				return nil, nil
			}
			u := c.FinalURL.ResolveReference(&url.URL{Path: "/robots.txt"})
			text, err := c.FetchText(c.Ctx, u)
			if err != nil || text == "" {
				return nil, nil
			}
			re, err := cachedRegexp(`(?i)Disallow:\s*/(?:admin|api|internal|debug|private|backup|\.env|\.git)`)
			if err != nil {
				return nil, nil
			}
			match := re.FindString(text)
			if match == "" {
				return nil, nil
			}
			return finding("D-07", "Robots.txt reveals sensitive paths", "low", "signal", "needs_validation", "robots.txt disallows sensitive-looking paths (e.g. "+strings.TrimSpace(match)+"). This is disclosure, not protection.", "Do not rely on robots.txt for security; protect sensitive paths with auth and avoid advertising them."), nil
		},
	},
	{
		ID: "D-08", Name: "CSP missing base/object restrictions", Category: "Headers", Severity: "low", Type: "hardening", Source: "headers",
		Run: func(c *Context) *model.Finding {
			csp := header(c, "Content-Security-Policy")
			if csp == "" {
				return nil
			}
			directives := parseCSP(csp)
			var missing []string
			if directives["base-uri"] == "" && directives["default-src"] == "" {
				missing = append(missing, "base-uri")
			}
			if directives["object-src"] == "" && directives["default-src"] == "" {
				missing = append(missing, "object-src")
			}
			if len(missing) == 0 {
				return nil
			}
			return finding("D-08", "CSP missing important directives", "low", "hardening", "confirmed", "CSP is present but missing: "+strings.Join(missing, ", ")+".", "Add base-uri 'self' and object-src 'none' to reduce injection and plugin-based attacks.")
		},
	},
}

func containsRecord(records []string, needle string) bool {
	for _, record := range records {
		if strings.Contains(strings.ToLower(record), strings.ToLower(needle)) {
			return true
		}
	}
	return false
}
