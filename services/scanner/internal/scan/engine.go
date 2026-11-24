package scan

import (
	"context"
	"crypto/rand"
	"crypto/tls"
	"encoding/hex"
	"errors"
	"fmt"
	"net"
	"net/http"
	"net/url"
	"regexp"
	"strconv"
	"strings"
	"time"

	"github.com/akshaydubey05/seaworthy/scanner/internal/checks"
	"github.com/akshaydubey05/seaworthy/scanner/internal/fetch"
	"github.com/akshaydubey05/seaworthy/scanner/internal/model"
	"github.com/akshaydubey05/seaworthy/scanner/internal/netguard"
)

const (
	DefaultUserAgent = "SeaworthyScanner/1.1 (+https://seaworthy.dev)"
	fastTimeout      = 45 * time.Second
	deepTimeout      = 120 * time.Second
)

type Options struct {
	AllowPrivate     bool // test-only
	AllowAnyPort     bool // test-only
	LookupIP         netguard.LookupFunc
	HTTPClient       *http.Client
	UserAgent        string
	MaxResponseBytes int
	FastScripts      int
	DeepScripts      int
	FastScriptBytes  int
	DeepScriptBytes  int
	FetchText        func(context.Context, *url.URL) (string, error)
	TLSProbe         func(host string) (int, error)
	TXTLookup        func(host string) ([]string, error)
	Now              func() time.Time
}

type Engine struct {
	opts    Options
	fetcher *fetch.Client
}

func New(opts Options) *Engine {
	if opts.UserAgent == "" {
		opts.UserAgent = DefaultUserAgent
	}
	if opts.MaxResponseBytes <= 0 {
		opts.MaxResponseBytes = fetch.DefaultMaxBytes
	}
	if opts.FastScripts <= 0 {
		opts.FastScripts = 2
	}
	if opts.DeepScripts <= 0 {
		opts.DeepScripts = 8
	}
	if opts.FastScriptBytes <= 0 {
		opts.FastScriptBytes = 150_000
	}
	if opts.DeepScriptBytes <= 0 {
		opts.DeepScriptBytes = 300_000
	}
	if opts.Now == nil {
		opts.Now = time.Now
	}
	client := fetch.New(opts.UserAgent)
	if opts.HTTPClient != nil {
		client.HTTP = opts.HTTPClient
	}
	client.Lookup = opts.LookupIP
	client.AllowPrivate = opts.AllowPrivate
	client.AllowAnyPort = opts.AllowAnyPort
	client.MaxBytes = opts.MaxResponseBytes
	return &Engine{opts: opts, fetcher: client}
}

func (e *Engine) Scan(ctx context.Context, input, mode string) (*model.Result, error) {
	if mode != "fast" && mode != "deep" {
		mode = "fast"
	}
	started := e.opts.Now()
	u, err := netguard.Normalize(input, e.opts.AllowPrivate, e.opts.AllowAnyPort)
	if err != nil {
		return nil, err
	}

	timeout := fastTimeout
	if mode == "deep" {
		timeout = deepTimeout
	}
	scanCtx, cancel := context.WithTimeout(ctx, timeout)
	defer cancel()

	var page *fetch.Page
	var fetchErrText string
	page, err = e.fetcher.FetchPage(scanCtx, u)
	if err != nil {
		if errors.Is(err, netguard.ErrInvalid) {
			return nil, err
		}
		fetchErrText = err.Error()
		page = nil
	}

	finalURL := u
	var headers http.Header
	var html, contentType string
	var status int
	var truncated bool
	if page != nil {
		finalURL = page.FinalURL
		headers = page.Headers
		html = page.Body
		contentType = page.ContentType
		status = page.Status
		truncated = page.Truncated
	}

	bodyScanned := fetchErrText == "" && status > 0 && status < 400 &&
		(regexpContains(contentType, `(?i)text/html|application/xhtml\+xml`)) && len(html) > 0
	lower := strings.ToLower(html)
	hasForms := regexpContains(html, `(?i)<form\b`)
	hasPasswordForm := regexpContains(html, `(?i)type=["']?password`)
	hasPaymentScript := regexpContains(html, `(?i)js\.stripe\.com/v3|checkout\.stripe\.com`)
	sensitive := hasPasswordForm || hasPaymentScript

	scriptLimit, scriptBytes := e.opts.FastScripts, e.opts.FastScriptBytes
	if mode == "deep" {
		scriptLimit, scriptBytes = e.opts.DeepScripts, e.opts.DeepScriptBytes
	}
	var scripts []model.Script
	if bodyScanned {
		scripts = e.fetcher.FetchScripts(scanCtx, html, finalURL, scriptLimit, scriptBytes)
	}

	ctxInfo := model.Context{
		FinalURL:         finalURL.String(),
		Status:           status,
		ContentType:      contentType,
		BodyScanned:      bodyScanned,
		Truncated:        truncated,
		HasForms:         hasForms,
		HasPasswordForm:  hasPasswordForm,
		HasPaymentScript: hasPaymentScript,
		Sensitive:        sensitive,
		ScriptsScanned:   len(scripts),
	}

	checkCtx := &checks.Context{
		URL:              u,
		FinalURL:         finalURL,
		HTML:             html,
		Lower:            lower,
		Headers:          headers,
		FetchError:       fetchErrText,
		BodyScanned:      bodyScanned,
		Truncated:        truncated,
		HasForms:         hasForms,
		HasPasswordForm:  hasPasswordForm,
		HasPaymentScript: hasPaymentScript,
		Sensitive:        sensitive,
		Scripts:          scripts,
		Mode:             mode,
		Ctx:              scanCtx,
		FetchText:        e.opts.FetchText,
		TLSProbe:         e.opts.TLSProbe,
		TXTLookup:        e.opts.TXTLookup,
	}
	manualChecks := checks.BuildManualChecks(checkCtx)
	if checkCtx.FetchText == nil {
		checkCtx.FetchText = e.fetcher.FetchText
	}
	if checkCtx.TLSProbe == nil {
		checkCtx.TLSProbe = probeTLS
	}
	if checkCtx.TXTLookup == nil {
		checkCtx.TXTLookup = net.LookupTXT
	}

	findings, runs := runChecks(checkCtx, checks.FastChecks)
	totalChecks := len(checks.FastChecks)
	var notes []string

	if mode == "deep" {
		deepFindings, deepRuns := runChecks(checkCtx, checks.DeepChecks)
		findings = append(findings, deepFindings...)
		runs = append(runs, deepRuns...)
		totalChecks += len(checks.DeepChecks)
	}

	notes = buildNotes(u, ctxInfo, findings)
	if mode == "deep" {
		notes = append(notes,
			"Deep scan includes same-origin JS bundle scanning, TLS/cert checks, DNS email-auth checks, and security.txt/robots probes.",
			"Deep scan still does not authenticate, crawl private routes, or exploit vulnerabilities.",
		)
	}

	result := finalize(u, finalURL, mode, ctxInfo, findings, runs, manualChecks, notes, totalChecks, started, e.opts.Now())
	return result, nil
}

func runChecks(c *checks.Context, defs []checks.Check) ([]model.Finding, []model.CheckRun) {
	var findings []model.Finding
	var runs []model.CheckRun
	for _, check := range defs {
		needsBody := check.Source == "body" || check.Source == "both"
		needsHeaders := check.Source == "headers" || check.Source == "both"
		if (needsBody && !c.BodyScanned) || (needsHeaders && c.Headers == nil) {
			runs = append(runs, model.CheckRun{ID: check.ID, Name: check.Name, Category: check.Category, Status: "skipped", Severity: check.Severity, Type: check.Type})
			continue
		}

		finding, err := runOne(c, check)
		if err != nil {
			runs = append(runs, model.CheckRun{ID: check.ID, Name: check.Name, Category: check.Category, Status: "error", Severity: check.Severity, Type: check.Type})
			continue
		}
		if finding != nil {
			findings = append(findings, *finding)
			status := "fail"
			if finding.Verdict == "needs_validation" {
				status = "needs_validation"
			}
			runs = append(runs, model.CheckRun{ID: check.ID, Name: check.Name, Category: check.Category, Status: status, Severity: finding.Severity, Type: finding.Type})
		} else {
			runs = append(runs, model.CheckRun{ID: check.ID, Name: check.Name, Category: check.Category, Status: "pass", Severity: check.Severity, Type: check.Type})
		}
	}
	return findings, runs
}

func runOne(c *checks.Context, check checks.Check) (finding *model.Finding, err error) {
	defer func() {
		if r := recover(); r != nil {
			err = fmt.Errorf("check %s panicked: %v", check.ID, r)
		}
	}()
	if check.AsyncRun != nil {
		return check.AsyncRun(c)
	}
	return check.Run(c), nil
}

func finalize(originalURL, finalURL *url.URL, mode string, ctxInfo model.Context, findings []model.Finding, runs []model.CheckRun, manualChecks []model.ManualCheck, notes []string, totalChecks int, started, now time.Time) *model.Result {
	deduped := dedupe(findings)
	score, hardeningScore := checks.Score(deduped)
	checksRun := 0
	for _, run := range runs {
		if run.Status != "error" && run.Status != "skipped" {
			checksRun++
		}
	}
	coverage := 0
	if totalChecks > 0 {
		coverage = int(float64(checksRun)/float64(totalChecks)*100 + 0.5)
	}

	counts := model.Counts{}
	for _, f := range deduped {
		if f.Verdict == "confirmed" {
			counts.Confirmed++
		}
		if f.Verdict == "needs_validation" {
			counts.NeedsValidation++
		}
		switch f.Type {
		case "exposure":
			counts.Exposures++
		case "signal":
			counts.Signals++
		default:
			counts.Hardening++
		}
	}

	return &model.Result{
		URL:            originalURL.String(),
		FinalURL:       ctxInfo.FinalURL,
		Mode:           mode,
		Score:          score,
		HardeningScore: hardeningScore,
		Coverage:       coverage,
		ChecksRun:      checksRun,
		ChecksTotal:    totalChecks,
		DurationMS:     now.Sub(started).Milliseconds(),
		Findings:       deduped,
		ManualChecks:   manualChecks,
		Notes:          notes,
		Context:        ctxInfo,
		Summary:        buildSummary(deduped, ctxInfo),
		ReceiptID:      receiptID(now),
		Checks:         runs,
		Counts:         counts,
	}
}

func dedupe(findings []model.Finding) []model.Finding {
	seen := map[string]bool{}
	out := make([]model.Finding, 0, len(findings))
	for _, f := range findings {
		if seen[f.ID] {
			continue
		}
		seen[f.ID] = true
		out = append(out, f)
	}
	return out
}

func buildSummary(findings []model.Finding, ctx model.Context) string {
	if !ctx.BodyScanned {
		return fmt.Sprintf("Only response headers were evaluated (status %d, content-type %s). Content checks were skipped.", ctx.Status, emptyFallback(ctx.ContentType, "unknown"))
	}
	if len(findings) == 0 {
		return "No exposure signals or hardening gaps were observed on this public page. This is not a guarantee that the app is secure."
	}

	var exposures, signals, hardening, critical int
	for _, f := range findings {
		if f.Verdict == "rejected" {
			continue
		}
		switch f.Type {
		case "exposure":
			exposures++
		case "signal":
			signals++
		default:
			hardening++
		}
		if f.Severity == "critical" {
			critical++
		}
	}

	var parts []string
	if exposures > 0 {
		parts = append(parts, fmt.Sprintf("%d exposure signal%s", exposures, plural(exposures)))
	}
	if signals > 0 {
		parts = append(parts, fmt.Sprintf("%d item%s needing validation", signals, plural(signals)))
	}
	if hardening > 0 {
		parts = append(parts, fmt.Sprintf("%d hardening suggestion%s", hardening, plural(hardening)))
	}
	lead := "Found " + join(parts) + "."
	if exposures > 0 {
		extra := ""
		if critical > 0 {
			extra = fmt.Sprintf(" %d critical.", critical)
		}
		return lead + extra + " Review the evidence before launch; exposures are the highest priority."
	}
	return lead + " No exposure signals were observed. Hardening gaps are best-practice notes, not proof of exploitability."
}

func buildNotes(u *url.URL, ctx model.Context, findings []model.Finding) []string {
	var notes []string
	if ctx.FinalURL != u.String() {
		notes = append(notes, "The target redirected to "+ctx.FinalURL+". Results describe the final response.")
	}
	if !ctx.BodyScanned {
		notes = append(notes, fmt.Sprintf("The response was status %d with content-type %s. Body checks (secrets, links, mixed content) were skipped; only response headers were evaluated.", ctx.Status, emptyFallback(ctx.ContentType, "unknown")))
	}
	if ctx.Truncated {
		notes = append(notes, "The HTML response was truncated at 300 KB. Signals that appear later in the page may be missed.")
	}
	if ctx.ScriptsScanned > 0 {
		notes = append(notes, fmt.Sprintf("Scanned %d same-origin JavaScript bundle(s) for leaked credentials.", ctx.ScriptsScanned))
	}
	if ctx.Sensitive {
		notes = append(notes, "This page appears to have a login or payment surface. Validate auth, session handling, and webhook verification manually.")
	}
	if len(findings) == 0 {
		notes = append(notes, "A clean result covers one public page only. Authenticated routes, APIs, and runtime behavior were not tested.")
	}
	return notes
}

func receiptID(now time.Time) string {
	stamp := strings.ToUpper(strconv.FormatInt(now.UnixMilli(), 36))
	buf := make([]byte, 2)
	_, _ = rand.Read(buf)
	return "SW-" + stamp + "-" + strings.ToUpper(hex.EncodeToString(buf))
}

func probeTLS(host string) (int, error) {
	dialer := &net.Dialer{Timeout: 5 * time.Second}
	conn, err := tls.DialWithDialer(dialer, "tcp", net.JoinHostPort(host, "443"), &tls.Config{
		ServerName: host,
		MinVersion: tls.VersionTLS12,
	})
	if err != nil {
		return 0, err
	}
	defer conn.Close()
	certs := conn.ConnectionState().PeerCertificates
	if len(certs) == 0 {
		return 0, errors.New("no peer certificate")
	}
	return int(time.Until(certs[0].NotAfter).Hours() / 24), nil
}

func regexpContains(value, pattern string) bool {
	if value == "" {
		return false
	}
	ok, err := regexp.MatchString(pattern, value)
	if err != nil {
		return false
	}
	return ok
}

func emptyFallback(value, fallback string) string {
	if value == "" {
		return fallback
	}
	return value
}

func plural(n int) string {
	if n == 1 {
		return ""
	}
	return "s"
}

func join(parts []string) string {
	switch len(parts) {
	case 0:
		return ""
	case 1:
		return parts[0]
	case 2:
		return parts[0] + ", " + parts[1]
	default:
		return strings.Join(parts[:len(parts)-1], ", ") + ", " + parts[len(parts)-1]
	}
}
