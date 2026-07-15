/**
 * Organic (unpaid) publishing to a connected Meta Page — distinct from the
 * paid-ads launch path in meta.ts. Posts a photo directly to the Page's feed
 * via the Graph API's /{page-id}/photos edge. No budget, no approval gate:
 * this is just a wall post, same as clicking "Post" in Meta Business Suite.
 */

const GRAPH_VERSION = process.env.META_API_VERSION ?? "v21.0";
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export interface OrganicPostResult {
  postId: string;
  permalink: string | null;
}

export async function publishPhotoToPage(args: {
  pageId: string;
  pageAccessToken: string;
  imageUrl: string;
  caption: string;
}): Promise<OrganicPostResult> {
  const res = await fetch(`${GRAPH_BASE}/${args.pageId}/photos`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      url: args.imageUrl,
      caption: args.caption,
      access_token: args.pageAccessToken,
    }),
  });
  const json = (await res.json()) as {
    id?: string;
    post_id?: string;
    error?: { message?: string; code?: number };
  };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Graph API error ${res.status}`);
  }
  const postId = json.post_id ?? json.id;
  if (!postId) throw new Error("No post id in response");

  return { postId, permalink: `https://www.facebook.com/${postId}` };
}

/**
 * A Page access token is required (not the user token) for posting as the
 * Page. Exchanges the connected user token for the Page's own token via the
 * standard /me/accounts lookup, scoped to one page id.
 */
export async function getPageAccessToken(userAccessToken: string, pageId: string): Promise<string> {
  const res = await fetch(
    `${GRAPH_BASE}/${pageId}?fields=access_token&access_token=${encodeURIComponent(userAccessToken)}`,
  );
  const json = (await res.json()) as { access_token?: string; error?: { message?: string } };
  if (!res.ok || json.error) {
    throw new Error(json.error?.message ?? `Could not get Page access token (${res.status})`);
  }
  if (!json.access_token) throw new Error("Page access token missing from response");
  return json.access_token;
}
