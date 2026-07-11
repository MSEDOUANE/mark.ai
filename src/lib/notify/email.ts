/**
 * Outbound email via Resend's REST API (no SDK dependency). Config-gated:
 * without RESEND_API_KEY every send is a logged no-op, so email delivery is
 * strictly additive — nothing else depends on it succeeding.
 *
 * Env:
 *   RESEND_API_KEY     — from resend.com (free tier is plenty for digests)
 *   EMAIL_FROM         — verified sender, e.g. "MarkAI <reports@yourdomain.com>"
 *                        (falls back to Resend's onboarding sender for testing)
 *   REPORT_EMAIL_TO    — optional override recipient; defaults to the org
 *                        owner's login email.
 */

export interface EmailInput {
  to: string;
  subject: string;
  html: string;
}

export function emailEnabled(): boolean {
  return Boolean(process.env.RESEND_API_KEY);
}

export async function sendEmail(input: EmailInput): Promise<boolean> {
  const key = process.env.RESEND_API_KEY;
  if (!key) {
    console.log(`[email] skipped (no RESEND_API_KEY): "${input.subject}" → ${input.to}`);
    return false;
  }
  const from = process.env.EMAIL_FROM ?? "MarkAI <onboarding@resend.dev>";

  try {
    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${key}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: [input.to],
        subject: input.subject,
        html: input.html,
      }),
    });
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[email] send failed (${res.status}): ${detail.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[email] send threw:", err instanceof Error ? err.message : err);
    return false;
  }
}
