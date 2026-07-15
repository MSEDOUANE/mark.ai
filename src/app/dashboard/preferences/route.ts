import { cookies } from "next/headers";
import { NextResponse } from "next/server";

const PROJECT_STATUS_VALUES = new Set(["all", "active", "draft", "pending_approval", "paused"]);
const ASSET_KIND_VALUES = new Set(["all", "image", "video"]);
const PROJECT_SORT_VALUES = new Set(["updated", "status", "budget"]);
const ASSET_SORT_VALUES = new Set(["updated", "type"]);
const DENSITY_VALUES = new Set(["comfortable", "compact"]);
const FOCUS_VALUES = new Set(["operations", "creative"]);
const PANEL_ORDER_VALUES = new Set(["performance", "projects", "activity", "workflow"]);

const COOKIE_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export async function GET(request: Request) {
  const url = new URL(request.url);
  const to = url.searchParams.get("to") || "/dashboard";
  const reset = url.searchParams.get("reset") === "1";
  const saved = url.searchParams.get("saved") === "1";

  const projectStatus = url.searchParams.get("projectStatus");
  const assetKind = url.searchParams.get("assetKind");
  const projectSort = url.searchParams.get("projectSort");
  const assetSort = url.searchParams.get("assetSort");
  const density = url.searchParams.get("density");
  const focus = url.searchParams.get("focus");
  const panelOrder = url.searchParams.get("panelOrder");

  const redirectUrl = new URL(to, request.url);
  if (saved) {
    redirectUrl.searchParams.set("prefsSaved", "1");
  }
  const response = NextResponse.redirect(redirectUrl);
  const cookieStore = await cookies();

  if (reset) {
    [
      "dashboard_project_status",
      "dashboard_asset_kind",
      "dashboard_project_sort",
      "dashboard_asset_sort",
      "dashboard_density",
      "dashboard_focus",
      "dashboard_panel_order",
    ].forEach((name) => cookieStore.delete(name));
    return response;
  }

  function isValidPanelOrder(v: string) {
    const ids = v.split(",");
    return ids.length === 4 && new Set(ids).size === 4 && ids.every((id) => PANEL_ORDER_VALUES.has(id));
  }

  function setPref(name: string, value: string | null, isValid: (v: string) => boolean) {
    if (!value || !isValid(value)) return;
    cookieStore.set({
      name,
      value,
      maxAge: COOKIE_MAX_AGE,
      sameSite: "lax",
      secure: process.env.NODE_ENV === "production",
      httpOnly: false,
      path: "/",
    });
  }

  setPref("dashboard_project_status", projectStatus, (v) => PROJECT_STATUS_VALUES.has(v));
  setPref("dashboard_asset_kind", assetKind, (v) => ASSET_KIND_VALUES.has(v));
  setPref("dashboard_project_sort", projectSort, (v) => PROJECT_SORT_VALUES.has(v));
  setPref("dashboard_asset_sort", assetSort, (v) => ASSET_SORT_VALUES.has(v));
  setPref("dashboard_density", density, (v) => DENSITY_VALUES.has(v));
  setPref("dashboard_focus", focus, (v) => FOCUS_VALUES.has(v));
  setPref("dashboard_panel_order", panelOrder, isValidPanelOrder);

  return response;
}