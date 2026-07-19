import { authenticator } from "otplib";
import QRCode from "qrcode";

authenticator.options = { window: 1 }; // tolerate ±30s clock drift

export function generateSecret() {
  return authenticator.generateSecret();
}
export function keyUri(email: string, secret: string) {
  return authenticator.keyuri(email, "WizAgents", secret);
}
export async function qrDataUrl(uri: string) {
  return QRCode.toDataURL(uri, { margin: 1, width: 200 });
}
export function verifyToken(token: string, secret: string) {
  try { return authenticator.verify({ token: (token || "").replace(/\s/g, ""), secret }); }
  catch { return false; }
}
