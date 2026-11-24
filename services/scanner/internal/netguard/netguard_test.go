package netguard

import (
	"context"
	"errors"
	"net"
	"net/url"
	"testing"
)

func TestNormalizeRejectsUnsafeTargets(t *testing.T) {
	cases := []string{
		"",
		"localhost",
		"http://localhost:3000",
		"http://127.0.0.1",
		"http://10.0.0.5",
		"http://192.168.1.1",
		"http://169.254.169.254/latest/meta-data",
		"http://[::1]/",
		"http://example.com:8080",
		"http://user:pass@example.com",
		"ftp://example.com",
	}
	for _, input := range cases {
		if _, err := Normalize(input, false, false); !errors.Is(err, ErrInvalid) {
			t.Errorf("Normalize(%q) err = %v, want ErrInvalid", input, err)
		}
	}
}

func TestNormalizeAddsSchemeAndKeepsPaths(t *testing.T) {
	u, err := Normalize("example.com/path?q=1", false, false)
	if err != nil {
		t.Fatalf("unexpected error: %v", err)
	}
	if u.Scheme != "https" || u.Host != "example.com" || u.Path != "/path" || u.RawQuery != "q=1" {
		t.Fatalf("unexpected URL: %s", u.String())
	}
}

func TestIsPrivateIP(t *testing.T) {
	private := []string{
		"0.0.0.0", "10.0.0.1", "100.64.0.1", "127.0.0.1", "169.254.1.1",
		"172.16.0.1", "192.168.0.1", "192.0.0.1", "198.18.0.1", "198.51.100.1",
		"203.0.113.1", "224.0.0.1", "255.255.255.255", "::", "::1", "fc00::1",
		"fd12::1", "fe80::1", "ff02::1", "2001:db8::1",
	}
	for _, raw := range private {
		if ip := net.ParseIP(raw); !IsPrivateIP(ip) {
			t.Errorf("IsPrivateIP(%s) = false, want true", raw)
		}
	}
	public := []string{"1.1.1.1", "8.8.8.8", "93.184.216.34", "2606:4700:4700::1111"}
	for _, raw := range public {
		if ip := net.ParseIP(raw); IsPrivateIP(ip) {
			t.Errorf("IsPrivateIP(%s) = true, want false", raw)
		}
	}
}

func TestAssertPublicHost(t *testing.T) {
	u, _ := url.Parse("https://example.com")
	public := func(context.Context, string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("93.184.216.34")}, nil
	}
	if err := AssertPublicHost(context.Background(), u, public, false); err != nil {
		t.Fatalf("public host rejected: %v", err)
	}

	private := func(context.Context, string) ([]net.IP, error) {
		return []net.IP{net.ParseIP("10.1.2.3")}, nil
	}
	if err := AssertPublicHost(context.Background(), u, private, false); !errors.Is(err, ErrInvalid) {
		t.Fatalf("private host err = %v, want ErrInvalid", err)
	}

	failing := func(context.Context, string) ([]net.IP, error) {
		return nil, errors.New("dns down")
	}
	if err := AssertPublicHost(context.Background(), u, failing, false); !errors.Is(err, ErrInvalid) {
		t.Fatalf("dns error err = %v, want ErrInvalid", err)
	}
}
