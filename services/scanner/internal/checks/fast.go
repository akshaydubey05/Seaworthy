package checks

import (
	"net/url"
	"strings"

	"github.com/akshaydubey05/seaworthy/scanner/internal/model"
)

var FastChecks = []Check{
	{
		ID: "SW-001", Name: "Supabase service role key", Category: "Secrets", Severity: "critical", Type: "exposure", Source: "body",
		Run: func(c *Context) *model.Finding {
			if supabaseKeyRe.MatchString(c.HTML) {
				return finding("SW-001", "Possible Supabase service role credential exposed", "critical", "exposure", "confirmed", "A service_role reference appears next to a JWT-like token in publicly fetched content.", "Rotate the key immediately, keep it server-side only, and audit git history for exposure.")
			}
			return nil
		},
	},
	{
		ID: "SW-002", Name: "Stripe secret key", Category: "Secrets", Severity: "critical", Type: "exposure", Source: "body",
		Run: func(c *Context) *model.Finding {
			if stripeKeyRe.MatchString(c.HTML) {
				return finding("SW-002", "Possible Stripe live secret key exposed", "critical", "exposure", "confirmed", "Matched a Stripe live secret key pattern in publicly fetched content.", "Rotate the key in Stripe, move it to server-side env vars, and search git history.")
			}
			return nil
		},
	},
	{
		ID: "SW-003", Name: "AI provider key", Category: "Secrets", Severity: "critical", Type: "exposure", Source: "body",
		Run: func(c *Context) *model.Finding {
			if aiKeyRe.MatchString(c.HTML) {
				return finding("SW-003", "Possible AI/provider API key exposed", "critical", "exposure", "confirmed", "Matched a high-confidence API key prefix in publicly fetched content.", "Rotate the key, move calls server-side, and add spend limits.")
			}
			return nil
		},
	},
	{
		ID: "SW-004", Name: "Private key material", Category: "Secrets", Severity: "critical", Type: "exposure", Source: "body",
		Run: func(c *Context) *model.Finding {
			if privateKeyRe.MatchString(c.HTML) {
				return finding("SW-004", "Private key material exposed", "critical", "exposure", "confirmed", "Detected a private key block in publicly fetched content.", "Remove the key, rotate it immediately, and purge it from git history.")
			}
			return nil
		},
	},
	{
		ID: "SW-005", Name: "Env/debug leak", Category: "Secrets", Severity: "high", Type: "signal", Source: "body",
		Run: func(c *Context) *model.Finding {
			match := envSecretRe.FindStringSubmatch(c.HTML)
			if len(match) < 2 {
				return nil
			}
			return finding("SW-005", "Possible secret environment variable exposed", "high", "signal", "needs_validation", match[1]+" appears with a value-like assignment in public content (value redacted).", "Ensure secrets are server-only, not bundled to the client, and rotate if exposed.")
		},
	},
	{
		ID: "SW-006", Name: "Source maps", Category: "Exposure", Severity: "medium", Type: "signal", Source: "body",
		Run: func(c *Context) *model.Finding {
			inHTML := sourceMapRe.MatchString(c.HTML) || scriptMapRe.MatchString(c.HTML)
			inBundle := false
			for _, script := range c.Scripts {
				if scriptMapInJS.MatchString(script.Content) {
					inBundle = true
					break
				}
			}
			if inHTML || inBundle {
				return finding("SW-006", "Source maps may be exposed", "medium", "signal", "needs_validation", "Detected a sourceMappingURL or .js.map reference in fetched content.", "Disable production source maps or restrict access to them.")
			}
			return nil
		},
	},
	{
		ID: "SW-007", Name: "Exposed git/config path", Category: "Exposure", Severity: "medium", Type: "signal", Source: "body",
		Run: func(c *Context) *model.Finding {
			if sensitivePathRe.MatchString(c.HTML) {
				return finding("SW-007", "Sensitive path reference detected", "medium", "signal", "needs_validation", "Found a reference to a sensitive path in fetched content.", "Block access to .git/.env/config files and verify they are not deployed.")
			}
			return nil
		},
	},
	{
		ID: "SW-008", Name: "Supabase anon usage", Category: "Data access", Severity: "high", Type: "signal", Source: "body",
		Run: func(c *Context) *model.Finding {
			if supabaseUsageRe.MatchString(c.HTML) && supabaseAnonRe.MatchString(c.HTML) {
				return finding("SW-008", "Supabase client usage detected; RLS needs validation", "high", "signal", "needs_validation", "Detected Supabase URL/anon-key usage in client content. RLS cannot be confirmed from outside.", "Verify RLS is enabled on every table and that policies are not permissive.")
			}
			return nil
		},
	},
	{
		ID: "SW-009", Name: "Firebase public config", Category: "Data access", Severity: "medium", Type: "signal", Source: "body",
		Run: func(c *Context) *model.Finding {
			if firebaseRe.MatchString(c.HTML) && firebaseKeyRe.MatchString(c.HTML) {
				return finding("SW-009", "Firebase config exposed; rules need validation", "medium", "signal", "needs_validation", "Detected a Firebase web config in client content. Security rules cannot be confirmed from outside.", "Verify Firestore/Storage rules deny unauthorized access and restrict the API key.")
			}
			return nil
		},
	},
	{
		ID: "SW-010", Name: "Open admin/debug path", Category: "Access control", Severity: "medium", Type: "signal", Source: "body",
		Run: func(c *Context) *model.Finding {
			if adminPathRe.MatchString(c.HTML) {
				return finding("SW-010", "Admin/debug route reference exposed", "medium", "signal", "needs_validation", "Found links to admin/debug paths in public content.", "Ensure admin/debug routes require strong authentication and are not exposed in production.")
			}
			return nil
		},
	},
	{
		ID: "SW-011", Name: "Client-only auth signal", Category: "Access control", Severity: "medium", Type: "signal", Source: "body",
		Run: func(c *Context) *model.Finding {
			if localStorageRe.MatchString(c.HTML) {
				return finding("SW-011", "Client-stored auth token signal", "medium", "signal", "needs_validation", "Detected auth/token storage in localStorage patterns.", "Prefer HttpOnly secure cookies for session tokens and validate auth server-side.")
			}
			return nil
		},
	},
	{
		ID: "SW-012", Name: "Permissive CORS hint", Category: "API security", Severity: "medium", Type: "exposure", Source: "headers",
		Run: func(c *Context) *model.Finding {
			if header(c, "Access-Control-Allow-Origin") == "*" {
				return finding("SW-012", "Permissive CORS header detected", "medium", "exposure", "confirmed", "Access-Control-Allow-Origin is set to *.", "Restrict CORS to trusted origins, especially for authenticated endpoints.")
			}
			return nil
		},
	},
	{
		ID: "SW-013", Name: "CSP state", Category: "Headers", Severity: "low", Type: "hardening", Source: "headers",
		Run: func(c *Context) *model.Finding {
			if header(c, "Content-Security-Policy") != "" {
				return nil
			}
			reportOnly := header(c, "Content-Security-Policy-Report-Only")
			metaOnly := c.BodyScanned && regexpMatch(`(?i)<meta[^>]+http-equiv=["']?content-security-policy`, c.HTML)
			if reportOnly != "" || metaOnly {
				return finding("SW-013", "CSP is not enforcing yet", "low", "hardening", "confirmed", "A Content-Security-Policy is present only as report-only or in a meta tag, so it does not block anything yet.", "Review report-only violations, then ship an enforcing Content-Security-Policy header.")
			}
			severity := "low"
			if c.Sensitive {
				severity = "medium"
			}
			verdict := "confirmed"
			evidence := "No enforcing Content-Security-Policy header or meta tag was found."
			if !c.BodyScanned {
				verdict = "needs_validation"
				evidence = "No CSP header was found; the page body was not scanned, so a meta CSP could not be ruled out."
			}
			return finding("SW-013", "Content-Security-Policy header not set", severity, "hardening", verdict, evidence, "Add a CSP appropriate for your app to reduce XSS impact.")
		},
	},
	{
		ID: "SW-014", Name: "Frame protection", Category: "Headers", Severity: "low", Type: "hardening", Source: "headers",
		Run: func(c *Context) *model.Finding {
			xfo := header(c, "X-Frame-Options")
			csp := header(c, "Content-Security-Policy")
			if xfo != "" || regexpMatch(`(?i)frame-ancestors`, csp) {
				return nil
			}
			if regexpMatch(`(?i)frame-ancestors`, header(c, "Content-Security-Policy-Report-Only")) {
				return finding("SW-014", "Frame protection is report-only", "low", "hardening", "confirmed", "frame-ancestors appears only in a report-only CSP, which does not block framing.", "Move frame-ancestors into the enforcing CSP, or add X-Frame-Options.")
			}
			severity := "low"
			if c.Sensitive {
				severity = "medium"
			}
			return finding("SW-014", "Clickjacking protection not set", severity, "hardening", "confirmed", "No X-Frame-Options and no enforcing CSP frame-ancestors were found.", "Add X-Frame-Options: DENY (or SAMEORIGIN) or CSP frame-ancestors.")
		},
	},
	{
		ID: "SW-016", Name: "HSTS", Category: "Headers", Severity: "low", Type: "hardening", Source: "headers",
		Run: func(c *Context) *model.Finding {
			if c.URL.Scheme == "https" && header(c, "Strict-Transport-Security") == "" {
				return finding("SW-016", "HSTS header not set", "low", "hardening", "confirmed", "The HTTPS response did not include Strict-Transport-Security.", "Add HSTS after confirming every subdomain supports HTTPS: max-age=31536000; includeSubDomains.")
			}
			return nil
		},
	},
	{
		ID: "SW-017", Name: "X-Content-Type-Options", Category: "Headers", Severity: "low", Type: "hardening", Source: "headers",
		Run: func(c *Context) *model.Finding {
			if header(c, "X-Content-Type-Options") == "" {
				return finding("SW-017", "X-Content-Type-Options not set", "low", "hardening", "confirmed", "The response did not include X-Content-Type-Options: nosniff.", "Set X-Content-Type-Options: nosniff on HTML and API responses.")
			}
			return nil
		},
	},
	{
		ID: "SW-018", Name: "Referrer-Policy", Category: "Headers", Severity: "low", Type: "hardening", Source: "headers",
		Run: func(c *Context) *model.Finding {
			if header(c, "Referrer-Policy") != "" {
				return nil
			}
			if c.BodyScanned && regexpMatch(`(?i)<meta[^>]+name=["']?referrer`, c.HTML) {
				return nil
			}
			return finding("SW-018", "Referrer-Policy not set", "low", "hardening", "confirmed", "No Referrer-Policy header or meta referrer tag was observed for this client. Some sites vary headers by user agent or edge node.", "Set Referrer-Policy: strict-origin-when-cross-origin (or stricter).")
		},
	},
	{
		ID: "SW-019", Name: "Permissions-Policy", Category: "Headers", Severity: "low", Type: "hardening", Source: "headers",
		Run: func(c *Context) *model.Finding {
			if header(c, "Permissions-Policy") == "" {
				return finding("SW-019", "Permissions-Policy not set", "low", "hardening", "confirmed", "The response did not include Permissions-Policy. Note that some CDNs send different headers to different user agents.", "Disable browser features you do not use: camera=(), microphone=(), geolocation=().")
			}
			return nil
		},
	},
	{
		ID: "SW-020", Name: "Server header exposure", Category: "Exposure", Severity: "low", Type: "hardening", Source: "headers",
		Run: func(c *Context) *model.Finding {
			server := header(c, "Server")
			poweredBy := header(c, "X-Powered-By")
			versioned := regexpMatch(`\d`, server)
			if !versioned && poweredBy == "" {
				return nil
			}
			var parts []string
			if versioned {
				parts = append(parts, "server="+server)
			}
			if poweredBy != "" {
				parts = append(parts, "x-powered-by="+poweredBy)
			}
			return finding("SW-020", "Server technology details exposed", "low", "hardening", "confirmed", "Detected version/technology headers: "+strings.Join(parts, ", ")+".", "Remove or minimize version-revealing headers.")
		},
	},
	{
		ID: "SW-021", Name: "Directory listing/error leak", Category: "Exposure", Severity: "medium", Type: "signal", Source: "body",
		Run: func(c *Context) *model.Finding {
			if errorLeakRe.MatchString(c.HTML) {
				return finding("SW-021", "Possible debug/error information exposed", "medium", "signal", "needs_validation", "Detected debug/error/listing patterns in the public response.", "Disable verbose errors in production and turn off directory listing.")
			}
			return nil
		},
	},
	{
		ID: "SW-022", Name: "Insecure form action", Category: "Transport", Severity: "medium", Type: "exposure", Source: "body",
		Run: func(c *Context) *model.Finding {
			if c.URL.Scheme == "https" && httpActionRe.MatchString(c.HTML) {
				return finding("SW-022", "Insecure HTTP form action on HTTPS page", "medium", "exposure", "confirmed", "Found a form posting to an http:// URL from an HTTPS page.", "Use HTTPS for all form actions.")
			}
			return nil
		},
	},
	{
		ID: "SW-023", Name: "Mixed content", Category: "Transport", Severity: "medium", Type: "signal", Source: "body",
		Run: func(c *Context) *model.Finding {
			if c.URL.Scheme == "https" && hasMixedContent(c.HTML) {
				return finding("SW-023", "Possible mixed content on HTTPS page", "medium", "signal", "needs_validation", "Found an http:// resource loaded from an HTTPS page (src, poster, form action, or stylesheet).", "Serve all assets and endpoints over HTTPS.")
			}
			return nil
		},
	},
	{
		ID: "SW-024", Name: "Open redirect parameter signal", Category: "API security", Severity: "low", Type: "signal", Source: "url",
		Run: func(c *Context) *model.Finding {
			if redirectParamRe.MatchString(c.URL.RawQuery) {
				return finding("SW-024", "Redirect parameter present; open redirect needs validation", "low", "signal", "needs_validation", "The URL contains a redirect-style parameter.", "Validate redirect targets against an allowlist and reject external URLs.")
			}
			return nil
		},
	},
	{
		ID: "SW-025", Name: "File upload surface", Category: "Input handling", Severity: "low", Type: "signal", Source: "body",
		Run: func(c *Context) *model.Finding {
			if fileInputRe.MatchString(c.HTML) {
				return finding("SW-025", "File upload input detected; validation needs review", "low", "signal", "needs_validation", "Detected a file upload control in public content.", "Validate file type and size server-side, store uploads outside the web root, and scan them.")
			}
			return nil
		},
	},
	{
		ID: "SW-026", Name: "Database error details", Category: "Input handling", Severity: "medium", Type: "exposure", Source: "body",
		Run: func(c *Context) *model.Finding {
			if dbErrorRe.MatchString(c.HTML) {
				return finding("SW-026", "Database error details exposed", "medium", "exposure", "confirmed", "Detected database error patterns in the response.", "Hide raw database errors and use parameterized queries.")
			}
			return nil
		},
	},
	{
		ID: "SW-027", Name: "Cookie security flags", Category: "Auth/session", Severity: "medium", Type: "exposure", Source: "headers",
		Run: func(c *Context) *model.Finding {
			var names []string
			for _, cookie := range setCookies(c) {
				parts := strings.SplitN(cookie, "=", 2)
				name := strings.ToLower(strings.TrimSpace(parts[0]))
				if name == "" || !regexpMatch(`(?i)session|sid|auth|token|jwt|connect\.sid`, name) {
					continue
				}
				if !regexpMatch(`(?i)httponly`, cookie) || !regexpMatch(`(?i)secure`, cookie) {
					names = append(names, strings.TrimSpace(parts[0]))
				}
			}
			if len(names) == 0 {
				return nil
			}
			return finding("SW-027", "Session cookie missing security flags", "medium", "exposure", "confirmed", "Session-like cookie(s) missing HttpOnly or Secure: "+strings.Join(names, ", ")+".", "Set Secure, HttpOnly, and an appropriate SameSite value on session cookies.")
		},
	},
	{
		ID: "SW-028", Name: "Password/autocomplete signal", Category: "Auth/session", Severity: "low", Type: "hardening", Source: "body",
		Run: func(c *Context) *model.Finding {
			if passwordRe.MatchString(c.HTML) && autocompleteOffRe.MatchString(c.HTML) {
				return finding("SW-028", "Password autocomplete disabled", "low", "hardening", "needs_validation", "A password input with autocomplete=off was detected.", "Allow password managers by using the appropriate autocomplete attributes.")
			}
			return nil
		},
	},
	{
		ID: "SW-029", Name: "Privacy/terms links", Category: "Trust/compliance", Severity: "low", Type: "hardening", Source: "body",
		Run: func(c *Context) *model.Finding {
			if c.Truncated {
				return nil
			}
			privacy := privacyTextRe.MatchString(c.HTML) || privacyHrefRe.MatchString(c.HTML)
			terms := termsTextRe.MatchString(c.HTML) || termsHrefRe.MatchString(c.HTML)
			if privacy && terms {
				return nil
			}
			return finding("SW-029", "Privacy/terms links not detected in HTML", "low", "hardening", "needs_validation", "Could not find both privacy and terms links in the fetched HTML. Footer links may be rendered client-side.", "Add visible Privacy Policy and Terms links before charging users.")
		},
	},
	{
		ID: "SW-030", Name: "Public fetch failure", Category: "Availability", Severity: "medium", Type: "signal", Source: "url",
		Run: func(c *Context) *model.Finding {
			if c.FetchError != "" {
				return finding("SW-030", "Public fetch could not be completed", "medium", "signal", "needs_validation", "Fetch error: "+c.FetchError, "Confirm the URL is public and reachable over HTTPS, then run a verified deep audit.")
			}
			return nil
		},
	},
	{
		ID: "SW-031", Name: "Plain HTTP target", Category: "Transport", Severity: "medium", Type: "exposure", Source: "url",
		Run: func(c *Context) *model.Finding {
			if c.FinalURL.Scheme == "http" {
				return finding("SW-031", "Target is served over plain HTTP", "medium", "exposure", "confirmed", "The final response uses http://, so content and credentials can be intercepted or modified in transit.", "Serve the app over HTTPS and redirect all HTTP traffic to HTTPS.")
			}
			return nil
		},
	},
	{
		ID: "SW-032", Name: "Secret in client JavaScript", Category: "Secrets", Severity: "critical", Type: "exposure", Source: "body",
		Run: func(c *Context) *model.Finding {
			for _, script := range c.Scripts {
				hit := findSecret(script.Content, bundleSecretPatterns)
				if hit == nil {
					continue
				}
				return finding("SW-032", "Possible "+hit.label+" in client JavaScript", hit.severity, "exposure", "confirmed", hit.label+" pattern matched in "+shortURL(script.URL)+" (value redacted: "+redact(hit.value)+"). Anything shipped in a browser bundle is public.", "Remove the secret from client bundles, rotate it immediately, and call the provider from a server route or function.")
			}
			return nil
		},
	},
	{
		ID: "SW-033", Name: "CSP quality", Category: "Headers", Severity: "low", Type: "hardening", Source: "headers",
		Run: func(c *Context) *model.Finding {
			csp := header(c, "Content-Security-Policy")
			if csp == "" {
				return nil
			}
			directives := parseCSP(csp)
			scriptSrc := directives["script-src"]
			if scriptSrc == "" {
				scriptSrc = directives["default-src"]
			}
			hasNonceOrHash := regexpMatch(`(?i)'nonce-|'sha(?:256|384|512)-|'strict-dynamic'`, scriptSrc)
			var issues []string
			if regexpMatch(`(?i)'unsafe-eval'`, scriptSrc) {
				issues = append(issues, "'unsafe-eval' is allowed")
			}
			if regexpMatch(`(?i)'unsafe-inline'`, scriptSrc) && !hasNonceOrHash {
				issues = append(issues, "'unsafe-inline' is allowed without a nonce, hash, or strict-dynamic")
			}
			if directives["object-src"] == "" && directives["default-src"] == "" {
				issues = append(issues, "object-src is not restricted")
			}
			if len(issues) == 0 {
				return nil
			}
			return finding("SW-033", "Content-Security-Policy is weak", "low", "hardening", "confirmed", "The enforcing CSP has gaps: "+strings.Join(issues, "; ")+".", "Tighten script-src with nonces or hashes, remove unsafe-eval, and set object-src 'none'.")
		},
	},
	{
		ID: "SW-034", Name: "Cloud provider token", Category: "Secrets", Severity: "critical", Type: "exposure", Source: "body",
		Run: func(c *Context) *model.Finding {
			hit := findSecret(c.HTML, cloudTokenPatterns)
			if hit == nil {
				return nil
			}
			return finding("SW-034", "Possible "+hit.label+" exposed in page content", hit.severity, "exposure", "confirmed", hit.label+" pattern matched in public HTML (value redacted: "+redact(hit.value)+").", "Rotate the credential, move it to a server-side secret store, and audit git history for other copies.")
		},
	},
	{
		ID: "SW-035", Name: "Subresource integrity", Category: "Supply chain", Severity: "low", Type: "hardening", Source: "body",
		Run: func(c *Context) *model.Finding {
			var missing int
			for _, match := range externalScriptRe.FindAllStringSubmatch(c.HTML, -1) {
				tag, raw := match[0], match[1]
				if regexpMatch(`(?i)\bintegrity\s*=`, tag) {
					continue
				}
				u, err := url.Parse(raw)
				if err != nil || u.Host == "" || u.Host == c.URL.Host {
					continue
				}
				missing++
			}
			if missing == 0 {
				return nil
			}
			return finding("SW-035", "External script without Subresource Integrity", "low", "hardening", "needs_validation", fmtInt(missing)+" cross-origin script(s) have no integrity attribute.", "Add integrity + crossorigin to static third-party scripts where the provider supports it.")
		},
	},
}

func regexpMatch(pattern, value string) bool {
	if value == "" {
		return false
	}
	re, err := cachedRegexp(pattern)
	if err != nil {
		return false
	}
	return re.MatchString(value)
}
