package fetch

import (
	"bytes"
	"context"
	"errors"
	"fmt"
	"io"
	"net/http"
	"net/url"
	"regexp"
	"strings"
	"sync"
	"time"

	"github.com/akshaydubey05/seaworthy/scanner/internal/model"
	"github.com/akshaydubey05/seaworthy/scanner/internal/netguard"
)

const (
	DefaultMaxBytes      = 300_000
	DefaultMaxRedirects  = 5
	DefaultScriptTimeout = 4 * time.Second
)

type Page struct {
	FinalURL    *url.URL
	Headers     http.Header
	Body        string
	Status      int
	ContentType string
	Truncated   bool
}

type Client struct {
	HTTP         *http.Client
	UserAgent    string
	Lookup       netguard.LookupFunc
	AllowPrivate bool
	AllowAnyPort bool
	MaxBytes     int
	MaxRedirects int
}

func New(ua string) *Client {
	return &Client{
		HTTP: &http.Client{
			Timeout: 12 * time.Second,
			CheckRedirect: func(*http.Request, []*http.Request) error {
				return http.ErrUseLastResponse
			},
		},
		UserAgent:    ua,
		MaxBytes:     DefaultMaxBytes,
		MaxRedirects: DefaultMaxRedirects,
	}
}

func (c *Client) validateHop(u *url.URL) error {
	if u.Scheme != "http" && u.Scheme != "https" {
		return fmt.Errorf("%w: redirected to an unsupported protocol", netguard.ErrInvalid)
	}
	if !c.AllowAnyPort && u.Port() != "" && u.Port() != "80" && u.Port() != "443" {
		return fmt.Errorf("%w: redirected to an unsupported port", netguard.ErrInvalid)
	}
	if c.AllowPrivate {
		return nil
	}
	return netguard.AssertPublicHost(context.Background(), u, c.Lookup, false)
}

// FetchPage retrieves one HTML page with manual redirect validation.
func (c *Client) FetchPage(ctx context.Context, start *url.URL) (*Page, error) {
	current := start
	ua := c.UserAgent
	if ua == "" {
		ua = "SeaworthyScanner/1.1"
	}

	for hop := 0; hop <= c.MaxRedirects; hop++ {
		if err := c.validateHop(current); err != nil {
			return nil, err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, current.String(), nil)
		if err != nil {
			return nil, err
		}
		req.Header.Set("User-Agent", ua)
		req.Header.Set("Accept", "text/html,application/xhtml+xml")
		req.Header.Set("Accept-Language", "en")

		resp, err := c.HTTP.Do(req)
		if err != nil {
			return nil, err
		}

		if resp.StatusCode >= 300 && resp.StatusCode < 400 {
			location := resp.Header.Get("Location")
			if location == "" {
				page, readErr := c.pageFromResponse(resp, current)
				return page, readErr
			}
			_ = resp.Body.Close()
			if hop == c.MaxRedirects {
				return nil, fmt.Errorf("%w: too many redirects", netguard.ErrInvalid)
			}
			next, err := current.Parse(location)
			if err != nil {
				return nil, fmt.Errorf("%w: the target returned an invalid redirect", netguard.ErrInvalid)
			}
			if err := c.validateHop(next); err != nil {
				return nil, err
			}
			current = next
			continue
		}

		return c.pageFromResponse(resp, current)
	}
	return nil, fmt.Errorf("%w: too many redirects", netguard.ErrInvalid)
}

func (c *Client) pageFromResponse(resp *http.Response, u *url.URL) (*Page, error) {
	defer resp.Body.Close()
	body, truncated, err := readCapped(resp.Body, c.MaxBytes)
	if err != nil {
		return nil, err
	}
	return &Page{
		FinalURL:    u,
		Headers:     resp.Header,
		Body:        body,
		Status:      resp.StatusCode,
		ContentType: resp.Header.Get("Content-Type"),
		Truncated:   truncated,
	}, nil
}

// FetchText retrieves a small text resource (security.txt, robots.txt).
func (c *Client) FetchText(ctx context.Context, u *url.URL) (string, error) {
	if err := c.validateHop(u); err != nil {
		return "", err
	}
	req, err := http.NewRequestWithContext(ctx, http.MethodGet, u.String(), nil)
	if err != nil {
		return "", err
	}
	if c.UserAgent != "" {
		req.Header.Set("User-Agent", c.UserAgent)
	}
	req.Header.Set("Accept", "text/plain,*/*")
	resp, err := c.HTTP.Do(req)
	if err != nil {
		return "", err
	}
	defer resp.Body.Close()
	if resp.StatusCode < 200 || resp.StatusCode >= 300 {
		return "", nil
	}
	body, _, err := readCapped(resp.Body, 40_000)
	return body, err
}

var scriptSrcRe = regexp.MustCompile(`(?i)<script\b[^>]*\bsrc\s*=\s*["']([^"']+)["'][^>]*>`)

func ExtractScriptURLs(html string, base *url.URL) []*url.URL {
	seen := map[string]struct{}{}
	var out []*url.URL
	for _, m := range scriptSrcRe.FindAllStringSubmatch(html, -1) {
		raw := strings.TrimSpace(m[1])
		if raw == "" || strings.HasPrefix(strings.ToLower(raw), "data:") {
			continue
		}
		u, err := base.Parse(raw)
		if err != nil || (u.Scheme != "http" && u.Scheme != "https") {
			continue
		}
		if u.Scheme != base.Scheme || u.Host != base.Host {
			continue
		}
		key := u.String()
		if _, ok := seen[key]; ok {
			continue
		}
		seen[key] = struct{}{}
		out = append(out, u)
	}
	return out
}

// FetchScripts fetches up to limit same-origin bundles concurrently.
func (c *Client) FetchScripts(ctx context.Context, html string, base *url.URL, limit, perAssetBytes int) []model.Script {
	urls := ExtractScriptURLs(html, base)
	if limit > 0 && len(urls) > limit {
		urls = urls[:limit]
	}
	results := make([]*model.Script, len(urls))
	var wg sync.WaitGroup
	for i, u := range urls {
		wg.Add(1)
		go func(i int, u *url.URL) {
			defer wg.Done()
			scriptCtx, cancel := context.WithTimeout(ctx, DefaultScriptTimeout)
			defer cancel()
			script, err := c.fetchAsset(scriptCtx, u, perAssetBytes)
			if err == nil {
				results[i] = script
			}
		}(i, u)
	}
	wg.Wait()

	out := make([]model.Script, 0, len(results))
	for _, script := range results {
		if script != nil {
			out = append(out, *script)
		}
	}
	return out
}

func (c *Client) fetchAsset(ctx context.Context, start *url.URL, maxBytes int) (*model.Script, error) {
	if maxBytes <= 0 {
		maxBytes = 150_000
	}
	current := start
	for hop := 0; hop <= c.MaxRedirects; hop++ {
		if err := c.validateHop(current); err != nil {
			return nil, err
		}
		req, err := http.NewRequestWithContext(ctx, http.MethodGet, current.String(), nil)
		if err != nil {
			return nil, err
		}
		if c.UserAgent != "" {
			req.Header.Set("User-Agent", c.UserAgent)
		}
		req.Header.Set("Accept", "application/javascript,text/javascript,*/*")

		resp, err := c.HTTP.Do(req)
		if err != nil {
			return nil, err
		}
		if resp.StatusCode >= 300 && resp.StatusCode < 400 {
			location := resp.Header.Get("Location")
			_ = resp.Body.Close()
			if location == "" {
				return nil, errors.New("redirect without location")
			}
			next, err := current.Parse(location)
			if err != nil {
				return nil, err
			}
			if err := c.validateHop(next); err != nil {
				return nil, err
			}
			current = next
			continue
		}
		defer resp.Body.Close()
		if resp.StatusCode < 200 || resp.StatusCode >= 300 {
			return nil, fmt.Errorf("asset status %d", resp.StatusCode)
		}
		body, truncated, err := readCapped(resp.Body, maxBytes)
		if err != nil {
			return nil, err
		}
		return &model.Script{URL: current.String(), Content: body, Bytes: len(body), Truncated: truncated}, nil
	}
	return nil, errors.New("too many redirects")
}

func readCapped(r io.Reader, max int) (string, bool, error) {
	var buf bytes.Buffer
	n, err := io.CopyN(&buf, r, int64(max+1))
	if err != nil && !errors.Is(err, io.EOF) {
		return "", false, err
	}
	truncated := n > int64(max)
	if truncated {
		buf.Truncate(max)
	}
	return buf.String(), truncated, nil
}
