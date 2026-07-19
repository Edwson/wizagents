"use client";

// Self-contained: renders its own <html>/<body> because it replaces the root
// layout when a top-level/render error occurs. No app imports or providers —
// they may be the thing that failed. Colors are inline so it works standalone.
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
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "#111214",
          color: "#e7e7ea",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          padding: "24px",
        }}
      >
        <div
          style={{
            width: "100%",
            maxWidth: "440px",
            border: "1px solid #2a2b2f",
            borderRadius: "14px",
            background: "#17181b",
            padding: "32px",
            textAlign: "center",
          }}
        >
          <div style={{ fontSize: "18px", fontWeight: 700 }}>The application hit an unexpected error.</div>
          <div style={{ marginTop: "6px", fontSize: "12.5px", color: "#9a9aa2" }}>
            予期しないエラーが発生しました · 應用發生了未預期的錯誤
          </div>
          <p style={{ marginTop: "14px", fontSize: "13px", lineHeight: 1.6, color: "#9a9aa2" }}>
            Reloading usually clears it. If the problem continues, please try again later.
          </p>
          {error?.digest && (
            <p style={{ marginTop: "12px", fontSize: "11px", color: "#6f6f77", fontFamily: "ui-monospace, monospace" }}>
              ref: {error.digest}
            </p>
          )}
          <div style={{ marginTop: "24px", display: "flex", gap: "10px", justifyContent: "center" }}>
            <button
              onClick={() => reset()}
              style={{
                border: "1px solid #4f52c8",
                background: "#4f52c8",
                color: "#fff",
                borderRadius: "9px",
                padding: "9px 18px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Try again
            </button>
            <button
              onClick={() => location.reload()}
              style={{
                border: "1px solid #2a2b2f",
                background: "transparent",
                color: "#e7e7ea",
                borderRadius: "9px",
                padding: "9px 18px",
                fontSize: "13px",
                cursor: "pointer",
              }}
            >
              Reload
            </button>
          </div>
        </div>
      </body>
    </html>
  );
}
