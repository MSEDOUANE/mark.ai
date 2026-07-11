"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveBrandProfile } from "./actions";
import { logoFileToDataUrl } from "@/lib/client/logo-file";

interface BrandFormProps {
  brand?: {
    id: string; name: string; primaryColor: string | null;
    logoUrl: string | null; websiteUrl: string | null;
    tone: string | null; description: string | null;
  };
  error?: string;
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

  const [name,        setName]        = useState(brand?.name        ?? "");
  const [color,       setColor]       = useState(brand?.primaryColor ?? "#7c3aed");
  const [logoUrl,     setLogoUrl]     = useState(brand?.logoUrl      ?? "");
  const [logoTab,     setLogoTab]     = useState<"url"|"upload">("url");
  const [uploadStatus, setUploadStatus] = useState<"idle"|"loading"|"done"|"error">("idle");
  const [websiteUrl,  setWebsiteUrl]  = useState(brand?.websiteUrl  ?? "");
  const [tone,        setTone]        = useState(brand?.tone         ?? "");
  const [description, setDescription] = useState(brand?.description  ?? "");

  const [scanStatus, setScanStatus] = useState<"idle"|"loading"|"done"|"error">("idle");
  const [scanError,  setScanError]  = useState<string | null>(null);

  const field = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500";
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
      };
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      if (data.brandName)   setName(data.brandName);
      if (data.description) setDescription(data.description);
      if (data.tone)        setTone(data.tone);
      if (data.brandColor && /^#[0-9a-f]{6}$/i.test(data.brandColor)) setColor(data.brandColor);
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

      {error ? (
        <div className="rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      {/* Import from website */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
        <h3 className="font-semibold">Import from website</h3>
        <p className="mt-0.5 text-sm text-zinc-400">We&apos;ll extract your brand name, colors and logo automatically.</p>
        <div className="mt-3 flex gap-2">
          <input type="text" placeholder="yoursite.com"
            className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500"
            value={websiteUrl} onChange={(e) => setWebsiteUrl(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScan(); } }} />
          <button type="button" onClick={handleScan} disabled={scanStatus === "loading" || !websiteUrl.trim()}
            className="shrink-0 rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50">
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
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <h3 className="font-semibold">Brand identity</h3>

        <div>
          <label className="text-sm text-zinc-400">Brand name *</label>
          <input name="name" placeholder="NooRattan" className={`mt-1.5 ${field}`}
            value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="text-sm text-zinc-400">Brand color</label>
          <div className="mt-1.5 flex items-center gap-3">
            <div className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-zinc-700">
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
          <label className="text-sm text-zinc-400">Logo</label>
          <div className="mt-1.5 flex gap-1 rounded-xl border border-zinc-700 bg-zinc-950 p-1">
            {(["url", "upload"] as const).map((tab) => (
              <button key={tab} type="button" onClick={() => setLogoTab(tab)}
                className={`flex-1 rounded-lg py-1.5 text-xs font-medium transition-colors ${
                  logoTab === tab ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
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
                className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-600 bg-zinc-950 py-4 text-sm text-zinc-400 hover:border-zinc-500 hover:text-zinc-200">
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
                className="text-xs text-zinc-600 hover:text-zinc-400">Remove</button>
            </div>
          ) : null}
        </div>

        <div>
          <label className="text-sm text-zinc-400">Brand tone <span className="text-zinc-600">(optional)</span></label>
          <input name="tone" placeholder="premium, warm, artisanal" className={`mt-1.5 ${field}`}
            value={tone} onChange={(e) => setTone(e.target.value)} />
        </div>

        <div>
          <label className="text-sm text-zinc-400">Short description <span className="text-zinc-600">(optional)</span></label>
          <textarea name="description" rows={3} placeholder="What does this brand sell and who is it for?"
            className={`mt-1.5 ${field}`}
            value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>
      </div>

      {/* Preview */}
      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5">
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
        <a href="/dashboard/brands" className="rounded-xl border border-zinc-700 px-5 py-3 text-sm text-zinc-400 hover:text-zinc-200">
          Cancel
        </a>
      </div>
    </form>
  );
}
