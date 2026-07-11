"use client";

import { useFormStatus } from "react-dom";
import { assignCreativeToCampaign } from "./actions";

interface AssignFormProps {
  creativeId: string;
  currentCampaignId: string | null | undefined;
  campaigns: { id: string; name: string }[];
}

export function AssignForm({
  creativeId,
  currentCampaignId,
  campaigns,
}: AssignFormProps) {
  return (
    <form action={assignCreativeToCampaign} className="flex gap-2">
      <input type="hidden" name="creativeId" value={creativeId} />
      <select
        name="campaignId"
        defaultValue={currentCampaignId ?? ""}
        className="min-w-0 flex-1 rounded-lg border border-zinc-700 bg-zinc-950 px-2 py-1.5 text-xs text-zinc-200 outline-none focus:border-zinc-500"
      >
        <option value="">Unassigned</option>
        {campaigns.map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>
      <AssignButton />
    </form>
  );
}

function AssignButton() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="shrink-0 rounded-lg border border-zinc-700 px-3 py-1.5 text-xs text-zinc-300 hover:border-zinc-500 hover:text-zinc-100 disabled:opacity-50"
    >
      {pending ? "…" : "Assign"}
    </button>
  );
}
