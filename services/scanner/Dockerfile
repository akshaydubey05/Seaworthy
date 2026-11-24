# Standalone Go scanner service.
# Build:  docker build -t seaworthy-scanner ./services/scanner
# Run:    docker run -p 8080:8080 -e SCANNER_TOKEN=change-me seaworthy-scanner
FROM golang:1.24-alpine AS build

WORKDIR /src
COPY go.mod ./
RUN go mod download
COPY . .
RUN CGO_ENABLED=0 GOOS=linux go build -trimpath -ldflags="-s -w" -o /out/scanner ./cmd/scanner

FROM gcr.io/distroless/static-debian12:nonroot

COPY --from=build /out/scanner /scanner
USER nonroot:nonroot
EXPOSE 8080
ENV PORT=8080
ENTRYPOINT ["/scanner"]
