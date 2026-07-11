import { eq } from "drizzle-orm";
import { inngest } from "../client";
import { db, schema } from "@/db";
import { decryptSecret, encryptSecret } from "@/lib/crypto";
import { resolveMetaToken } from "@/lib/ads/meta-token";

/**
 * Roll Meta long-lived tokens forward (~60 days) before they expire, by
 * re-exchanging the current token. Runs daily. This is the SaaS auto-refresh:
 * as long as a token is still valid and app creds are set, it regenerates with
 * no user action. If the exchange fails (token revoked/expired, or no app
 * creds) the account is flagged "error" so the UI can prompt a reconnect.
 *
 * Tokens with no known expiry (system-user / non-expiring) are skipped.
 */
export const refreshMetaTokens = inngest.createFunction(
  {
    id: "refresh-meta-tokens",
    name: "Refresh Meta tokens",
    triggers: [{ cron: "0 3 * * *" }],
  },
  async () => {
    const accounts = await db
      .select()
      .from(schema.adAccounts)
      .where(eq(schema.adAccounts.platform, "meta"));

    let refreshed = 0;
    let flagged = 0;

    for (const a of accounts) {
      if (!a.encryptedToken) continue;
      const meta = (a.meta ?? {}) as { tokenExpiresAt?: string | null };
      if (!meta.tokenExpiresAt) continue; // non-expiring / unknown — skip

      const daysLeft =
        (new Date(meta.tokenExpiresAt).getTime() - Date.now()) / 86_400_000;
      if (daysLeft > 10) continue; // refresh only when within 10 days of expiry

      try {
        const current = decryptSecret(a.encryptedToken);
        const r = await resolveMetaToken(current);
        if (r.exchanged) {
          await db
            .update(schema.adAccounts)
            .set({
              encryptedToken: encryptSecret(r.token),
              status: "connected",
              meta: {
                ...meta,
                tokenExpiresAt: r.expiresAt,
                tokenExchanged: true,
                lastRefreshedAt: new Date().toISOString(),
              },
            })
            .where(eq(schema.adAccounts.id, a.id));
          refreshed++;
        } else {
          await db
            .update(schema.adAccounts)
            .set({ status: "error" })
            .where(eq(schema.adAccounts.id, a.id));
          flagged++;
        }
      } catch {
        flagged++;
      }
    }

    return { refreshed, flagged };
  },
);
