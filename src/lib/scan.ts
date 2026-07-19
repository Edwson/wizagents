// Heuristic malware / asset scanner for creator uploads.
// Pure, dependency-free (Node `crypto` only). Runs a fast, ordered set of
// checks and returns the FIRST problem found — otherwise "clean".
// The heuristic verdict is always the source of truth; an optional external
// AV (e.g. VirusTotal) is only advertised via `externalScanAvailable()` and
// is never called from here (no network I/O in this module).

import { createHash } from "crypto";

// Max accepted upload size (15 MB).
export const MAX_SIZE = 15 * 1024 * 1024;

// Allowlist: mime -> accepted file extensions. An upload must match BOTH a
// known mime AND one of its extensions to pass the type check.
export const ALLOWED: Record<string, string[]> = {
  "application/pdf": [".pdf"],
  "text/plain": [".txt", ".md"],
  "text/markdown": [".md"],
  "text/csv": [".csv"],
  "application/json": [".json"],
  "application/vnd.openxmlformats-officedocument.wordprocessingml.document": [".docx"],
  "image/png": [".png"],
  "image/jpeg": [".jpg", ".jpeg"],
};

export type ScanStatus = "clean" | "suspicious" | "infected";
export type ScanResult = { status: ScanStatus; detail: string; sha256: string };

// The canonical EICAR anti-virus test signature. Any file containing this
// exact string should be treated as (test) malware by every scanner.
const EICAR =
  "X5O!P%@AP[4\\PZX54(P^)7CC)7}$EICAR-STANDARD-ANTIVIRUS-TEST-FILE!$H+H*";

// Executable / script signatures we treat as dangerous content.
const SCRIPT_PATTERNS = [
  "<script",
  "powershell",
  "cmd.exe",
  "/bin/sh",
  "#!/",
  "eval(",
  "base64_decode",
  "document.cookie",
  "<?php",
];

// Lowercased file extension (incl. leading dot) or "" when none.
function extOf(fileName: string): string {
  const i = fileName.lastIndexOf(".");
  return i >= 0 ? fileName.slice(i).toLowerCase() : "";
}

// True when a deeper external scan (VirusTotal) COULD run. This never performs
// the scan — it only reports whether the integration is configured.
export function externalScanAvailable(): boolean {
  return !!process.env.VIRUSTOTAL_API_KEY;
}

export async function scanAsset(
  fileName: string,
  mime: string,
  buf: Buffer,
): Promise<ScanResult> {
  // Always compute the digest up front so every branch can return it.
  const sha256 = createHash("sha256").update(buf).digest("hex");

  // 1) Size guard.
  if (buf.length > MAX_SIZE) {
    return { status: "suspicious", detail: "File too large", sha256 };
  }

  // 2) Type guard: extension must be allowed for its mime, and mime allowed.
  const ext = extOf(fileName);
  const exts = ALLOWED[mime];
  if (!exts || !exts.includes(ext)) {
    return { status: "suspicious", detail: "File type not allowed", sha256 };
  }

  // Decode a bounded prefix for text-signature scanning (~200KB).
  const head = buf.subarray(0, 200 * 1024);
  const latin1 = head.toString("latin1");
  const utf8 = head.toString("utf8");

  // 3) EICAR test signature — standard AV test file.
  if (latin1.includes(EICAR) || utf8.includes(EICAR)) {
    return { status: "infected", detail: "EICAR test signature detected", sha256 };
  }

  // 4) Executable magic bytes.
  const b0 = buf[0];
  const b1 = buf[1];
  const b2 = buf[2];
  const b3 = buf[3];
  const isMZ = b0 === 0x4d && b1 === 0x5a; // Windows PE ("MZ")
  const isELF = b0 === 0x7f && b1 === 0x45 && b2 === 0x4c && b3 === 0x46; // ELF
  const isMachO =
    (b0 === 0xfe && b1 === 0xed && b2 === 0xfa) || // Mach-O
    (b0 === 0xca && b1 === 0xfe && b2 === 0xba && b3 === 0xbe); // Mach-O fat
  // A ZIP (PK\x03\x04) that also references native binaries by name.
  const isZip = b0 === 0x50 && b1 === 0x4b && b2 === 0x03 && b3 === 0x04;
  const zipHasExe =
    isZip && /\.(exe|dll|scr)/i.test(buf.toString("latin1"));
  if (isMZ || isELF || isMachO || zipHasExe) {
    return { status: "infected", detail: "Executable content detected", sha256 };
  }

  // 5) Script / shell content patterns in the decoded prefix.
  const lowerLatin1 = latin1.toLowerCase();
  const lowerUtf8 = utf8.toLowerCase();
  for (const p of SCRIPT_PATTERNS) {
    if (lowerLatin1.includes(p) || lowerUtf8.includes(p)) {
      return {
        status: "suspicious",
        detail: "Potentially malicious script content",
        sha256,
      };
    }
  }

  // Note: when externalScanAvailable() is true a deeper VirusTotal pass could
  // be queued by the caller, but the heuristic verdict below remains
  // authoritative and no network call is made here.
  return { status: "clean", detail: "No threats detected", sha256 };
}
