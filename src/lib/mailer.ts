/**
 * Outbound email. Configure SMTP_URL (e.g. smtps://user:pass@smtp.host:465) and
 * MAIL_FROM to send for real. If it isn't configured, we do NOT pretend: the message
 * is written to the server log so the operator can act, and the caller is told that
 * delivery is not configured.
 */
export function mailerConfigured() {
  return !!(process.env.SMTP_URL && process.env.MAIL_FROM);
}

export async function sendMail(to: string, subject: string, text: string): Promise<{ sent: boolean; reason?: string }> {
  if (!mailerConfigured()) {
    console.warn(`[mail:NOT-CONFIGURED] to=${to} subject="${subject}"\n${text}`);
    return { sent: false, reason: "not_configured" };
  }
  try {
    // nodemailer is optional — only required when SMTP is actually configured.
    const nodemailer = await import("nodemailer");
    const transport = nodemailer.createTransport(process.env.SMTP_URL!);
    await transport.sendMail({ from: process.env.MAIL_FROM!, to, subject, text });
    return { sent: true };
  } catch (e: any) {
    console.error("[mail:FAILED]", e?.message);
    return { sent: false, reason: "send_failed" };
  }
}
