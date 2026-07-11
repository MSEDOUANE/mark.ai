import { NextResponse } from "next/server";
import { eq } from "drizzle-orm";
import { db, schema } from "@/db";
import { sendWhatsAppText } from "@/lib/whatsapp/client";
import { draftLeadReply } from "@/lib/whatsapp/responder";

export const maxDuration = 60;

/** Webhook verification handshake (Meta calls this once at setup). */
export async function GET(request: Request) {
  const url = new URL(request.url);
  const mode = url.searchParams.get("hub.mode");
  const token = url.searchParams.get("hub.verify_token");
  const challenge = url.searchParams.get("hub.challenge");
  if (
    mode === "subscribe" &&
    token &&
    token === process.env.WHATSAPP_VERIFY_TOKEN
  ) {
    return new Response(challenge ?? "", { status: 200 });
  }
  return new Response("Forbidden", { status: 403 });
}

interface WaMessage {
  id?: string;
  from?: string;
  type?: string;
  text?: { body?: string };
}

/**
 * Inbound WhatsApp messages (click-to-WhatsApp leads land here). Stores the
 * message and — when WHATSAPP_AUTO_REPLY=1 — answers in the brand voice.
 * Single-tenant: routed to the first org (per-number routing is a SaaS-phase
 * change alongside RLS).
 */
export async function POST(request: Request) {
  let payload: unknown;
  try {
    payload = await request.json();
  } catch {
    return NextResponse.json({ ok: false }, { status: 400 });
  }

  // Meta retries on non-200 — always ack, do best-effort processing.
  try {
    const entries =
      (payload as { entry?: Array<{ changes?: Array<{ value?: Record<string, unknown> }> }> })
        .entry ?? [];
    const [org] = await db
      .select({ id: schema.organizations.id })
      .from(schema.organizations)
      .limit(1);
    if (!org) return NextResponse.json({ ok: true });

    for (const entry of entries) {
      for (const change of entry.changes ?? []) {
        const value = change.value ?? {};
        const messages = (value.messages ?? []) as WaMessage[];
        const contacts = (value.contacts ?? []) as Array<{
          wa_id?: string;
          profile?: { name?: string };
        }>;

        for (const msg of messages) {
          if (msg.type !== "text" || !msg.from || !msg.text?.body) continue;

          // Idempotency: skip messages we've already stored (Meta redelivers).
          if (msg.id) {
            const [dupe] = await db
              .select({ id: schema.whatsappMessages.id })
              .from(schema.whatsappMessages)
              .where(eq(schema.whatsappMessages.externalId, msg.id))
              .limit(1);
            if (dupe) continue;
          }

          const name =
            contacts.find((c) => c.wa_id === msg.from)?.profile?.name ?? null;

          await db.insert(schema.whatsappMessages).values({
            orgId: org.id,
            contact: msg.from,
            contactName: name,
            direction: "in",
            body: msg.text.body,
            externalId: msg.id ?? null,
          });

          if (process.env.WHATSAPP_AUTO_REPLY === "1") {
            const reply = await draftLeadReply(org.id, msg.from);
            if (reply) {
              const sent = await sendWhatsAppText(msg.from, reply);
              if (sent) {
                await db.insert(schema.whatsappMessages).values({
                  orgId: org.id,
                  contact: msg.from,
                  contactName: name,
                  direction: "out",
                  body: reply,
                });
              }
            }
          }
        }
      }
    }
  } catch (err) {
    console.error("[whatsapp-webhook] processing failed:", err);
  }

  return NextResponse.json({ ok: true });
}
