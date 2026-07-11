/**
 * WhatsApp Business Cloud API client — env-gated like email:
 *   WHATSAPP_TOKEN            — system-user token with whatsapp_business_messaging
 *   WHATSAPP_PHONE_NUMBER_ID  — the business number's id (not the number itself)
 *   WHATSAPP_VERIFY_TOKEN     — any secret string; echoed at webhook setup
 *   WHATSAPP_AUTO_REPLY=1     — let the AI responder answer inbound leads
 */

const GRAPH_VERSION = process.env.META_API_VERSION ?? "v21.0";

export function whatsappEnabled(): boolean {
  return Boolean(
    process.env.WHATSAPP_TOKEN && process.env.WHATSAPP_PHONE_NUMBER_ID,
  );
}

export async function sendWhatsAppText(
  toE164NoPlus: string,
  body: string,
): Promise<boolean> {
  if (!whatsappEnabled()) {
    console.log(`[whatsapp] skipped (not configured): → ${toE164NoPlus}`);
    return false;
  }
  try {
    const res = await fetch(
      `https://graph.facebook.com/${GRAPH_VERSION}/${process.env.WHATSAPP_PHONE_NUMBER_ID}/messages`,
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${process.env.WHATSAPP_TOKEN}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          messaging_product: "whatsapp",
          to: toE164NoPlus,
          type: "text",
          text: { body: body.slice(0, 4000) },
        }),
      },
    );
    if (!res.ok) {
      const detail = await res.text().catch(() => "");
      console.error(`[whatsapp] send failed (${res.status}): ${detail.slice(0, 300)}`);
      return false;
    }
    return true;
  } catch (err) {
    console.error("[whatsapp] send threw:", err instanceof Error ? err.message : err);
    return false;
  }
}
