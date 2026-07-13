"use server";

import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { createClient } from "@/lib/supabase/server";
import { ensureProfile } from "@/lib/auth/ensure-profile";
import { db, schema } from "@/db";
import { executeAllocation } from "@/lib/manager/execute";
import type { AllocationProposal } from "@/lib/ai/allocator";

async function decideAllocation(
  formData: FormData,
  decision: "approved" | "rejected",
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;
  const { org } = await ensureProfile(user);

  const id = String(formData.get("approvalId") ?? "").trim();
  if (!id) return;

  const [approval] = await db
    .select()
    .from(schema.approvals)
    .where(
      and(
        eq(schema.approvals.id, id),
        eq(schema.approvals.orgId, org.id),
        eq(schema.approvals.entityType, "budget_allocation"),
        eq(schema.approvals.status, "pending"),
      ),
    )
    .limit(1);
  if (!approval) return;

  await db
    .update(schema.approvals)
    .set({ status: decision, approvedBy: user.id, decidedAt: new Date() })
    .where(eq(schema.approvals.id, approval.id));

  if (decision === "approved") {
    const proposal = (approval.payload as { proposal: AllocationProposal })
      .proposal;
    await executeAllocation(org.id, proposal, "user");
  }

  revalidatePath("/dashboard");
  revalidatePath("/dashboard/approvals");
  revalidatePath("/dashboard/campaigns");
}

export async function approveAllocation(formData: FormData) {
  await decideAllocation(formData, "approved");
}

export async function rejectAllocation(formData: FormData) {
  await decideAllocation(formData, "rejected");
}
