package httpapi

import (
	"context"
	"crypto/subtle"
	"encoding/json"
	"errors"
	"io"
	"log/slog"
	"net/http"
	"strings"

	"github.com/akshaydubey05/seaworthy/scanner/internal/model"
	"github.com/akshaydubey05/seaworthy/scanner/internal/netguard"
)

type ScanFunc func(ctx context.Context, input, mode string) (*model.Result, error)

type Server struct {
	Token         string
	Version       string
	Scan          ScanFunc
	MaxBody       int64
	MaxConcurrent int
	Logger        *slog.Logger
	sem           chan struct{}
}

func New(token, version string, scan ScanFunc, maxConcurrent int) *Server {
	if maxConcurrent <= 0 {
		maxConcurrent = 8
	}
	return &Server{
		Token:         token,
		Version:       version,
		Scan:          scan,
		MaxBody:       4096,
		MaxConcurrent: maxConcurrent,
		Logger:        slog.Default(),
		sem:           make(chan struct{}, maxConcurrent),
	}
}

func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()
	mux.HandleFunc("GET /health", s.health)
	mux.HandleFunc("POST /v1/scan", s.auth(s.scan))
	return mux
}

func (s *Server) health(w http.ResponseWriter, _ *http.Request) {
	writeJSON(w, http.StatusOK, map[string]any{
		"ok":      true,
		"service": "seaworthy-scanner",
		"version": s.Version,
	})
}

func (s *Server) auth(next http.HandlerFunc) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		if s.Token == "" {
			http.Error(w, "scanner token is not configured", http.StatusInternalServerError)
			return
		}
		provided := r.Header.Get("X-Scanner-Token")
		if provided == "" {
			auth := r.Header.Get("Authorization")
			if strings.HasPrefix(strings.ToLower(auth), "bearer ") {
				provided = strings.TrimSpace(auth[7:])
			}
		}
		if subtle.ConstantTimeCompare([]byte(provided), []byte(s.Token)) != 1 {
			writeJSON(w, http.StatusUnauthorized, map[string]string{"error": "unauthorized"})
			return
		}
		next(w, r)
	}
}

type scanRequest struct {
	URL  string `json:"url"`
	Mode string `json:"mode"`
}

func (s *Server) scan(w http.ResponseWriter, r *http.Request) {
	select {
	case s.sem <- struct{}{}:
		defer func() { <-s.sem }()
	default:
		writeJSON(w, http.StatusTooManyRequests, map[string]string{"error": "scanner is at capacity"})
		return
	}

	if r.ContentLength > s.MaxBody {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "request body is too large"})
		return
	}
	body, err := io.ReadAll(io.LimitReader(r.Body, s.MaxBody+1))
	if err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "unable to read request body"})
		return
	}
	if int64(len(body)) > s.MaxBody {
		writeJSON(w, http.StatusRequestEntityTooLarge, map[string]string{"error": "request body is too large"})
		return
	}

	var req scanRequest
	if err := json.Unmarshal(body, &req); err != nil {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "invalid JSON body"})
		return
	}
	if strings.TrimSpace(req.URL) == "" {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "a URL is required"})
		return
	}
	if len(req.URL) > 2048 {
		writeJSON(w, http.StatusBadRequest, map[string]string{"error": "URL is too long"})
		return
	}
	if req.Mode != "deep" {
		req.Mode = "fast"
	}

	result, err := s.Scan(r.Context(), req.URL, req.Mode)
	if err != nil {
		switch {
		case errors.Is(err, netguard.ErrInvalid):
			writeJSON(w, http.StatusBadRequest, map[string]string{"error": err.Error()})
		case errors.Is(err, context.DeadlineExceeded):
			writeJSON(w, http.StatusGatewayTimeout, map[string]string{"error": "scan timed out"})
		default:
			s.Logger.Error("scan_failed", "error", err)
			writeJSON(w, http.StatusInternalServerError, map[string]string{"error": "scan failed"})
		}
		return
	}
	writeJSON(w, http.StatusOK, result)
}

func writeJSON(w http.ResponseWriter, status int, value any) {
	w.Header().Set("Content-Type", "application/json; charset=utf-8")
	w.Header().Set("Cache-Control", "no-store")
	w.Header().Set("X-Content-Type-Options", "nosniff")
	w.WriteHeader(status)
	_ = json.NewEncoder(w).Encode(value)
}
