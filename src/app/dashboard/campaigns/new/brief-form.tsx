"use client";

import { useState } from "react";
import Link from "next/link";
import { createCampaignFromBrief } from "../actions";
import { SubmitButton } from "./submit-button";
import { LanguagePicker } from "@/components/language-picker";

const field =
  "w-full rounded-xl border border-app-border-strong bg-app-bg px-4 py-3 text-sm text-app-text outline-none transition-colors placeholder:text-app-text-subtle focus:border-zinc-500";

function safeHex(c: string | null | undefined) {
  return c && /^#[0-9a-f]{6}$/i.test(c) ? c : "#7c3aed";
}

export interface BriefBrand {
  id: string;
  name: string;
  primaryColor: string | null;
  logoUrl: string | null;
  websiteUrl: string | null;
  tone: string | null;
}

export interface BriefProduct {
  id: string;
  name: string;
  description: string | null;
  targetAudience: string | null;
  brandProfileId: string | null;
  photoUrl: string | null;
}

/**
 * Campaign brief form — starts from the brand/product catalog (same picker
 * pattern as the creative wizard) so the agent inherits brand voice and the
 * product is reused instead of duplicated per campaign. All prefilled fields
 * stay editable: the catalog fills them in, the user can still override.
 */
export function BriefForm({
  brands,
  products,
  billingCurrency,
  error,
  initialProductName,
  initialProductDescription,
  initialWebsiteUrl,
}: {
  brands: BriefBrand[];
  products: BriefProduct[];
  billingCurrency?: string | null;
  error?: string;
  /** Prefill from Website Analysis' "Start a campaign" hand-off — still editable. */
  initialProductName?: string;
  initialProductDescription?: string;
  initialWebsiteUrl?: string;
}) {
  const [brandId, setBrandId] = useState<string | null>(null);
  const [productId, setProductId] = useState<string | null>(null);

  const [productName, setProductName] = useState(initialProductName ?? "");
  const [productDescription, setProductDescription] = useState(initialProductDescription ?? "");
  const [audience, setAudience] = useState("");
  const [tone, setTone] = useState("");
  const [brandColor, setBrandColor] = useState("");
  const [logoUrl, setLogoUrl] = useState("");
  const [photoUrl, setPhotoUrl] = useState("");
  const [websiteUrl, setWebsiteUrl] = useState(initialWebsiteUrl ?? "");
  const [destination, setDestination] = useState<"website" | "whatsapp">("website");

  const brandProducts = brandId
    ? products.filter((p) => p.brandProfileId === brandId)
    : [];

  function selectBrand(b: BriefBrand) {
    if (brandId === b.id) {
      setBrandId(null);
      setProductId(null);
      return;
    }
    setBrandId(b.id);
    setProductId(null);
    if (b.tone) setTone(b.tone);
    if (b.primaryColor) setBrandColor(b.primaryColor);
    if (b.logoUrl) setLogoUrl(b.logoUrl);
    if (b.websiteUrl) setWebsiteUrl(b.websiteUrl);
  }

  function selectProduct(p: BriefProduct) {
    if (productId === p.id) {
      setProductId(null);
      return;
    }
    setProductId(p.id);
    setProductName(p.name);
    setProductDescription(p.description ?? "");
    setAudience(p.targetAudience ?? "");
    if (p.photoUrl) setPhotoUrl(p.photoUrl);
  }

  return (
    <form
      action={createCampaignFromBrief}
      className="space-y-4"
    >
      <input type="hidden" name="brandProfileId" value={brandId ?? ""} />
      <input type="hidden" name="productId" value={productId ?? ""} />

      {/* ── Brand ─────────────────────────────────────────────────────── */}
      {brands.length > 0 && (
        <div className="rounded-2xl border border-app-border bg-app-surface/60 p-6">
          <h2 className="text-lg font-semibold">Brand</h2>
          <p className="mt-1 text-sm text-app-text-muted">
            Pick a brand — the agent writes strategy and copy in its voice, and
            uses its colors and logo on the creatives.
          </p>
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {brands.map((b) => {
              const bc = safeHex(b.primaryColor);
              const sel = b.id === brandId;
              return (
                <button
                  key={b.id}
                  type="button"
                  onClick={() => selectBrand(b)}
                  className={`flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all ${
                    sel
                      ? "border-amber-400 bg-amber-950/25 ring-1 ring-amber-400"
                      : "border-app-border-strong bg-app-bg/70 hover:border-app-border-emphasis"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {b.logoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={b.logoUrl}
                        alt={b.name}
                        className="h-8 w-8 rounded-lg object-contain"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div
                        className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                        style={{ backgroundColor: bc }}
                      >
                        {b.name.slice(0, 2).toUpperCase()}
                      </div>
                    )}
                    <span className="flex-1 truncate text-sm font-semibold text-app-text">
                      {b.name}
                    </span>
                    <div
                      className="h-4 w-4 shrink-0 rounded-full border border-white/20"
                      style={{ backgroundColor: bc }}
                    />
                  </div>
                  {sel && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>
          <Link
            href="/dashboard/brands/new"
            className="mt-4 inline-block text-xs text-app-text-subtle transition-colors hover:text-app-text"
          >
            + New brand profile
          </Link>
        </div>
      )}

      {/* ── Product ───────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-app-border bg-app-surface/60 p-6">
        <h2 className="text-lg font-semibold">Product</h2>
        <p className="mt-1 text-sm text-app-text-muted">
          {brandProducts.length > 0
            ? "Pick a saved product, or describe a new one below."
            : "What is this campaign selling?"}
        </p>

        {brandProducts.length > 0 && (
          <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
            {brandProducts.map((p) => {
              const sel = p.id === productId;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => selectProduct(p)}
                  className={`flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all ${
                    sel
                      ? "border-amber-400 bg-amber-950/25 ring-1 ring-amber-400"
                      : "border-app-border-strong bg-app-bg/70 hover:border-app-border-emphasis"
                  }`}
                >
                  <div className="flex items-center gap-3">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.photoUrl}
                        alt={p.name}
                        className="h-10 w-10 shrink-0 rounded-lg object-cover"
                        onError={(e) => {
                          (e.currentTarget as HTMLImageElement).style.display = "none";
                        }}
                      />
                    ) : (
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-app-surface-2 text-sm">
                        📦
                      </div>
                    )}
                    <span className="flex-1 truncate text-sm font-semibold text-app-text">
                      {p.name}
                    </span>
                  </div>
                  {sel && (
                    <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                      Selected
                    </div>
                  )}
                </button>
              );
            })}
          </div>
        )}

        <div className="mt-5 space-y-3">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-app-text-muted">Product name *</span>
            <input
              name="productName"
              required
              className={field}
              value={productName}
              onChange={(e) => setProductName(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-app-text-muted">Product description</span>
            <textarea
              name="productDescription"
              rows={3}
              className={field}
              value={productDescription}
              onChange={(e) => setProductDescription(e.target.value)}
            />
          </label>
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-app-text-muted">
              Product photo URL{" "}
              <span className="text-app-text-subtle">
                — used as ad background (blank = AI-generated background)
              </span>
            </span>
            <input
              name="photoUrl"
              type="url"
              placeholder="https://…/product.jpg"
              className={field}
              value={photoUrl}
              onChange={(e) => setPhotoUrl(e.target.value)}
            />
          </label>
        </div>
      </div>

      {/* ── Campaign ──────────────────────────────────────────────────── */}
      <div className="rounded-2xl border border-app-border bg-app-surface/60 p-6">
        <h2 className="text-lg font-semibold">Campaign</h2>
        <p className="mt-1 text-sm text-app-text-muted">
          The agent researches the market, writes the strategy, and prepares
          creatives from this.
        </p>

        <div className="mt-5 space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-app-text-muted">Campaign goal *</span>
            <input
              name="goal"
              required
              placeholder="e.g. Drive online sales for the spring launch"
              className={field}
            />
          </label>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-app-text-muted">Target audience</span>
              <input
                name="audience"
                className={field}
                value={audience}
                onChange={(e) => setAudience(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-app-text-muted">
                Budget
                {billingCurrency ? (
                  <span className="text-app-text-subtle">
                    {" "}— your ad account bills in {billingCurrency}; other
                    currencies are auto-converted
                  </span>
                ) : null}
              </span>
              <input
                name="budget"
                placeholder={
                  billingCurrency
                    ? `e.g. 300 ${billingCurrency} / week`
                    : "e.g. 5000 MAD / month"
                }
                className={field}
              />
            </label>
          </div>

          {/* Click destination: website vs WhatsApp chat */}
          <input type="hidden" name="destination" value={destination} />
          <div>
            <span className="text-sm text-app-text-muted">Where should a click go?</span>
            <div className="mt-1.5 grid grid-cols-2 gap-2">
              {([
                { id: "website" as const, label: "🌐 Website", desc: "Clicks open your landing page" },
                { id: "whatsapp" as const, label: "💬 WhatsApp", desc: "Clicks open a chat with your business" },
              ]).map((d) => (
                <button
                  key={d.id}
                  type="button"
                  onClick={() => setDestination(d.id)}
                  className={`rounded-xl border p-3 text-left transition-all ${
                    destination === d.id
                      ? "border-amber-400 bg-amber-950/25 ring-1 ring-amber-400"
                      : "border-app-border-strong bg-app-bg/70 hover:border-app-border-emphasis"
                  }`}
                >
                  <p className="text-sm font-semibold text-app-text">{d.label}</p>
                  <p className="mt-0.5 text-xs text-app-text-subtle">{d.desc}</p>
                </button>
              ))}
            </div>
            {destination === "whatsapp" && (
              <p className="mt-1.5 text-xs text-app-text-subtle">
                Requires a WhatsApp Business number connected to your Facebook
                Page. No landing page needed.
              </p>
            )}
          </div>

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-app-text-muted">
                {destination === "whatsapp"
                  ? "Website URL (optional)"
                  : "Destination URL (needed to launch)"}
              </span>
              <input
                name="websiteUrl"
                type="url"
                placeholder="https://yourstore.com/product"
                className={field}
                value={websiteUrl}
                onChange={(e) => setWebsiteUrl(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-app-text-muted">Target countries</span>
              <input name="geoCountries" placeholder="US, MA, FR" className={field} />
            </label>
          </div>
        </div>
      </div>

      {/* ── Language ──────────────────────────────────────────────────── */}
      <LanguagePicker />

      {/* ── Brand overrides (auto-filled from the selected brand) ─────── */}
      <div className="rounded-2xl border border-app-border bg-app-surface/60 p-6">
        <h2 className="text-lg font-semibold">Brand style</h2>
        <p className="mt-1 text-sm text-app-text-muted">
          {brandId
            ? "Auto-filled from the selected brand — edit to override for this campaign."
            : "Optional — or pick a brand above to fill these automatically."}
        </p>

        <div className="mt-5 space-y-4">
          <label className="flex flex-col gap-1 text-sm">
            <span className="text-app-text-muted">Brand tone</span>
            <input
              name="tone"
              placeholder="e.g. playful, premium, bold"
              className={field}
              value={tone}
              onChange={(e) => setTone(e.target.value)}
            />
          </label>
          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-app-text-muted">Brand color</span>
              <input
                name="brandColor"
                placeholder="#6d28d9"
                className={field}
                value={brandColor}
                onChange={(e) => setBrandColor(e.target.value)}
              />
            </label>
            <label className="flex flex-col gap-1 text-sm">
              <span className="text-app-text-muted">Logo URL</span>
              <input
                name="logoUrl"
                placeholder="https://…/logo.png"
                className={field}
                value={logoUrl}
                onChange={(e) => setLogoUrl(e.target.value)}
              />
            </label>
          </div>
        </div>
      </div>

      {error ? (
        <p className="rounded-2xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">
          {error}
        </p>
      ) : null}

      <SubmitButton />
    </form>
  );
}
