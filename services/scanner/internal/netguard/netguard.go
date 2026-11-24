package netguard

import (
	"context"
	"errors"
	"fmt"
	"net"
	"net/url"
	"strings"
)

// ErrInvalid means the user supplied a URL we refuse to scan. It maps to HTTP 400.
var ErrInvalid = errors.New("invalid scan target")

// LookupFunc resolves a hostname. It is injectable for tests.
type LookupFunc func(ctx context.Context, host string) ([]net.IP, error)

// DefaultLookup uses the system resolver.
func DefaultLookup(ctx context.Context, host string) ([]net.IP, error) {
	return net.DefaultResolver.LookupIP(ctx, "ip", host)
}

// Normalize validates and canonicalizes a user-supplied URL.
//
// allowPrivate and allowAnyPort are test-only escape hatches. Production callers
// must keep both false.
func Normalize(raw string, allowPrivate, allowAnyPort bool) (*url.URL, error) {
	raw = strings.TrimSpace(raw)
	if raw == "" {
		return nil, fmt.Errorf("%w: a URL is required", ErrInvalid)
	}
	lowered := strings.ToLower(raw)
	if strings.Contains(lowered, "://") {
		if !strings.HasPrefix(lowered, "http://") && !strings.HasPrefix(lowered, "https://") {
			return nil, fmt.Errorf("%w: only http and https URLs are supported", ErrInvalid)
		}
	} else {
		raw = "https://" + raw
	}

	u, err := url.Parse(raw)
	if err != nil {
		return nil, fmt.Errorf("%w: that does not look like a valid URL", ErrInvalid)
	}
	if u.Scheme != "http" && u.Scheme != "https" {
		return nil, fmt.Errorf("%w: only http and https URLs are supported", ErrInvalid)
	}
	if u.User != nil {
		return nil, fmt.Errorf("%w: URLs with embedded credentials are not supported", ErrInvalid)
	}
	if !allowAnyPort && u.Port() != "" && u.Port() != "80" && u.Port() != "443" {
		return nil, fmt.Errorf("%w: only ports 80 and 443 are supported", ErrInvalid)
	}

	host := strings.ToLower(strings.Trim(u.Hostname(), "[]"))
	if host == "" {
		return nil, fmt.Errorf("%w: hostname is required", ErrInvalid)
	}
	if strings.HasSuffix(host, ".") {
		host = strings.TrimSuffix(host, ".")
	}
	if isLocalName(host) {
		return nil, fmt.Errorf("%w: local and private network URLs are not allowed", ErrInvalid)
	}
	if ip := net.ParseIP(host); ip != nil && !allowPrivate && IsPrivateIP(ip) {
		return nil, fmt.Errorf("%w: local and private network URLs are not allowed", ErrInvalid)
	}
	return u, nil
}

func isLocalName(host string) bool {
	if host == "localhost" {
		return true
	}
	for _, suffix := range []string{".local", ".localhost", ".internal", ".home.arpa"} {
		if strings.HasSuffix(host, suffix) {
			return true
		}
	}
	return false
}

// AssertPublicHost resolves every A/AAAA record and rejects private or reserved
// addresses. This is the SSRF guard.
func AssertPublicHost(ctx context.Context, u *url.URL, lookup LookupFunc, allowPrivate bool) error {
	if allowPrivate {
		return nil
	}
	host := strings.ToLower(strings.Trim(u.Hostname(), "[]"))
	if ip := net.ParseIP(host); ip != nil {
		if IsPrivateIP(ip) {
			return fmt.Errorf("%w: local and private network URLs are not allowed", ErrInvalid)
		}
		return nil
	}
	if lookup == nil {
		lookup = DefaultLookup
	}
	ips, err := lookup(ctx, host)
	if err != nil {
		return fmt.Errorf("%w: that hostname could not be resolved", ErrInvalid)
	}
	if len(ips) == 0 {
		return fmt.Errorf("%w: that hostname could not be resolved", ErrInvalid)
	}
	for _, ip := range ips {
		if IsPrivateIP(ip) {
			return fmt.Errorf("%w: that hostname resolves to a private or reserved address", ErrInvalid)
		}
	}
	return nil
}

// IsPrivateIP covers loopback, RFC1918, CGNAT, link-local, documentation,
// benchmarking, multicast, unspecified, and IPv6 equivalents.
func IsPrivateIP(ip net.IP) bool {
	if ip == nil {
		return true
	}
	if ip.IsLoopback() || ip.IsPrivate() || ip.IsUnspecified() ||
		ip.IsLinkLocalUnicast() || ip.IsLinkLocalMulticast() || ip.IsMulticast() {
		return true
	}

	if v4 := ip.To4(); v4 != nil {
		a, b, c := int(v4[0]), int(v4[1]), int(v4[2])
		switch {
		case a == 0:
			return true
		case a == 100 && b >= 64 && b <= 127: // 100.64.0.0/10 CGNAT
			return true
		case a == 192 && b == 0 && c == 0: // 192.0.0.0/24
			return true
		case a == 198 && (b == 18 || b == 19): // 198.18.0.0/15
			return true
		case a == 198 && b == 51 && c == 100: // 198.51.100.0/24
			return true
		case a == 203 && b == 0 && c == 113: // 203.0.113.0/24
			return true
		case a >= 240: // reserved
			return true
		}
		return false
	}

	ip16 := ip.To16()
	if ip16 == nil {
		return true
	}
	// Documentation 2001:db8::/32
	if ip16[0] == 0x20 && ip16[1] == 0x01 && ip16[2] == 0x0d && ip16[3] == 0xb8 {
		return true
	}
	// IPv4-mapped 0:0:0:0:0:ffff::/96
	if ip16[0] == 0 && ip16[1] == 0 && ip16[2] == 0 && ip16[3] == 0 &&
		ip16[4] == 0 && ip16[5] == 0 && ip16[6] == 0 && ip16[7] == 0 &&
		ip16[8] == 0 && ip16[9] == 0 && ip16[10] == 0xff && ip16[11] == 0xff {
		return IsPrivateIP(net.IP(ip16[12:16]))
	}
	return false
}
