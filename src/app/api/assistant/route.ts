import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { runAssistant } from "@/lib/ai/assistant";
import type { ModelMessage } from "ai";

export const maxDuration = 120;

interface ChatTurn {
  role: "user" | "assistant";
  content: string;
}

/** Global marketing assistant chat turn: run tools, reply, persist the turn. */
export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { org } = await ensureProfile(user);

  let body: { messages?: ChatTurn[] };
  try {
    body = (await request.json()) as { messages?: ChatTurn[] };
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const turns = (body.messages ?? [])
    .filter(
      (m): m is ChatTurn =>
        (m.role === "user" || m.role === "assistant") &&
        typeof m.content === "string" &&
        m.content.trim().length > 0,
    )
    .slice(-20); // keep the context window sane

  const lastUser = [...turns].reverse().find((t) => t.role === "user");
  if (!lastUser) {
    return NextResponse.json({ error: "No user message" }, { status: 400 });
  }

  try {
    const reply = await runAssistant(
      org.id,
      user.id,
      turns as ModelMessage[],
    );

    // Persist the exchange so the thread survives reloads.
    await db.insert(schema.auditLog).values([
      {
        orgId: org.id,
        actor: "user" as const,
        action: "assistant_chat",
        payload: { role: "user", content: lastUser.content },
      },
      {
        orgId: org.id,
        actor: "ai" as const,
        action: "assistant_chat",
        payload: {
          role: "assistant",
          content: reply.text,
          toolsUsed: reply.toolsUsed,
        },
      },
    ]);

    return NextResponse.json(reply);
  } catch (err) {
    console.error("[assistant] turn failed:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message.slice(0, 300) : "Assistant failed" },
      { status: 500 },
    );
  }
}
