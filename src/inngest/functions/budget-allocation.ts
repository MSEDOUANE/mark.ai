import { inngest } from "../client";
import { db, schema } from "@/db";
import { proposeBudgetAllocation } from "@/lib/ai/allocator";

/**
 * Weekly media-buyer pass (or on demand via `allocation/propose.requested`):
 * propose redistributing each org's total daily budget toward its winners.
 * The proposal lands as a pending org-level approval on the Overview — it
 * never auto-applies, since some campaigns' budgets increase.
 */
export const proposeWeeklyAllocation = inngest.createFunction(
  {
    id: "propose-weekly-allocation",
    name: "Weekly budget allocation",
    retries: 1,
    triggers: [{ cron: "30 8 * * 1" }, { event: "allocation/propose.requested" }],
  },
  async ({ event, step }) => {
    const eventData = (event?.data ?? {}) as Record<string, unknown>;
    const onlyOrgId =
      typeof eventData.orgId === "string" ? eventData.orgId : null;

    const orgs = onlyOrgId
      ? [{ id: onlyOrgId }]
      : await db.select({ id: schema.organizations.id }).from(schema.organizations);

    let proposed = 0;
    for (const org of orgs) {
      const proposal = await step.run(`allocate-${org.id}`, () =>
        proposeBudgetAllocation(org.id, null),
      );
      if (proposal) proposed++;
    }
    return { proposed };
  },
);
