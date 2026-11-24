package checks

import (
	"testing"

	"github.com/akshaydubey05/seaworthy/scanner/internal/model"
)

func TestScoreWeights(t *testing.T) {
	exposure := []model.Finding{{Type: "exposure", Severity: "critical", Verdict: "confirmed"}}
	score, hardening := Score(exposure)
	if score != 68 || hardening != 100 {
		t.Fatalf("critical exposure score = %d/%d, want 68/100", score, hardening)
	}

	hardeningOnly := []model.Finding{{Type: "hardening", Severity: "low", Verdict: "confirmed"}}
	score, hardening = Score(hardeningOnly)
	if score != 100 || hardening != 97 {
		t.Fatalf("low hardening score = %d/%d, want 100/97", score, hardening)
	}

	signalOnly := []model.Finding{{Type: "signal", Severity: "medium", Verdict: "needs_validation"}}
	score, _ = Score(signalOnly)
	if score != 96 {
		t.Fatalf("medium signal score = %d, want 96", score)
	}

	rejected := []model.Finding{{Type: "exposure", Severity: "critical", Verdict: "rejected"}}
	score, _ = Score(rejected)
	if score != 100 {
		t.Fatalf("rejected finding score = %d, want 100", score)
	}
}

func TestMixedContentOnlyFlagsResourceLoads(t *testing.T) {
	if hasMixedContent(`<div itemtype="http://schema.org/WebPage"></div>`) {
		t.Fatal("schema.org vocabulary URL incorrectly treated as mixed content")
	}
	if !hasMixedContent(`<script src="http://cdn.example.com/app.js"></script>`) {
		t.Fatal("http script source not detected as mixed content")
	}
	if !hasMixedContent(`<link rel="stylesheet" href="http://cdn.example.com/a.css">`) {
		t.Fatal("http stylesheet not detected as mixed content")
	}
	if hasMixedContent(`<script src="http://localhost/app.js"></script>`) {
		t.Fatal("localhost should be ignored")
	}
}

func TestSecretPatterns(t *testing.T) {
	positives := map[string]string{
		"AWS access key ID":      `AKIA1234567890ABCD12`,
		"GitHub token":           `ghp_` + "012345678901234567890123456789012345",
		"Slack token":            `xoxb-1234567890-abcdef`,
		"Stripe live secret key": `sk_live_` + "0123456789abcdef",
		"AI provider key":        `sk-proj-` + "012345678901234567890123",
	}
	for label, value := range positives {
		hit := findSecret(value, bundleSecretPatterns)
		if hit == nil || hit.label != label {
			t.Errorf("findSecret(%q) = %+v, want label %q", value, hit, label)
		}
	}
	if hit := findSecret(`const key = "sk-generic-123";`, bundleSecretPatterns); hit != nil {
		t.Fatalf("generic sk- string matched as %q", hit.label)
	}
}

func TestRedactDoesNotLeakFullSecret(t *testing.T) {
	value := "AKIA1234567890ABCD12"
	redacted := redact(value)
	if len(redacted) >= len(value) {
		t.Fatalf("redacted value %q is not shorter than secret", redacted)
	}
	if redacted == value {
		t.Fatal("redacted value equals secret")
	}
}

func TestParseCSP(t *testing.T) {
	directives := parseCSP("default-src 'self'; script-src 'nonce-abc' 'strict-dynamic'; object-src 'none'")
	if directives["script-src"] != "'nonce-abc' 'strict-dynamic'" {
		t.Fatalf("script-src = %q", directives["script-src"])
	}
	if directives["object-src"] != "'none'" {
		t.Fatalf("object-src = %q", directives["object-src"])
	}
}
