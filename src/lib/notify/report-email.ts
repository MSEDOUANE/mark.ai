import type { ReportPayload } from "@/lib/ai/reporter";

/**
 * Inline-styled HTML for the weekly report digest — email-client-safe
 * (tables + inline styles, no external assets).
 */

const money = (minor: number, currency: string) =>
  `${(minor / 100).toFixed(2)} ${currency}`;

function esc(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function list(title: string, color: string, items: string[]): string {
  if (!items?.length) return "";
  return `
    <h3 style="margin:20px 0 8px;font-size:13px;letter-spacing:1px;text-transform:uppercase;color:${color}">${title}</h3>
    <ul style="margin:0;padding-left:18px;color:#3f3f46;font-size:14px;line-height:1.7">
      ${items.map((i) => `<li>${esc(i)}</li>`).join("")}
    </ul>`;
}

export function reportEmailHtml(
  payload: ReportPayload,
  periodStart: string,
  periodEnd: string,
  appUrl: string,
): string {
  const t = payload.totals;
  const kpi = (label: string, value: string) => `
    <td style="padding:12px 16px;border:1px solid #e4e4e7;border-radius:8px;text-align:center">
      <div style="font-size:11px;letter-spacing:1px;text-transform:uppercase;color:#71717a">${label}</div>
      <div style="margin-top:4px;font-size:18px;font-weight:700;color:#18181b">${value}</div>
    </td>`;

  return `
  <div style="max-width:640px;margin:0 auto;padding:24px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#a1a1aa">MarkAI · Weekly report</div>
    <h1 style="margin:8px 0 4px;font-size:22px;color:#18181b">Your marketing week</h1>
    <div style="font-size:13px;color:#71717a">${periodStart} → ${periodEnd}</div>

    <p style="margin:20px 0;font-size:15px;line-height:1.7;color:#3f3f46">${esc(payload.summary)}</p>

    ${
      t
        ? `<table role="presentation" cellspacing="8" style="width:100%;border-collapse:separate"><tr>
            ${kpi("Spend", money(t.spendMinor, t.currency))}
            ${kpi("Impressions", t.impressions.toLocaleString("en-US"))}
            ${kpi("Clicks", t.clicks.toLocaleString("en-US"))}
            ${kpi("Conversions", t.conversions.toLocaleString("en-US"))}
          </tr></table>`
        : ""
    }

    ${list("Highlights", "#059669", payload.highlights)}
    ${list("Needs attention", "#d97706", payload.concerns)}
    ${list("Next week", "#0284c7", payload.recommendations)}

    <a href="${appUrl}/dashboard"
       style="display:inline-block;margin-top:24px;padding:12px 24px;background:#f59e0b;color:#18181b;font-weight:700;font-size:14px;text-decoration:none;border-radius:10px">
      Open MarkAI →
    </a>
    <p style="margin-top:24px;font-size:12px;color:#a1a1aa">
      Sent by your MarkAI marketing manager. Spend changes always wait for your approval in the app.
    </p>
  </div>`;
}

export function alertEmailHtml(message: string, campaignUrl: string): string {
  return `
  <div style="max-width:640px;margin:0 auto;padding:24px;font-family:-apple-system,'Segoe UI',Roboto,Helvetica,Arial,sans-serif">
    <div style="font-size:12px;letter-spacing:2px;text-transform:uppercase;color:#dc2626">MarkAI · Critical alert</div>
    <p style="margin:16px 0;font-size:15px;line-height:1.7;color:#3f3f46">${esc(message)}</p>
    <a href="${campaignUrl}"
       style="display:inline-block;margin-top:8px;padding:12px 24px;background:#dc2626;color:#fff;font-weight:700;font-size:14px;text-decoration:none;border-radius:10px">
      Open the campaign →
    </a>
  </div>`;
}
