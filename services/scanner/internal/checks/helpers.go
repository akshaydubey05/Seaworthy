package checks

import (
	"context"
	"fmt"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"sync"

	"github.com/akshaydubey05/seaworthy/scanner/internal/model"
)

type Context struct {
	URL              *url.URL
	FinalURL         *url.URL
	HTML             string
	Lower            string
	Headers          http.Header
	FetchError       string
	BodyScanned      bool
	Truncated        bool
	HasForms         bool
	HasPasswordForm  bool
	HasPaymentScript bool
	Sensitive        bool
	Scripts          []model.Script
	Mode             string
	Ctx              context.Context

	// Deep hooks. Nil means the check is skipped or the engine default is used.
	FetchText func(context.Context, *url.URL) (string, error)
	TLSProbe  func(host string) (daysLeft int, err error)
	TXTLookup func(host string) ([]string, error)
}

type Check struct {
	ID       string
	Name     string
	Category string
	Severity string
	Type     string
	Source   string // body | headers | both | url
	Run      func(*Context) *model.Finding
	AsyncRun func(*Context) (*model.Finding, error)
}

func finding(id, title, severity, typ, verdict, evidence, fix string) *model.Finding {
	return &model.Finding{ID: id, Title: title, Severity: severity, Verdict: verdict, Type: typ, Evidence: evidence, Fix: fix}
}

func header(c *Context, name string) string {
	if c.Headers == nil {
		return ""
	}
	return c.Headers.Get(name)
}

func setCookies(c *Context) []string {
	if c.Headers == nil {
		return nil
	}
	if values := c.Headers.Values("Set-Cookie"); len(values) > 0 {
		return values
	}
	if raw := c.Headers.Get("Set-Cookie"); raw != "" {
		return []string{raw}
	}
	return nil
}

type secretPattern struct {
	label    string
	re       *regexp.Regexp
	severity string
}

var cloudTokenPatterns = []secretPattern{
	{"AWS access key ID", regexp.MustCompile(`\b(?:AKIA|ASIA)[0-9A-Z]{16}\b`), "critical"},
	{"GitHub token", regexp.MustCompile(`\b(?:gh[pousr]_[A-Za-z0-9]{36,}|github_pat_[A-Za-z0-9_]{50,})\b`), "critical"},
	{"Slack token", regexp.MustCompile(`\bxox[baprs]-[A-Za-z0-9-]{10,}\b`), "critical"},
}

var bundleSecretPatterns = append(append([]secretPattern{}, cloudTokenPatterns...),
	secretPattern{"Stripe live secret key", regexp.MustCompile(`\bsk_live_[0-9a-zA-Z]{16,}\b`), "critical"},
	secretPattern{"AI provider key", regexp.MustCompile(`\bsk-(?:proj|svcacct|ant|or)-[A-Za-z0-9_-]{20,}\b|\bAIzaSy[A-Za-z0-9_-]{30,}\b`), "critical"},
	secretPattern{"private key block", regexp.MustCompile(`-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----`), "critical"},
	secretPattern{"Supabase service role JWT", regexp.MustCompile(`(?i)service_role[\s\S]{0,200}eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}`), "critical"},
)

type secretHit struct {
	label    string
	severity string
	value    string
}

func findSecret(text string, patterns []secretPattern) *secretHit {
	for _, pattern := range patterns {
		if match := pattern.re.FindString(text); match != "" {
			return &secretHit{label: pattern.label, severity: pattern.severity, value: match}
		}
	}
	return nil
}

func redact(value string) string {
	if len(value) <= 10 {
		if len(value) <= 2 {
			return value + "…"
		}
		return value[:2] + "…"
	}
	return fmt.Sprintf("%s…%d chars", value[:6], len(value))
}

func shortURL(raw string) string {
	u, err := url.Parse(raw)
	if err != nil {
		return raw
	}
	return u.Scheme + "://" + u.Host + u.Path
}

func parseCSP(value string) map[string]string {
	out := map[string]string{}
	for _, part := range strings.Split(value, ";") {
		fields := strings.Fields(strings.TrimSpace(part))
		if len(fields) == 0 {
			continue
		}
		out[strings.ToLower(fields[0])] = strings.Join(fields[1:], " ")
	}
	return out
}

var mixedContentRe = regexp.MustCompile(`(?i)(?:src|poster|action)\s*=\s*["']http://([^"']+)|<link\b[^>]*\bhref\s*=\s*["']http://([^"']+)`)

func hasMixedContent(html string) bool {
	for _, match := range mixedContentRe.FindAllStringSubmatch(html, -1) {
		target := match[1]
		if target == "" {
			target = match[2]
		}
		target = strings.ToLower(target)
		if strings.HasPrefix(target, "localhost") || strings.HasPrefix(target, "127.0.0.1") {
			continue
		}
		return true
	}
	return false
}

var (
	supabaseKeyRe     = regexp.MustCompile(`(?i)service_role[\s\S]{0,200}eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}|eyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}[\s\S]{0,200}service_role`)
	stripeKeyRe       = regexp.MustCompile(`\bsk_live_[0-9a-zA-Z]{16,}`)
	aiKeyRe           = regexp.MustCompile(`\bsk-(?:proj|svcacct|ant|or)-[A-Za-z0-9_-]{20,}|\bAIzaSy[A-Za-z0-9_-]{30,}`)
	privateKeyRe      = regexp.MustCompile(`-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----`)
	envSecretRe       = regexp.MustCompile(`\b(DATABASE_URL|AWS_SECRET_ACCESS_KEY|NEXTAUTH_SECRET|SUPABASE_SERVICE_ROLE_KEY)\s*[:=]\s*["']?[A-Za-z0-9_\-:/@.]{12,}`)
	sourceMapRe       = regexp.MustCompile(`(?i)sourceMappingURL=`)
	scriptMapRe       = regexp.MustCompile(`(?i)src=["'][^"']+\.js\.map`)
	scriptMapInJS     = regexp.MustCompile(`(?i)sourceMappingURL=\s*\S+\.map`)
	sensitivePathRe   = regexp.MustCompile(`(?i)(?:href|src|action)=["'][^"']*/(?:\.git|\.env)\b|["'][^"']*wp-config\.php`)
	supabaseUsageRe   = regexp.MustCompile(`(?i)supabase\.co`)
	supabaseAnonRe    = regexp.MustCompile(`(?i)(?:anon|publishable)[_-]?key`)
	firebaseRe        = regexp.MustCompile(`(?i)(?:firebaseio\.com|firebaseapp\.com|firestore\.googleapis\.com|firebaseConfig)`)
	firebaseKeyRe     = regexp.MustCompile(`(?i)apiKey["']?\s*[:=]`)
	adminPathRe       = regexp.MustCompile(`(?i)(?:href|action)=["'][^"']*/(?:admin|debug)\b`)
	localStorageRe    = regexp.MustCompile(`(?i)localStorage\.(?:getItem|setItem)\(\s*["'](?:token|auth|jwt|access_token)`)
	errorLeakRe       = regexp.MustCompile(`(?i)Traceback \(most recent call last\)|SQLSTATE\[\d+\]|Stack trace:|Fatal error:|Uncaught \w*Exception|Index of /`)
	httpActionRe      = regexp.MustCompile(`(?i)action=["']http://`)
	redirectParamRe   = regexp.MustCompile(`(?i)[?&](?:redirect|next|returnTo|url)=`)
	fileInputRe       = regexp.MustCompile(`(?i)type=["']file["']`)
	dbErrorRe         = regexp.MustCompile(`(?i)SQL syntax|mysql_fetch|sqlite3\.OperationalError|PostgreSQL query failed|SQLSTATE\[\d+\]`)
	autocompleteOffRe = regexp.MustCompile(`(?i)autocomplete=["']off["']`)
	passwordRe        = regexp.MustCompile(`(?i)type=["']password["']`)
	privacyTextRe     = regexp.MustCompile(`(?i)privacy policy|privacy notice`)
	privacyHrefRe     = regexp.MustCompile(`(?i)href=["'][^"']*privacy`)
	termsTextRe       = regexp.MustCompile(`(?i)terms of (?:service|use)|terms and conditions`)
	termsHrefRe       = regexp.MustCompile(`(?i)href=["'][^"']*terms`)
)

// Score applies the same weights as the TypeScript engine.
func Score(findings []model.Finding) (score int, hardeningScore int) {
	exposureWeights := map[string]float64{"critical": 32, "high": 20, "medium": 10, "low": 4}
	signalWeights := map[string]float64{"critical": 10, "high": 7, "medium": 4, "low": 2}
	hardeningWeights := map[string]float64{"critical": 3, "high": 2, "medium": 1, "low": 0.5}
	hardeningScoreWeights := map[string]float64{"critical": 25, "high": 15, "medium": 8, "low": 3}

	var exposure, signal, hardening, hardeningForScore float64
	for _, f := range findings {
		if f.Verdict == "rejected" {
			continue
		}
		switch f.Type {
		case "exposure":
			exposure += exposureWeights[f.Severity]
		case "signal":
			signal += signalWeights[f.Severity]
		default:
			hardening += hardeningWeights[f.Severity]
			hardeningForScore += hardeningScoreWeights[f.Severity]
		}
	}

	raw := 100 - exposure - signal - minFloat(hardening, 6)
	score = clampInt(intRound(raw), 5, 100)
	hardeningScore = clampInt(intRound(100-hardeningForScore), 0, 100)
	return score, hardeningScore
}

func minFloat(a, b float64) float64 {
	if a < b {
		return a
	}
	return b
}

func intRound(v float64) int {
	if v < 0 {
		return int(v - 0.5)
	}
	return int(v + 0.5)
}

func clampInt(v, lo, hi int) int {
	if v < lo {
		return lo
	}
	if v > hi {
		return hi
	}
	return v
}

func fmtInt(n int) string { return strconv.Itoa(n) }

var externalScriptRe = regexp.MustCompile(`(?i)<script\b[^>]*\bsrc\s*=\s*["'](https?://[^"']+)["'][^>]*>`)

var regexCache sync.Map

func cachedRegexp(pattern string) (*regexp.Regexp, error) {
	if cached, ok := regexCache.Load(pattern); ok {
		return cached.(*regexp.Regexp), nil
	}
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}
	regexCache.Store(pattern, re)
	return re, nil
}
