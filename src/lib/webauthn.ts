// Real passkey / biometric (WebAuthn) via @simplewebauthn. Platform authenticators
// = Windows Hello / Touch ID / Android biometric. rpID must match the host.
import {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
} from "@simplewebauthn/server";

export const RP_NAME = "WizAgents";
// In production set WEBAUTHN_RP_ID=wiz-agents.com and WEBAUTHN_ORIGIN=https://wiz-agents.com
export function rpID() { return process.env.WEBAUTHN_RP_ID || "localhost"; }
export function origin() { return process.env.WEBAUTHN_ORIGIN || "http://localhost:3000"; }

export {
  generateRegistrationOptions, verifyRegistrationResponse,
  generateAuthenticationOptions, verifyAuthenticationResponse,
};
