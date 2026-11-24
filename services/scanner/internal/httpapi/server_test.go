package httpapi

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"
	"time"

	"github.com/akshaydubey05/seaworthy/scanner/internal/model"
	"github.com/akshaydubey05/seaworthy/scanner/internal/netguard"
)

func testServer(t *testing.T, scan ScanFunc, maxConcurrent int) *httptest.Server {
	t.Helper()
	api := New("test-token", "1.1.0-test", scan, maxConcurrent)
	server := httptest.NewServer(api.Handler())
	t.Cleanup(server.Close)
	return server
}

func okScan(context.Context, string, string) (*model.Result, error) {
	return &model.Result{URL: "https://example.com", Mode: "fast", Score: 100, ChecksTotal: 34}, nil
}

func postScan(t *testing.T, endpoint, token, body string) *http.Response {
	t.Helper()
	req, err := http.NewRequest(http.MethodPost, endpoint+"/v1/scan", strings.NewReader(body))
	if err != nil {
		t.Fatalf("build request: %v", err)
	}
	req.Header.Set("Content-Type", "application/json")
	if token != "" {
		req.Header.Set("X-Scanner-Token", token)
	}
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	t.Cleanup(func() { _ = resp.Body.Close() })
	return resp
}

func TestHealthIsPublic(t *testing.T) {
	server := testServer(t, okScan, 2)
	resp, err := http.Get(server.URL + "/health")
	if err != nil {
		t.Fatalf("health request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var payload map[string]any
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode health: %v", err)
	}
	if payload["service"] != "seaworthy-scanner" {
		t.Fatalf("service = %v", payload["service"])
	}
}

func TestScanRequiresToken(t *testing.T) {
	server := testServer(t, okScan, 2)
	resp := postScan(t, server.URL, "", `{"url":"https://example.com"}`)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("status = %d, want 401", resp.StatusCode)
	}
	resp = postScan(t, server.URL, "wrong", `{"url":"https://example.com"}`)
	if resp.StatusCode != http.StatusUnauthorized {
		t.Fatalf("wrong token status = %d, want 401", resp.StatusCode)
	}
}

func TestScanAcceptsBearerToken(t *testing.T) {
	server := testServer(t, okScan, 2)
	req, _ := http.NewRequest(http.MethodPost, server.URL+"/v1/scan", strings.NewReader(`{"url":"https://example.com"}`))
	req.Header.Set("Authorization", "Bearer test-token")
	resp, err := http.DefaultClient.Do(req)
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
}

func TestScanRejectsBadInput(t *testing.T) {
	server := testServer(t, okScan, 2)
	cases := []struct {
		name string
		body string
	}{
		{"invalid json", `{`},
		{"missing url", `{"mode":"fast"}`},
		{"blank url", `{"url":"   "}`},
		{"long url", fmt.Sprintf(`{"url":"https://example.com/%s"}`, strings.Repeat("a", 2100))},
	}
	for _, tc := range cases {
		t.Run(tc.name, func(t *testing.T) {
			resp := postScan(t, server.URL, "test-token", tc.body)
			if resp.StatusCode != http.StatusBadRequest {
				t.Fatalf("status = %d, want 400", resp.StatusCode)
			}
		})
	}
}

func TestScanRejectsOversizedBody(t *testing.T) {
	server := testServer(t, okScan, 2)
	resp := postScan(t, server.URL, "test-token", fmt.Sprintf(`{"url":"https://example.com","mode":"%s"}`, strings.Repeat("x", 5000)))
	if resp.StatusCode != http.StatusRequestEntityTooLarge {
		t.Fatalf("status = %d, want 413", resp.StatusCode)
	}
}

func TestScanMapsInvalidTargetTo400(t *testing.T) {
	server := testServer(t, func(context.Context, string, string) (*model.Result, error) {
		return nil, fmt.Errorf("%w: private address", netguard.ErrInvalid)
	}, 2)
	resp := postScan(t, server.URL, "test-token", `{"url":"http://127.0.0.1"}`)
	if resp.StatusCode != http.StatusBadRequest {
		t.Fatalf("status = %d, want 400", resp.StatusCode)
	}
}

func TestScanReturnsContractPayload(t *testing.T) {
	server := testServer(t, func(_ context.Context, input, mode string) (*model.Result, error) {
		if input != "example.com" {
			t.Errorf("input = %q", input)
		}
		if mode != "deep" {
			t.Errorf("mode = %q", mode)
		}
		return &model.Result{URL: "https://example.com", Mode: mode, Score: 87, Findings: []model.Finding{}}, nil
	}, 2)

	resp := postScan(t, server.URL, "test-token", `{"url":"example.com","mode":"deep"}`)
	if resp.StatusCode != http.StatusOK {
		t.Fatalf("status = %d, want 200", resp.StatusCode)
	}
	var payload model.Result
	if err := json.NewDecoder(resp.Body).Decode(&payload); err != nil {
		t.Fatalf("decode result: %v", err)
	}
	if payload.Mode != "deep" || payload.Score != 87 {
		t.Fatalf("payload = %+v", payload)
	}
	if resp.Header.Get("Cache-Control") != "no-store" {
		t.Errorf("cache-control = %q, want no-store", resp.Header.Get("Cache-Control"))
	}
}

func TestScanNormalizesUnknownModeToFast(t *testing.T) {
	server := testServer(t, func(_ context.Context, _ string, mode string) (*model.Result, error) {
		if mode != "fast" {
			t.Errorf("mode = %q, want fast", mode)
		}
		return &model.Result{Mode: mode}, nil
	}, 2)
	postScan(t, server.URL, "test-token", `{"url":"example.com","mode":"turbo"}`)
}

func TestScanRejectsWhenAtCapacity(t *testing.T) {
	release := make(chan struct{})
	entered := make(chan struct{}, 1)
	server := testServer(t, func(context.Context, string, string) (*model.Result, error) {
		entered <- struct{}{}
		<-release
		return &model.Result{}, nil
	}, 1)

	go func() {
		postScan(t, server.URL, "test-token", `{"url":"https://example.com"}`)
	}()

	select {
	case <-entered:
	case <-time.After(3 * time.Second):
		t.Fatal("first scan never started")
	}

	resp := postScan(t, server.URL, "test-token", `{"url":"https://example.com"}`)
	if resp.StatusCode != http.StatusTooManyRequests {
		t.Fatalf("status = %d, want 429", resp.StatusCode)
	}
	close(release)
}

func TestMethodsAreRestricted(t *testing.T) {
	server := testServer(t, okScan, 2)
	resp, err := http.Get(server.URL + "/v1/scan")
	if err != nil {
		t.Fatalf("request failed: %v", err)
	}
	defer resp.Body.Close()
	if resp.StatusCode != http.StatusMethodNotAllowed {
		t.Fatalf("status = %d, want 405", resp.StatusCode)
	}
}
