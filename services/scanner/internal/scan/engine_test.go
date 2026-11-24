package scan

import (
	"context"
	"errors"
	"net"
	"net/http"
	"net/http/httptest"
	"net/url"
	"strings"
	"testing"

	"github.com/akshaydubey05/seaworthy/scanner/internal/fetch"
	"github.com/akshaydubey05/seaworthy/scanner/internal/netguard"
)

type fixtureSite struct {
	server *httptest.Server
	pages  map[string]fixturePage
}

type fixturePage struct {
	status  int
	ctype   string
	body    string
	headers map[string]string
}

func newFixture(t *testing.T, pages map[string]fixturePage) *fixtureSite {
	t.Helper()
	return newFixtureWithTLS(t, pages, false)
}

func newTLSFixture(t *testing.T, pages map[string]fixturePage) *fixtureSite {
	t.Helper()
	return newFixtureWithTLS(t, pages, true)
}

func newFixtureWithTLS(t *testing.T, pages map[string]fixturePage, useTLS bool) *fixtureSite {
	t.Helper()
	site := &fixtureSite{pages: pages}
	var server *httptest.Server
	handler := http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		page, ok := site.pages[r.URL.Path]
		if !ok {
			http.NotFound(w, r)
			return
		}
		if page.ctype != "" {
			w.Header().Set("Content-Type", page.ctype)
		}
		for key, value := range page.headers {
			w.Header().Set(key, value)
		}
		status := page.status
		if status == 0 {
			status = http.StatusOK
		}
		w.WriteHeader(status)
		_, _ = w.Write([]byte(page.body))
	})
	if useTLS {
		server = httptest.NewTLSServer(handler)
	} else {
		server = httptest.NewServer(handler)
	}
	site.server = server
	t.Cleanup(site.server.Close)
	return site
}

func (s *fixtureSite) engine(t *testing.T) *Engine {
	t.Helper()
	parsed, err := url.Parse(s.server.URL)
	if err != nil {
		t.Fatalf("parse fixture URL: %v", err)
	}
	host := parsed.Hostname()
	engine := New(Options{
		AllowPrivate: true,
		AllowAnyPort: true,
		LookupIP: func(context.Context, string) ([]net.IP, error) {
			return []net.IP{net.ParseIP(host)}, nil
		},
		FetchText: func(context.Context, *url.URL) (string, error) {
			return "", errors.New("not found")
		},
		TLSProbe: func(string) (int, error) {
			return 90, nil
		},
		TXTLookup: func(string) ([]string, error) {
			return []string{"v=spf1 -all", "v=DMARC1; p=reject"}, nil
		},
	})
	if strings.HasPrefix(s.server.URL, "https://") {
		engine.fetcher.HTTP = s.server.Client()
	}
	return engine
}

func hasFinding(result []string, id string) bool {
	for _, value := range result {
		if value == id {
			return true
		}
	}
	return false
}

func findingIDs(t *testing.T, input string, mode string) ([]string, string) {
	t.Helper()
	site := newTLSFixture(t, map[string]fixturePage{
		"/": {
			ctype: "text/html; charset=utf-8",
			body: `<!doctype html><html><head><title>T</title>
				<script src="/app.js"></script>
				<script src="https://cdn.example.net/lib.js"></script>
				</head><body>
				<form action="/login"><input type="password" name="password" autocomplete="off"></form>
				<a href="/admin">Admin</a>
				<img src="http://cdn.example.com/logo.png">
				</body></html>`,
			headers: map[string]string{
				"Content-Security-Policy": "default-src *; script-src 'self' 'unsafe-inline' 'unsafe-eval'",
			},
		},
		"/app.js": {ctype: "application/javascript", body: `const key="AKIA1234567890ABCD12"; //# sourceMappingURL=app.js.map`},
	})

	engine := site.engine(t)
	result, err := engine.Scan(context.Background(), site.server.URL, mode)
	if err != nil {
		t.Fatalf("scan failed: %v", err)
	}
	ids := make([]string, 0, len(result.Findings))
	for _, finding := range result.Findings {
		ids = append(ids, finding.ID)
	}
	return ids, result.Mode
}

func TestFastScanFindsRealExposures(t *testing.T) {
	ids, mode := findingIDs(t, "", "fast")
	if mode != "fast" {
		t.Fatalf("mode = %q, want fast", mode)
	}
	for _, want := range []string{"SW-032", "SW-033", "SW-035", "SW-023"} {
		if !hasFinding(ids, want) {
			t.Errorf("missing finding %s; got %v", want, ids)
		}
	}
	if hasFinding(ids, "D-01") {
		t.Error("deep check ran during a fast scan")
	}
}

func TestFastScanContainsNoDeepChecks(t *testing.T) {
	ids, _ := findingIDs(t, "", "fast")
	for _, id := range ids {
		if strings.HasPrefix(id, "D-") {
			t.Fatalf("fast scan returned deep finding %s", id)
		}
	}
}

func TestDeepScanAddsDeepChecks(t *testing.T) {
	ids, mode := findingIDs(t, "", "deep")
	if mode != "deep" {
		t.Fatalf("mode = %q, want deep", mode)
	}
	for _, want := range []string{"SW-032", "D-01"} {
		if !hasFinding(ids, want) {
			t.Errorf("missing deep finding %s; got %v", want, ids)
		}
	}
}

func TestCleanPageHasNoExposureFindings(t *testing.T) {
	site := newTLSFixture(t, map[string]fixturePage{
		"/": {
			ctype: "text/html",
			body:  `<!doctype html><html><head><title>Clean</title></head><body><p>Nothing to see.</p></body></html>`,
			headers: map[string]string{
				"Content-Security-Policy":     "default-src 'self'; object-src 'none'; base-uri 'self'",
				"X-Frame-Options":             "DENY",
				"X-Content-Type-Options":      "nosniff",
				"Referrer-Policy":             "strict-origin-when-cross-origin",
				"Permissions-Policy":          "camera=(), microphone=()",
				"Strict-Transport-Security":   "max-age=31536000",
				"Access-Control-Allow-Origin": "https://example.com",
			},
		},
	})

	result, err := site.engine(t).Scan(context.Background(), site.server.URL, "fast")
	if err != nil {
		t.Fatalf("scan failed: %v", err)
	}
	for _, finding := range result.Findings {
		if finding.Type == "exposure" {
			t.Errorf("clean page reported exposure %s: %s", finding.ID, finding.Title)
		}
	}
}

func TestScanReportsFetchFailureWithoutBodyChecks(t *testing.T) {
	site := newTLSFixture(t, map[string]fixturePage{
		"/": {status: http.StatusInternalServerError, ctype: "text/plain", body: "boom"},
	})
	result, err := site.engine(t).Scan(context.Background(), site.server.URL, "fast")
	if err != nil {
		t.Fatalf("scan failed: %v", err)
	}
	if result.Context.BodyScanned {
		t.Fatal("bodyScanned = true for a 500 response")
	}
	if result.Context.Status != http.StatusInternalServerError {
		t.Fatalf("status = %d, want 500", result.Context.Status)
	}
}

func TestScanRejectsPrivateTargetsByDefault(t *testing.T) {
	engine := New(Options{})
	_, err := engine.Scan(context.Background(), "http://127.0.0.1:8080", "fast")
	if !errors.Is(err, netguard.ErrInvalid) {
		t.Fatalf("err = %v, want ErrInvalid", err)
	}
}

func TestScanScoresAndCounts(t *testing.T) {
	ids, _ := findingIDs(t, "", "fast")
	if len(ids) == 0 {
		t.Fatal("expected findings for the dirty fixture")
	}
	site := newTLSFixture(t, map[string]fixturePage{
		"/": {ctype: "text/html", body: `<!doctype html><html><body><p>ok</p></body></html>`},
	})
	result, err := site.engine(t).Scan(context.Background(), site.server.URL, "fast")
	if err != nil {
		t.Fatalf("scan failed: %v", err)
	}
	if result.ChecksTotal != 34 {
		t.Errorf("checksTotal = %d, want 34", result.ChecksTotal)
	}
	if result.Coverage < 60 || result.Coverage > 100 {
		t.Errorf("coverage = %d, want between 60 and 100", result.Coverage)
	}
	if result.Counts.Exposures+result.Counts.Signals+result.Counts.Hardening != len(result.Findings) {
		t.Errorf("type counts %+v do not add up to %d findings", result.Counts, len(result.Findings))
	}
	if result.Counts.Confirmed+result.Counts.NeedsValidation+result.Counts.Rejected != len(result.Findings) {
		t.Errorf("verdict counts %+v do not add up to %d findings", result.Counts, len(result.Findings))
	}
	if result.ReceiptID == "" || !strings.HasPrefix(result.ReceiptID, "SW-") {
		t.Errorf("receiptId = %q", result.ReceiptID)
	}
	if result.DurationMS < 0 {
		t.Errorf("durationMs = %d", result.DurationMS)
	}
}

func TestFetchClientBlocksPrivateRedirectHops(t *testing.T) {
	client := New(Options{}).fetcher
	_, err := client.FetchPage(context.Background(), mustParse(t, "http://127.0.0.1:1/"))
	if !errors.Is(err, netguard.ErrInvalid) {
		t.Fatalf("err = %v, want ErrInvalid", err)
	}
}

func TestExtractScriptURLsKeepsOnlySameOrigin(t *testing.T) {
	base := mustParse(t, "https://example.com/page")
	html := `<script src="/a.js"></script><script src="https://other.test/b.js"></script>
		<script src="https://example.com/c.js"></script><script src="/a.js"></script><script src="data:text/js,1"></script>`
	urls := fetch.ExtractScriptURLs(html, base)
	if len(urls) != 2 {
		t.Fatalf("got %d URLs, want 2: %v", len(urls), urls)
	}
}

func mustParse(t *testing.T, raw string) *url.URL {
	t.Helper()
	u, err := url.Parse(raw)
	if err != nil {
		t.Fatalf("parse %q: %v", raw, err)
	}
	return u
}
