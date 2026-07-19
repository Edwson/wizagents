"use client";
import { startRegistration, startAuthentication } from "@simplewebauthn/browser";

export function passkeySupported() {
  return typeof window !== "undefined" && !!(window as any).PublicKeyCredential;
}

/** Enroll a new passkey (biometric) for the signed-in user. */
export async function enrollPasskey(deviceName?: string): Promise<{ ok: boolean; error?: string }> {
  try {
    const optResp = await fetch("/api/webauthn/register/options", { method: "POST" });
    if (!optResp.ok) return { ok: false, error: (await optResp.json()).error || "Could not start enrollment" };
    const options = await optResp.json();
    const attResp = await startRegistration({ optionsJSON: options });
    const v = await fetch("/api/webauthn/register/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ attResp, deviceName }) });
    const d = await v.json();
    return d.ok ? { ok: true } : { ok: false, error: d.error || "Verification failed" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Passkey cancelled" };
  }
}

/** Authenticate with biometric to satisfy a money step-up. Returns ok when the step-up cookie is set. */
export async function stepUpWithPasskey(): Promise<{ ok: boolean; error?: string }> {
  try {
    const optResp = await fetch("/api/webauthn/authenticate/options", { method: "POST" });
    if (!optResp.ok) { const e = await optResp.json(); return { ok: false, error: e.error || "No passkey", }; }
    const options = await optResp.json();
    const authResp = await startAuthentication({ optionsJSON: options });
    const v = await fetch("/api/webauthn/authenticate/verify", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ authResp }) });
    const d = await v.json();
    return d.ok ? { ok: true } : { ok: false, error: d.error || "Verification failed" };
  } catch (e: any) {
    return { ok: false, error: e?.message || "Biometric cancelled" };
  }
}
