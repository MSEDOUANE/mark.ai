import { generateText } from "ai";
import { asc, eq, and } from "drizzle-orm";
import { db, schema } from "@/db";
import { strategistModel } from "@/lib/ai/models";

/**
 * AI lead responder: answer an inbound WhatsApp message in the brand's voice,
 * grounded in the org's brand/product catalog. Returns the reply text (the
 * webhook sends + persists it).
 */
export async function draftLeadReply(
  orgId: string,
  contact: string,
): Promise<string> {
  const [brands, products, thread] = await Promise.all([
    db
      .select({
        name: schema.brandProfiles.name,
        tone: schema.brandProfiles.tone,
        description: schema.brandProfiles.description,
      })
      .from(schema.brandProfiles)
      .where(eq(schema.brandProfiles.orgId, orgId))
      .limit(3),
    db
      .select({
        name: schema.products.name,
        description: schema.products.description,
      })
      .from(schema.products)
      .where(eq(schema.products.orgId, orgId))
      .limit(10),
    db
      .select({
        direction: schema.whatsappMessages.direction,
        body: schema.whatsappMessages.body,
      })
      .from(schema.whatsappMessages)
      .where(
        and(
          eq(schema.whatsappMessages.orgId, orgId),
          eq(schema.whatsappMessages.contact, contact),
        ),
      )
      .orderBy(asc(schema.whatsappMessages.createdAt))
      .limit(20),
  ]);

  const brand = brands[0];
  const system =
    `You are the WhatsApp sales assistant for ${brand?.name ?? "this business"}. ` +
    (brand?.tone ? `Write in this brand voice: ${brand.tone}. ` : "") +
    (brand?.description ? `About the brand: ${brand.description}. ` : "") +
    `Products: ${products.map((p) => `${p.name}${p.description ? ` (${p.description.slice(0, 80)})` : ""}`).join("; ") || "(none listed)"}. ` +
    `Rules: reply in the customer's language (French/Arabic/Darija/English — mirror them). ` +
    `Be warm, brief (1-3 sentences), and helpful. Answer questions about products, prices ` +
    `only if you actually know them, availability, and ordering. Never invent prices, ` +
    `discounts, or delivery promises — if unsure, say a human will confirm shortly. ` +
    `Goal: qualify the lead and move toward an order or a human handoff.`;

  const { text } = await generateText({
    model: strategistModel,
    system,
    messages: thread.map((m) => ({
      role: m.direction === "in" ? ("user" as const) : ("assistant" as const),
      content: m.body,
    })),
  });
  return text.trim();
}
