package main

import (
	"context"
	"log/slog"
	"net/http"
	"os"
	"os/signal"
	"strconv"
	"syscall"
	"time"

	"github.com/akshaydubey05/seaworthy/scanner/internal/httpapi"
	"github.com/akshaydubey05/seaworthy/scanner/internal/scan"
)

const version = "1.2.0"

func main() {
	logger := slog.New(slog.NewJSONHandler(os.Stdout, nil))
	slog.SetDefault(logger)

	token := os.Getenv("SCANNER_TOKEN")
	if token == "" {
		logger.Error("SCANNER_TOKEN is required")
		os.Exit(1)
	}

	engine := scan.New(scan.Options{
		AllowPrivate: os.Getenv("SCANNER_ALLOW_PRIVATE") == "true",
		AllowAnyPort: os.Getenv("SCANNER_ALLOW_ANY_PORT") == "true",
	})

	maxConcurrent := envInt("SCANNER_MAX_CONCURRENT", 8)
	api := httpapi.New(token, version, engine.Scan, maxConcurrent)
	api.Logger = logger

	server := &http.Server{
		Addr:              ":" + envString("PORT", "8080"),
		Handler:           api.Handler(),
		ReadHeaderTimeout: 5 * time.Second,
		ReadTimeout:       15 * time.Second,
		WriteTimeout:      150 * time.Second,
		IdleTimeout:       60 * time.Second,
	}

	go func() {
		logger.Info("scanner_started", "addr", server.Addr, "version", version, "maxConcurrent", maxConcurrent)
		if err := server.ListenAndServe(); err != nil && err != http.ErrServerClosed {
			logger.Error("scanner_failed", "error", err)
			os.Exit(1)
		}
	}()

	stop := make(chan os.Signal, 1)
	signal.Notify(stop, syscall.SIGINT, syscall.SIGTERM)
	<-stop

	ctx, cancel := context.WithTimeout(context.Background(), 10*time.Second)
	defer cancel()
	if err := server.Shutdown(ctx); err != nil {
		logger.Error("scanner_shutdown_failed", "error", err)
	}
}

func envString(name, fallback string) string {
	if value := os.Getenv(name); value != "" {
		return value
	}
	return fallback
}

func envInt(name string, fallback int) int {
	value := os.Getenv(name)
	if value == "" {
		return fallback
	}
	n, err := strconv.Atoi(value)
	if err != nil || n <= 0 {
		return fallback
	}
	return n
}
