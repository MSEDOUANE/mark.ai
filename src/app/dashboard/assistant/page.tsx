import { redirect } from "next/navigation";
import { and, asc, eq, gte, sql } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { AssistantChat, type ChatTurn } from "./assistant-chat";

export default async function AssistantPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");
  const { org } = await ensureProfile(user);

  // Last 30 days of assistant conversation, oldest first.
  const rows = await db
    .select({ payload: schema.auditLog.payload, createdAt: schema.auditLog.createdAt })
    .from(schema.auditLog)
    .where(
      and(
        eq(schema.auditLog.orgId, org.id),
        eq(schema.auditLog.action, "assistant_chat"),
        gte(schema.auditLog.createdAt, sql`now() - interval '30 days'`),
      ),
    )
    .orderBy(asc(schema.auditLog.createdAt))
    .limit(60);

  const history: ChatTurn[] = rows
    .map((r) => r.payload as { role?: string; content?: string; toolsUsed?: string[] })
    .filter(
      (p): p is { role: "user" | "assistant"; content: string; toolsUsed?: string[] } =>
        (p.role === "user" || p.role === "assistant") &&
        typeof p.content === "string",
    )
    .map((p) => ({ role: p.role, content: p.content, toolsUsed: p.toolsUsed }));

  return (
    <main className="min-h-screen px-4 py-6 text-app-text sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-3rem)] max-w-3xl flex-col">
        <div className="mb-4">
          <h1 className="text-2xl font-bold">MarkAI Assistant</h1>
          <p className="mt-1 text-sm text-app-text-muted">
            Your marketing manager — ask about performance, launch campaigns,
            refresh creatives, or get recommendations. Spend always waits for
            your approval.
          </p>
        </div>
        <AssistantChat initialHistory={history} />
      </div>
    </main>
  );
}
