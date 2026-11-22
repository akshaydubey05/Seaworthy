"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "grid",
          placeItems: "center",
          background: "#0f1411",
          color: "#f2f5f1",
          fontFamily: "system-ui, sans-serif",
          padding: "24px",
        }}
      >
        <main style={{ maxWidth: "560px" }}>
          <p style={{ color: "#96b397", fontSize: "12px", letterSpacing: "0.08em", textTransform: "uppercase" }}>
            Seaworthy
          </p>
          <h1 style={{ fontSize: "2rem", fontWeight: 500, letterSpacing: "-0.03em", margin: "12px 0" }}>
            The app could not render.
          </h1>
          <p style={{ color: "#a3aca5", lineHeight: 1.7 }}>
            Reload the page. If the problem continues, contact support with the reference below.
          </p>
          {error.digest && (
            <p style={{ color: "#a3aca5", fontFamily: "monospace", fontSize: "12px" }}>Reference: {error.digest}</p>
          )}
          <button
            type="button"
            onClick={reset}
            style={{
              marginTop: "20px",
              minHeight: "44px",
              padding: "0 18px",
              borderRadius: "12px",
              border: 0,
              background: "#96b397",
              color: "#131813",
              fontWeight: 500,
              cursor: "pointer",
            }}
          >
            Reload
          </button>
        </main>
      </body>
    </html>
  );
}
