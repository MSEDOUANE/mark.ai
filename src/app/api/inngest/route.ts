import { serve } from "inngest/next";
import { inngest } from "@/inngest/client";
import { generateCreative } from "@/inngest/functions/generate-creative";
import { generateCampaignPlan } from "@/inngest/functions/generate-campaign";
import {
  scheduledMetricsSync,
  syncCampaignMetrics,
} from "@/inngest/functions/sync-metrics";
import { managerMonitorCampaign } from "@/inngest/functions/manager-monitor";
import { refreshMetaTokens } from "@/inngest/functions/refresh-tokens";
import { generateWeeklyReports } from "@/inngest/functions/weekly-report";
import { proposeWeeklyAllocation } from "@/inngest/functions/budget-allocation";
import { generateVideoProject } from "@/inngest/functions/generate-video";

export const { GET, POST, PUT } = serve({
  client: inngest,
  functions: [
    generateCreative,
    generateCampaignPlan,
    syncCampaignMetrics,
    scheduledMetricsSync,
    managerMonitorCampaign,
    refreshMetaTokens,
    generateWeeklyReports,
    proposeWeeklyAllocation,
    generateVideoProject,
  ],
});
