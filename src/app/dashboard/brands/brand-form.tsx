"use client";

import { useActionState, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveBrandProfile, type BrandAsset } from "./actions";
import { proposeBrandVoiceNotes, type BrandLearningState } from "./brand-learning-actions";
import { logoFileToDataUrl } from "@/lib/client/logo-file";

const FONT_FAMILIES = [
  { id: "", label: "Default (system sans)" },
  { id: "Inter", label: "Inter — clean, neutral" },
  { id: "Poppins", label: "Poppins — friendly, rounded" },
  { id: "Montserrat", label: "Montserrat — modern, geometric" },
  { id: "Playfair Display", label: "Playfair Display — editorial serif" },
  { id: "DM Sans", label: "DM Sans — minimal" },
  { id: "Space Grotesk", label: "Space Grotesk — techy" },
  { id: "Bebas Neue", label: "Bebas Neue — bold display" },
];

const TEMPLATES: { id: "overlay" | "split" | "bold"; label: string }[] = [
  { id: "overlay", label: "Overlay" },
  { id: "split", label: "Split" },
  { id: "bold", label: "Bold" },
];

interface BrandFormProps {
  brand?: {
    id: string; name: string; primaryColor: string | null;
    logoUrl: string | null; websiteUrl: string | null;
    tone: string | null; description: string | null;
    secondaryColor?: string | null; accentColor?: string | null;
    fontFamily?: string | null; defaultTemplate?: string | null;
    voiceNotes?: string | null; assets?: unknown;
  };
  error?: string;
}

function BrandLearningPanel({ brandProfileId, onDraft }: { brandProfileId: string; onDraft: (text: string) => void }) {
  const [state, action, pending] = useActionState<BrandLearningState, FormData>(
    proposeBrandVoiceNotes,
    { status: "idle" },
  );

  return (
    <div className="rounded-xl border border-blue-400/20 bg-blue-950/15 p-4">
      <form action={action} className="flex items-center justify-between gap-3">
        <input type="hidden" name="brandProfileId" value={brandProfileId} />
        <div>
          <p className="text-sm font-medium text-blue-200">Brand Learning</p>
          <p className="text-xs text-app-text-subtle">Analyze past AI-generated content to draft voice consistency notes.</p>
        </div>
        <button type="submit" disabled={pending}
          className="shrink-0 rounded-lg border border-blue-400/30 bg-blue-900/30 px-3 py-2 text-xs font-semibold text-blue-200 hover:bg-blue-900/50 disabled:opacity-60">
          {pending ? "Analyzing…" : "Suggest from my content"}
        </button>
      </form>
      {state.status === "error" && <p className="mt-2 text-xs text-red-400">{state.message}</p>}
      {state.status === "success" && (
        <div className="mt-3 rounded-lg border border-app-border-strong bg-app-bg p-3">
          <p className="text-sm text-app-text">{state.draft}</p>
          <button type="button" onClick={() => onDraft(state.draft)}
            className="mt-2 text-xs font-semibold text-amber-400 hover:underline">
            Use this →
          </button>
        </div>
      )}
    </div>
  );
}

function SaveButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 font-semibold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-70">
      {pending ? (
        <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
        </svg>Saving…</>
      ) : isEdit ? "Save changes" : "Create brand"}
    </button>
  );
}

export function BrandForm({ brand, error }: BrandFormProps) {
  const isEdit = !!brand;
  const logoFileRef = useRef<HTMLInputElement>(null);
  const assetFileRef = useRef<HTMLInputElement>(null);

  const [name,        setName]        = useState(brand?.name        ?? "");
  const [color,       setColor]       = useState(brand?.primaryColor ?? "#7c3aed");
  const [logoUrl,     setLogoUrl]     = useState(brand?.logoUrl      ?? "");
  const [logoTab,     setLogoTab]     = useState<"url"|"upload">("url");
  const [uploadStatus, setUploadStatus] = useState<"idle"|"loading"|"done"|"error">("idle");
  const [websiteUrl,  setWebsiteUrl]  = useState(brand?.websiteUrl  ?? "");
  const [tone,        setTone]        = useState(brand?.tone         ?? "");
  const [description, setDescription] = useState(brand?.description  ?? "");

  const [secondaryColor, setSecondaryColor] = useState(brand?.secondaryColor ?? "");
  const [accentColor,    setAccentColor]    = useState(brand?.accentColor    ?? "#f59e0b");
  const [fontFamily,     setFontFamily]     = useState(brand?.fontFamily     ?? "");
  const [defaultTemplate, setDefaultTemplate] = useState(brand?.defaultTemplate ?? "overlay");
  const [voiceNotes,     setVoiceNotes]     = useState(brand?.voiceNotes     ?? "");
  const [assets, setAssets] = useState<BrandAsset[]>(
    Array.isArray(brand?.assets) ? (brand!.assets as BrandAsset[]) : [],
  );
  const [assetUploading, setAssetUploading] = useState(false);

  const [scanStatus, setScanStatus] = useState<"idle"|"loading"|"done"|"error">("idle");
  const [scanError,  setScanError]  = useState<string | null>(null);

  async function handleAssetFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    if (!files.length) return;
    setAssetUploading(true);
    try {
      for (const file of files.slice(0, 20 - assets.length)) {
        if (file.size > 5 * 1024 * 1024) continue;
        const fd = new FormData();
        fd.set("file", file);
        const res = await fetch("/api/upload-asset", { method: "POST", body: fd });
        if (!res.ok) continue;
        const { url } = (await res.json()) as { url: string };
        setAssets((prev) => [...prev, { url, label: file.name.replace(/\.[^.]+$/, "") }]);
      }
    } finally {
      setAssetUploading(false);
      if (assetFileRef.current) assetFileRef.current.value = "";
    }
  }

  function removeAsset(url: string) {
    setAssets((prev) => prev.filter((a) => a.url !== url));
  }

  const field = "w-full rounded-xl border border-app-border-strong bg-app-bg px-4 py-3 text-sm text-app-text outline-none placeholder:text-app-text-subtle focus:border-zinc-500";
  const safeColor = /^#[0-9a-f]{6}$/i.test(color) ? color : "#7c3aed";

  async function handleScan() {
    const raw = websiteUrl.trim();
    if (!raw) return;
    setScanStatus("loading"); setScanError(null);
    try {
      const url = raw.startsWith("http") ? raw : `https://${raw}`;
      const res = await fetch(`/api/brand-import?url=${encodeURIComponent(url)}`);
      const data = await res.json() as {
        brandName?: string; description?: string; tone?: string | null;
        brandColor?: string | null; logoUrl?: string | null; error?: string;
        secondaryColor?: string | null; fontFamily?: string | null;
      };
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      if (data.brandName)   setName(data.brandName);
      if (data.description) setDescription(data.description);
      if (data.tone)        setTone(data.tone);
      if (data.brandColor && /^#[0-9a-f]{6}$/i.test(data.brandColor)) setColor(data.brandColor);
      if (data.secondaryColor && /^#[0-9a-f]{6}$/i.test(data.secondaryColor)) setSecondaryColor(data.secondaryColor);
      if (data.fontFamily && FONT_FAMILIES.some((f) => f.id === data.fontFamily)) setFontFamily(data.fontFamily);
      if (data.logoUrl)     { setLogoUrl(data.logoUrl); setLogoTab("url"); }
      setScanStatus("done");
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
      setScanStatus("error");
    }
  }

  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setUploadStatus("error"); return; }
    setUploadStatus("loading");
    try {
      setLogoUrl(await logoFileToDataUrl(file));
      setUploadStatus("done");
    } catch {
      setUploadStatus("error");
    }
  }

  return (
    <form action={saveBrandProfile} className="space-y-5">
      {isEdit ? <input type="hidden" name="id" value={brand!.id} /> : null}
      <input type="hidden" name="primaryColor" value={color} />
      <input type="hidden" name="logoUrl"      value={logoUrl} />
      <input type="hidden" name="websiteUrl"   value={websiteUrl} />
      <input type="hidden" name="secondaryColor"  value={secondaryColor} />
      <input type="hidden" name="accentColor"     value={accentColor} />
      <input type="hidden" name="fontFamily"      value={fontFamily} />
      <input type="hidden" name="defaultTemplate" value={defaultTemplate} />
      <input type="hidden" name="voiceNotes"      value={voiceNotes} />
      <input type="hidden" name="assets"          value={JSON.stringify(assets)} />

      {error ? (
        <div className="rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      {/* Import from website */}
      <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5">
        <h3 className="font-semibold">Import from website</h3>
        <p className="mt-0.5 text-sm text-app-text-muted">We&apos;ll extract your brand name, colors and logo automatically.</p>
        <div className="mt-3 flex gap-2">
          <input type="text" placeholder="yoursite.com"
            className="min-w-0 flex-1 rounded-xl border border-app-border-strong bg-app-bg px-4 py-3 text-sm text-app-text outline-none placeholder:text-app-text-subtle focus:border-zinc-500"
            value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScan(); } }} />
          <button type="button" onClick={handleScan} disabled={scanStatus === "loading" || !websiteUrl.trim()}
            className="shrink-0 rounded-xl border border-app-border-emphasis bg-app-surface-2 px-4 py-2.5 text-sm font-medium text-app-text hover:bg-app-surface-2 disabled:opacity-50">
            {scanStatus === "loading" ? (
              <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/>
              </svg>
            ) : "Import"}
          </button>
        </div>
        {scanStatus === "done" && (
          <p className="mt-2 flex items-center gap-1 text-xs text-emerald-400">
            <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
            Fields filled from your website
          </p>
        )}
        {scanError && <p className="mt-2 text-xs text-red-400">{scanError}</p>}
      </div>

      {/* Brand identity */}
      <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5 space-y-4">
        <h3 className="font-semibold">Brand identity</h3>

        <div>
          <label className="text-sm text-app-text-muted">Brand name *</label>
          <input name="name" placeholder="NooRattan" className={`mt-1.5 ${field}`}
            value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="text-sm text-app-text-muted">Brand color</label>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-app-border-strong">
              <input type="color" value={safeColor} onChange={(e) => setColor(e.target.value)}
                className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
              <div className="h-full w-full" style={{ backgroundColor: safeColor }} />
            </div>
            <input type="text" placeholder="#7c3aed" maxLength={7}
              value={color} onChange={(e) => setColor(e.target.value)}
              className={`flex-1 ${field}`} />
          </div>
        </div>

        {/* Logo */}
        <div>
          <label className="text-sm text-app-text-muted">Logo</label>
          <div className="mt-1.5 flex gap-1 rounded-xl border border-app-border-strong bg-app-bg p-1">
            {(["url", "upload"] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => setLogoTab(tab)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                  logoTab === tab ? "bg-app-surface-2 text-app-text" : "text-app-text-subtle hover:text-app-text"}`}>
                {tab === "url" ? "Paste URL" : "Upload file"}
              </button>
            ))}
          </div>
          {logoTab === "url" ? (
            <input type="text" placeholder="https://…/logo.png"
              value={logoUrl.startsWith("data:") ? "" : logoUrl}
              onChange={(e) => setLogoUrl(e.target.value)}
              className={`mt-2 ${field}`} />
          ) : (
            <div className="mt-2">
              <input ref={logoFileRef} type="file" accept="image/*" className="hidden" onChange={handleLogoFile} />
              <button type="button" onClick={() => logoFileRef.current?.click()}
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-app-border-emphasis bg-app-bg py-4 text-sm text-app-text-muted hover:border-zinc-500 hover:text-app-text">
                {uploadStatus === "loading" ? "Reading…"
                  : uploadStatus === "done" ? <span className="text-emerald-400">Logo uploaded — click to change</span>
                  : uploadStatus === "error" ? <span className="text-red-400">Must be an image under 2 MB</span>
                  : "Upload logo (PNG, SVG — max 2 MB)"}
              </button>
            </div>
          )}
          {logoUrl ? (
            <div className="mt-2 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={logoUrl} alt="logo" className="h-8 w-auto max-w-[100px] rounded object-contain"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              <button type="button" onClick={() => { setLogoUrl(""); setUploadStatus("idle"); }}
                className="text-xs text-app-text-subtle hover:text-app-text-muted">Remove</button>
            </div>
          ) : null}
        </div>

        <div>
          <label className="text-sm text-app-text-muted">Brand tone <span className="text-app-text-subtle">(optional)</span></label>
          <input name="tone" placeholder="premium, warm, artisanal" className={`mt-1.5 ${field}`}
            value={tone} onChange={(e) => setTone(e.target.value)} />
        </div>

        <div>
          <label className="text-sm text-app-text-muted">Short description <span className="text-app-text-subtle">(optional)</span></label>
          <textarea name="description" rows={3} placeholder="What does this brand sell and who is it for?"
            className={`mt-1.5 ${field}`}
            value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      {/* Palette & typography */}
      <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5 space-y-4">
        <h3 className="font-semibold">Palette &amp; typography</h3>
        <p className="mt-0.5 text-sm text-app-text-muted">Used to render designed ad creatives in this brand&apos;s look.</p>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-sm text-app-text-muted">Secondary color <span className="text-app-text-subtle">(optional)</span></label>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-app-border-strong">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(secondaryColor) ? secondaryColor : "#94a3b8"}
                  onChange={(e) => setSecondaryColor(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                <div className="h-full w-full" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(secondaryColor) ? secondaryColor : "#3f3f46" }} />
              </div>
              <input type="text" placeholder="none" maxLength={7}
                value={secondaryColor} onChange={(e) => setSecondaryColor(e.target.value)}
                className={`flex-1 ${field}`} />
            </div>
          </div>
          <div>
            <label className="text-sm text-app-text-muted">Accent / CTA color</label>
            <div className="mt-1.5 flex items-center gap-3">
              <div className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-app-border-strong">
                <input type="color" value={/^#[0-9a-f]{6}$/i.test(accentColor) ? accentColor : "#f59e0b"}
                  onChange={(e) => setAccentColor(e.target.value)}
                  className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                <div className="h-full w-full" style={{ backgroundColor: /^#[0-9a-f]{6}$/i.test(accentColor) ? accentColor : "#f59e0b" }} />
              </div>
              <input type="text" placeholder="#f59e0b" maxLength={7}
                value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
                className={`flex-1 ${field}`} />
            </div>
          </div>
        </div>

        <div>
          <label className="text-sm text-app-text-muted">Font</label>
          <select value={fontFamily} onChange={(e) => setFontFamily(e.target.value)} className={`mt-1.5 ${field}`}>
            {FONT_FAMILIES.map((f) => <option key={f.id} value={f.id}>{f.label}</option>)}
          </select>
        </div>

        <div>
          <label className="text-sm text-app-text-muted">Default ad template</label>
          <div className="mt-1.5 grid grid-cols-3 gap-2">
            {TEMPLATES.map((t) => (
              <button key={t.id} type="button" onClick={() => setDefaultTemplate(t.id)}
                className={`rounded-xl border px-3 py-2.5 text-sm font-medium transition-colors ${
                  defaultTemplate === t.id ? "border-amber-400 bg-amber-950/25 text-amber-200" : "border-app-border-strong text-app-text-muted hover:border-app-border-emphasis"
                }`}>
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Asset gallery */}
      <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5 space-y-3">
        <h3 className="font-semibold">Brand assets</h3>
        <p className="text-sm text-app-text-muted">Reference photos, icons, or graphics to reuse across creatives.</p>

        <input ref={assetFileRef} type="file" accept="image/*" multiple className="hidden" onChange={handleAssetFiles} />

        {assets.length > 0 && (
          <div className="grid grid-cols-4 gap-2 sm:grid-cols-6">
            {assets.map((a) => (
              <div key={a.url} className="group relative aspect-square overflow-hidden rounded-lg border border-app-border-strong bg-app-bg">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={a.url} alt={a.label} className="h-full w-full object-cover" />
                <button type="button" onClick={() => removeAsset(a.url)}
                  className="absolute inset-0 flex items-center justify-center bg-black/60 text-xs font-semibold text-white opacity-0 transition-opacity group-hover:opacity-100">
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}

        <button type="button" onClick={() => assetFileRef.current?.click()} disabled={assetUploading || assets.length >= 20}
          className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-app-border-emphasis bg-app-bg py-3 text-sm text-app-text-muted hover:border-zinc-500 hover:text-app-text disabled:opacity-50">
          {assetUploading ? "Uploading…" : `Upload assets (${assets.length}/20)`}
        </button>
      </div>

      {/* Brand voice notes + Learning */}
      <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5 space-y-3">
        <h3 className="font-semibold">Voice consistency notes <span className="text-app-text-subtle font-normal">(optional)</span></h3>
        <p className="text-sm text-app-text-muted">Layered on top of tone — feeds every Generate tool that uses this brand.</p>
        <textarea rows={3} placeholder="Recurring phrases, sentence rhythm, angles that work, things to avoid…"
          className={field} value={voiceNotes} onChange={(e) => setVoiceNotes(e.target.value)} />
        {isEdit && brand ? (
          <BrandLearningPanel brandProfileId={brand.id} onDraft={setVoiceNotes} />
        ) : (
          <p className="text-xs text-app-text-subtle">Save this brand first, then use it in a Generate tool — Brand Learning needs past content to analyze.</p>
        )}
      </div>

      {/* Preview */}
      <div className="rounded-2xl border border-app-border bg-app-surface/60 p-5">
        <h3 className="mb-3 font-semibold">Preview</h3>
        <div className="flex h-28 items-center justify-center overflow-hidden rounded-xl"
          style={{ background: `linear-gradient(135deg, ${safeColor}33 0%, ${safeColor}0a 100%)` }}>
          {logoUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={logoUrl} alt={name || "brand"} className="h-14 w-auto max-w-[180px] object-contain drop-shadow-lg"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          ) : (
            <div className="flex h-14 w-14 items-center justify-center rounded-2xl text-2xl font-black"
              style={{ backgroundColor: safeColor, color: "#fff" }}>
              {name ? name[0].toUpperCase() : "B"}
            </div>
          )}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SaveButton isEdit={isEdit} />
        <a href="/dashboard/brands" className="rounded-xl border border-app-border-strong px-5 py-3 text-sm text-app-text-muted hover:text-app-text">
          Cancel
        </a>
      </div>
    </form>
  );
}
