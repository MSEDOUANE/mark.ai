"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { generateStandaloneCreatives } from "../actions";
import { StockPhotoPicker, type StockPhoto } from "@/components/stock-photo-picker";
import { logoFileToDataUrl } from "@/lib/client/logo-file";

// ─────────────────────────────────────────────────────────────────────────────
// Utilities
// ─────────────────────────────────────────────────────────────────────────────

function safeHex(c: string) {
  return /^#[0-9a-f]{6}$/i.test(c) ? c : "#7c3aed";
}

function CharCounter({ value, max }: { value: string; max: number }) {
  const left = max - value.length;
  return (
    <span className={`text-xs tabular-nums ${left <= 5 ? "text-red-400" : "text-zinc-600"}`}>
      {left}
    </span>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Step indicator
// ─────────────────────────────────────────────────────────────────────────────

const STEP_LABELS = ["Brand", "Product", "Brief", "Generate"];

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center">
      {STEP_LABELS.map((label, i) => (
        <div key={label} className="flex items-center">
          <div className="flex flex-col items-center">
            <div className={`flex h-8 w-8 items-center justify-center rounded-full text-sm font-bold transition-all duration-200 ${
              i < current  ? "bg-amber-400 text-zinc-950"
              : i === current ? "bg-amber-400 text-zinc-950 ring-4 ring-amber-400/25"
              : "bg-zinc-800 text-zinc-500"}`}>
              {i < current ? (
                <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : i + 1}
            </div>
            <span className={`mt-1.5 hidden text-xs font-medium sm:block ${i <= current ? "text-zinc-300" : "text-zinc-600"}`}>{label}</span>
          </div>
          {i < STEP_LABELS.length - 1 ? (
            <div className={`mx-2 mb-5 h-px w-8 flex-shrink-0 transition-all duration-300 sm:mx-3 sm:w-14 ${i < current ? "bg-amber-400" : "bg-zinc-800"}`} />
          ) : null}
        </div>
      ))}
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Template mini thumbnails
// ─────────────────────────────────────────────────────────────────────────────

function TemplateMini({ id, color }: { id: string; color: string }) {
  const c = safeHex(color);
  switch (id) {
    case "overlay":
      return (
        <div className="relative h-full w-full overflow-hidden rounded-lg" style={{ background: `${c}55` }}>
          <div className="absolute inset-x-0 bottom-0 h-[45%] p-2" style={{ background: "rgba(0,0,0,0.72)" }}>
            <div className="h-1.5 w-4/5 rounded bg-white/80" />
            <div className="mt-1 h-1 w-3/5 rounded bg-white/50" />
            <div className="mt-2 h-2 w-1/3 rounded-full" style={{ background: c }} />
          </div>
        </div>
      );
    case "split":
      return (
        <div className="flex h-full w-full overflow-hidden rounded-lg">
          <div className="h-full w-1/2" style={{ background: `${c}55` }} />
          <div className="flex h-full w-1/2 flex-col justify-center gap-1.5 p-2" style={{ background: "rgba(255,255,255,0.04)" }}>
            <div className="h-1.5 rounded bg-white/75" />
            <div className="h-1 w-4/5 rounded bg-white/45" />
            <div className="mt-1.5 h-2 w-2/5 rounded-full" style={{ background: c }} />
          </div>
        </div>
      );
    case "bold":
      return (
        <div className="flex h-full w-full flex-col justify-center gap-2 overflow-hidden rounded-lg p-3" style={{ background: `${c}18` }}>
          <div className="h-3 w-full rounded bg-white/90" />
          <div className="h-2 w-4/5 rounded bg-white/60" />
          <div className="mt-0.5 h-2 w-2/5 rounded-full" style={{ background: c }} />
        </div>
      );
    default:
      return (
        <div className="flex h-full w-full items-center justify-center overflow-hidden rounded-lg" style={{ background: `${c}22` }}>
          <p className="text-2xl font-black leading-none" style={{ color: c }}>AI</p>
        </div>
      );
  }
}

const TEMPLATES = [
  { id: "auto",    label: "Auto",    desc: "AI picks the best layout" },
  { id: "overlay", label: "Overlay", desc: "Image with text overlay" },
  { id: "split",   label: "Split",   desc: "Half image, half text" },
  { id: "bold",    label: "Bold",    desc: "Giant headline hero" },
] as const;

// ─────────────────────────────────────────────────────────────────────────────
// Live preview
// ─────────────────────────────────────────────────────────────────────────────

function LivePreview({ brandColor, accentColor, logoUrl, photoUrl, headline, body, cta, productName }: {
  brandColor: string; accentColor: string; logoUrl: string; photoUrl: string;
  headline: string; body: string; cta: string; productName: string;
}) {
  const c = safeHex(brandColor);
  const a = safeHex(accentColor);
  const bgStyle: React.CSSProperties = photoUrl
    ? { backgroundImage: `linear-gradient(rgba(0,0,0,0.3) 0%,rgba(0,0,0,0.68) 100%),url("${photoUrl}")`, backgroundSize: "cover", backgroundPosition: "center" }
    : { background: `linear-gradient(145deg, ${c}cc 0%, ${c}44 100%)` };

  return (
    <div className="sticky top-20 space-y-3">
      <p className="text-[11px] font-semibold uppercase tracking-widest text-zinc-500">Live preview</p>
      <div className="relative aspect-[4/5] w-full overflow-hidden rounded-2xl border border-white/10 shadow-2xl shadow-black/50" style={bgStyle}>
        <div className="absolute right-3 top-3 flex items-center rounded-full bg-emerald-500/90 px-2.5 py-1 text-[11px] font-bold text-white shadow-lg">~85</div>
        {logoUrl ? (
          <div className="absolute left-4 top-4">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={logoUrl} alt="logo" className="h-7 w-auto max-w-[90px] object-contain drop-shadow"
              onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
          </div>
        ) : null}
        <div className="absolute inset-x-0 bottom-0 p-5"
          style={photoUrl ? undefined : { background: "linear-gradient(to top,rgba(0,0,0,0.78),transparent)" }}>
          <p className="text-[15px] font-bold leading-snug text-white">{headline || productName || "Your headline here"}</p>
          <p className="mt-1 text-xs text-white/60">{body || "Your punchline goes here"}</p>
          <div className="mt-3 inline-flex rounded-full px-4 py-1.5 text-xs font-semibold shadow" style={{ backgroundColor: a, color: "#0b0b12" }}>
            {cta || "Shop Now"}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Generate button
// ─────────────────────────────────────────────────────────────────────────────

function GenerateButton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="group relative w-full overflow-hidden rounded-2xl bg-gradient-to-r from-amber-400 to-orange-400 px-6 py-4 text-base font-bold text-zinc-950 shadow-lg shadow-amber-500/25 transition-all hover:from-amber-300 hover:to-orange-300 disabled:opacity-70">
      {pending ? (
        <span className="flex items-center justify-center gap-2.5">
          <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
          Generating creatives…
        </span>
      ) : (
        <span className="flex items-center justify-center gap-2.5">
          Generate Creatives
          <svg className="h-5 w-5 transition-transform group-hover:translate-x-0.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13 10V3L4 14h7v7l9-11h-7z" />
          </svg>
        </span>
      )}
    </button>
  );
}

// ─────────────────────────────────────────────────────────────────────────────
// Props
// ─────────────────────────────────────────────────────────────────────────────

interface SavedBrand {
  id: string; name: string; primaryColor: string | null; logoUrl: string | null;
}

interface SavedProduct {
  id: string; name: string; description: string | null;
  targetAudience: string | null; brandProfileId: string | null;
  photoUrl: string | null;
}

interface PrefillBrand {
  name: string; primaryColor: string | null; logoUrl: string | null;
  tone: string | null; description: string | null;
}

interface WizardProps {
  campaigns: { id: string; name: string }[];
  savedBrands?: SavedBrand[];
  savedProducts?: SavedProduct[];
  prefillCampaignId?: string;
  prefillBrand?: PrefillBrand | null;
  prefillPhotoUrl?: string;
  error?: string;
}

// ─────────────────────────────────────────────────────────────────────────────
// Main wizard
// ─────────────────────────────────────────────────────────────────────────────

export function CreativeWizard({ campaigns, savedBrands = [], savedProducts = [], prefillCampaignId, prefillBrand, prefillPhotoUrl, error }: WizardProps) {
  const [step, setStep]           = useState(0);
  const [stepError, setStepError] = useState<string | null>(null);

  // ── Step 0: Brand ────────────────────────────────────────────────────────
  const [brandSelectedId, setBrandSelectedId] = useState<string | null>(null);
  const [brandColor, setBrandColor] = useState(prefillBrand?.primaryColor ?? "#7c3aed");
  const [accentColor, setAccentColor] = useState("#f59e0b");
  const [logoUrl, setLogoUrl]       = useState(prefillBrand?.logoUrl ?? "");
  const [logoTab, setLogoTab]       = useState<"url" | "upload">("url");
  const [logoUploadStatus, setLogoUploadStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [showManualBrand, setShowManualBrand] = useState(savedBrands.length === 0);
  const logoFileRef = useRef<HTMLInputElement>(null);

  // ── Step 1: Product ──────────────────────────────────────────────────────
  const [productSelectedId, setProductSelectedId]   = useState<string | null>(null);
  const [showNewProduct, setShowNewProduct]         = useState(false);
  const [productName, setProductName]               = useState("");
  const [productDescription, setProductDescription] = useState("");
  const [photoSource, setPhotoSource]               = useState<"ai" | "upload" | "stock" | "compose">(prefillPhotoUrl ? "upload" : "ai");
  const [photoUrl, setPhotoUrl]                     = useState(prefillPhotoUrl ?? "");
  const [stockSelectedId, setStockSelectedId]       = useState<string | undefined>(undefined);
  const [photoUploading, setPhotoUploading]         = useState(false);
  const [photoUploadError, setPhotoUploadError]     = useState<string | null>(null);
  const photoFileRef = useRef<HTMLInputElement>(null);

  // ── Compose slots (AI Compose multi-image mode) ──────────────────────────
  const composeFileInputRef = useRef<HTMLInputElement>(null);
  const [composeSlots, setComposeSlots] = useState([
    { id: "slot-product", label: "Product photo",  url: null as string | null },
    { id: "slot-model",   label: "Model / Avatar", url: null as string | null },
  ]);
  const [uploadingSlotId, setUploadingSlotId] = useState<string | null>(null);
  const [pendingUploadSlotId, setPendingUploadSlotId] = useState<string | null>(null);
  const [composeUploadError, setComposeUploadError] = useState<string | null>(null);
  const [scenePrompt, setScenePrompt] = useState("");
  const [sceneWriting, setSceneWriting] = useState(false);
  const [sceneWriteError, setSceneWriteError] = useState<string | null>(null);

  // ── Step 1 also: URL scan ────────────────────────────────────────────────
  const [scanUrl, setScanUrl]       = useState("");
  const [scanStatus, setScanStatus] = useState<"idle" | "loading" | "done" | "error">("idle");
  const [scanError, setScanError]   = useState<string | null>(null);

  // ── Step 2: Brief ────────────────────────────────────────────────────────
  const [textMode, setTextMode]         = useState<"ai" | "manual">("ai");
  const [goal, setGoal]                 = useState("");
  const [audience, setAudience]         = useState("");
  const [callToAction, setCallToAction] = useState("");
  const [headline, setHeadline]         = useState("");
  const [body, setBody]                 = useState("");
  const [template, setTemplate]         = useState("auto");

  // ── Step 3: Generate ─────────────────────────────────────────────────────
  const [projectName, setProjectName] = useState("");
  const [imageModel, setImageModel]   = useState<"nano-banana-2" | "flux-schnell">("nano-banana-2");

  // ── Website scan ─────────────────────────────────────────────────────────
  async function handleScan() {
    const raw = scanUrl.trim();
    if (!raw) return;
    setScanStatus("loading"); setScanError(null);
    try {
      const url = raw.startsWith("http") ? raw : `https://${raw}`;
      const res  = await fetch(`/api/brand-import?url=${encodeURIComponent(url)}`);
      const data = await res.json() as {
        brandName?: string; description?: string; brandColor?: string | null;
        logoUrl?: string | null; photoUrl?: string | null; error?: string;
      };
      if (!res.ok) throw new Error(data.error ?? "Scan failed");
      if (data.brandName)   setProductName(data.brandName);
      if (data.description) setProductDescription(data.description);
      if (data.brandColor && /^#[0-9a-f]{6}$/i.test(data.brandColor)) setBrandColor(data.brandColor);
      if (data.logoUrl) { setLogoUrl(data.logoUrl); setLogoTab("url"); }
      if (data.photoUrl) { setPhotoUrl(data.photoUrl); setPhotoSource("upload"); }
      setScanStatus("done");
    } catch (err) {
      setScanError(err instanceof Error ? err.message : "Scan failed");
      setScanStatus("error");
    }
  }

  // ── Logo upload ───────────────────────────────────────────────────────────
  async function handleLogoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 2 * 1024 * 1024) { setLogoUploadStatus("error"); return; }
    setLogoUploadStatus("loading");
    try {
      setLogoUrl(await logoFileToDataUrl(file));
      setLogoUploadStatus("done");
    } catch {
      setLogoUploadStatus("error");
    }
  }

  // ── Product photo upload ──────────────────────────────────────────────────
  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setPhotoUploadError("File too large (max 5 MB)"); return; }
    setPhotoUploading(true); setPhotoUploadError(null);
    try {
      const fd = new FormData(); fd.set("file", file);
      const res = await fetch("/api/upload-asset", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = (await res.json()) as { url: string };
      setPhotoUrl(url);
    } catch (err) {
      setPhotoUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setPhotoUploading(false);
    }
  }

  // ── Product catalog (brand-scoped) ─────────────────────────────────────────
  const brandProducts = brandSelectedId
    ? savedProducts.filter((p) => p.brandProfileId === brandSelectedId)
    : [];
  const hasProductCatalog = brandProducts.length > 0;
  // Freeform "new product" form shows when toggled on, or when there's no
  // catalog to pick from (no brand selected, or brand has no products yet).
  const showProductForm = showNewProduct || !hasProductCatalog;

  function selectProduct(p: SavedProduct) {
    if (productSelectedId === p.id) { setProductSelectedId(null); return; }
    setProductSelectedId(p.id);
    setShowNewProduct(false);
    setProductName(p.name);
    setProductDescription(p.description ?? "");
    setAudience(p.targetAudience ?? "");
    if (p.photoUrl) { setPhotoSource("upload"); setPhotoUrl(p.photoUrl); }
  }

  function startNewProduct() {
    setProductSelectedId(null);
    setShowNewProduct(true);
    setProductName("");
    setProductDescription("");
  }

  // ── Compose slot helpers ──────────────────────────────────────────────────
  function openCompositeUpload(slotId: string) {
    setPendingUploadSlotId(slotId);
    composeFileInputRef.current?.click();
  }

  async function handleCompositeFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file || !pendingUploadSlotId) return;
    e.target.value = "";
    if (file.size > 5 * 1024 * 1024) { setComposeUploadError("File too large (max 5 MB)"); return; }
    const slotId = pendingUploadSlotId;
    setUploadingSlotId(slotId); setComposeUploadError(null); setPendingUploadSlotId(null);
    try {
      const fd = new FormData(); fd.set("file", file);
      const res = await fetch("/api/upload-asset", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = (await res.json()) as { url: string };
      setComposeSlots((prev) => prev.map((s) => s.id === slotId ? { ...s, url } : s));
    } catch (err) {
      setComposeUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadingSlotId(null);
    }
  }

  function addCompositeSlot() {
    setComposeSlots((prev) => [
      ...prev,
      { id: crypto.randomUUID(), label: `Image ${prev.length + 1}`, url: null },
    ]);
  }

  function removeCompositeSlot(id: string) {
    setComposeSlots((prev) => prev.filter((s) => s.id !== id));
  }

  // AI writes the scene description from the uploaded reference images.
  async function handleWriteScenePrompt() {
    const filled = composeSlots.filter((s) => s.url);
    if (!filled.length) { setSceneWriteError("Upload at least one image first"); return; }
    setSceneWriting(true); setSceneWriteError(null);
    try {
      const context = [productName, productDescription].filter(Boolean).join(" — ") || undefined;
      const res = await fetch("/api/generate-prompt", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          images: filled.map((s) => ({ url: s.url, label: s.label })),
          context,
          mode: "ai-compose",
        }),
      });
      const json = (await res.json()) as { prompt?: string; error?: string };
      if (!res.ok || !json.prompt) throw new Error(json.error ?? "Generation failed");
      setScenePrompt(json.prompt);
    } catch (err) {
      setSceneWriteError(err instanceof Error ? err.message : "Failed to write scene");
    } finally {
      setSceneWriting(false);
    }
  }

  // ── Navigation ────────────────────────────────────────────────────────────
  function handleNext() {
    if (step === 1) {
      if (!productName.trim()) {
        setStepError(hasProductCatalog && !showNewProduct
          ? "Select a product or add a new one."
          : "Product / service name is required.");
        return;
      }
      if (photoSource === "compose" && composeSlots.every((s) => !s.url)) {
        setStepError("Upload at least one photo for AI Compose.");
        return;
      }
    }
    if (step === 2) {
      if (textMode === "ai"     && !goal.trim())     { setStepError("Creative goal is required."); return; }
      if (textMode === "manual" && !headline.trim()) { setStepError("Headline is required."); return; }
    }
    setStepError(null);
    setStep((s) => s + 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }
  function handleBack() {
    setStepError(null);
    setStep((s) => s - 1);
    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  const field = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none transition-colors placeholder:text-zinc-600 focus:border-zinc-500";

  return (
    <div>
      <StepIndicator current={step} />

      <div className="mt-8 grid grid-cols-1 gap-6 lg:grid-cols-[1fr_268px]">
        {/* ── FORM ──────────────────────────────────────────────────────── */}
        <form action={generateStandaloneCreatives}>
          {/* Always-submitted hidden fields */}
          <input type="hidden" name="textMode"           value={textMode} />
          <input type="hidden" name="productId"          value={productSelectedId ?? ""} />
          <input type="hidden" name="productName"        value={productName} />
          <input type="hidden" name="productDescription" value={productDescription} />
          <input type="hidden" name="goal"               value={goal} />
          <input type="hidden" name="audience"           value={audience} />
          <input type="hidden" name="callToAction"       value={callToAction} />
          <input type="hidden" name="headline"           value={headline} />
          <input type="hidden" name="primaryText"        value={body} />
          <input type="hidden" name="brandColor"         value={brandColor} />
          <input type="hidden" name="accentColor"        value={accentColor} />
          <input type="hidden" name="brandProfileId"     value={brandSelectedId ?? ""} />
          <input type="hidden" name="logoUrl"            value={logoUrl} />
          <input type="hidden" name="photoSource"        value={photoSource} />
          <input type="hidden" name="photoUrl"           value={photoSource === "ai" || photoSource === "compose" ? "" : photoUrl} />
          <input type="hidden" name="composeMode"        value={photoSource === "compose" ? "ai-compose" : "single"} />
          <input type="hidden" name="referenceImages"    value={photoSource === "compose" ? JSON.stringify(composeSlots.filter((s) => s.url).map((s) => s.url)) : "[]"} />
          <input type="hidden" name="scenePrompt"        value={scenePrompt} />
          <input type="hidden" name="templatePref"       value={template} />
          <input type="hidden" name="imageModel"         value={imageModel} />

          {/* ════════════════════════════════════════════════════
              STEP 0 — BRAND
          ════════════════════════════════════════════════════ */}
          <div style={{ display: step === 0 ? undefined : "none" }}>
            <div className="space-y-4">

              {/* Saved brand cards */}
              {savedBrands.length > 0 && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                  <h2 className="text-lg font-semibold">Select your brand</h2>
                  <p className="mt-1 text-sm text-zinc-400">Pick a saved brand to load its logo and colors automatically.</p>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {savedBrands.map((b) => {
                      const bc = safeHex(b.primaryColor ?? "#7c3aed");
                      const sel = b.id === brandSelectedId;
                      return (
                        <button key={b.id} type="button"
                          onClick={() => {
                            // Switching brands invalidates any product picked under the old brand.
                            setProductSelectedId(null);
                            setShowNewProduct(false);
                            if (sel) {
                              setBrandSelectedId(null);
                            } else {
                              setBrandSelectedId(b.id);
                              if (b.primaryColor) setBrandColor(b.primaryColor);
                              if (b.logoUrl)  { setLogoUrl(b.logoUrl); setLogoTab("url"); }
                            }
                          }}
                          className={`flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all ${
                            sel ? "border-amber-400 bg-amber-950/25 ring-1 ring-amber-400"
                                : "border-zinc-700 bg-zinc-950/70 hover:border-zinc-600"}`}>
                          <div className="flex items-center gap-3">
                            {b.logoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={b.logoUrl} alt={b.name} className="h-8 w-8 rounded-lg object-contain"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="flex h-8 w-8 items-center justify-center rounded-lg text-xs font-bold text-white"
                                style={{ backgroundColor: bc }}>
                                {b.name.slice(0, 2).toUpperCase()}
                              </div>
                            )}
                            <span className="flex-1 truncate text-sm font-semibold text-zinc-100">{b.name}</span>
                            <div className="h-4 w-4 shrink-0 rounded-full border border-white/20" style={{ backgroundColor: bc }} />
                          </div>
                          {sel && (
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              Selected
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>

                  {/* Toggle manual override */}
                  <button type="button" onClick={() => setShowManualBrand((v) => !v)}
                    className="mt-4 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                    {showManualBrand ? "Hide manual settings" : "Or customize colors & logo manually"}
                  </button>
                </div>
              )}

              {/* Manual brand form */}
              {showManualBrand && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                  <h2 className="text-lg font-semibold">{savedBrands.length > 0 ? "Override brand settings" : "Brand identity"}</h2>
                  <p className="mt-1 text-sm text-zinc-400">Sets the visual style across all creatives.</p>

                  <div className="mt-5 space-y-4">
                    {/* Brand color */}
                    <div>
                      <label className="text-sm text-zinc-400">Brand color</label>
                      <div className="mt-1.5 flex items-center gap-3">
                        <div className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-zinc-700">
                          <input type="color" value={safeHex(brandColor)} onChange={(e) => setBrandColor(e.target.value)}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                          <div className="h-full w-full" style={{ backgroundColor: safeHex(brandColor) }} />
                        </div>
                        <input type="text" placeholder="#7c3aed" maxLength={7}
                          value={brandColor} onChange={(e) => setBrandColor(e.target.value)}
                          className={`flex-1 ${field}`} />
                      </div>
                    </div>

                    {/* Accent color — drives the CTA button + accent bar */}
                    <div>
                      <label className="text-sm text-zinc-400">Accent color <span className="text-zinc-600">(buttons &amp; highlights)</span></label>
                      <div className="mt-1.5 flex items-center gap-3">
                        <div className="relative h-11 w-11 shrink-0 cursor-pointer overflow-hidden rounded-xl border border-zinc-700">
                          <input type="color" value={safeHex(accentColor)} onChange={(e) => setAccentColor(e.target.value)}
                            className="absolute inset-0 h-full w-full cursor-pointer opacity-0" />
                          <div className="h-full w-full" style={{ backgroundColor: safeHex(accentColor) }} />
                        </div>
                        <input type="text" placeholder="#f59e0b" maxLength={7}
                          value={accentColor} onChange={(e) => setAccentColor(e.target.value)}
                          className={`flex-1 ${field}`} />
                      </div>
                    </div>

                    {/* Logo */}
                    <div>
                      <label className="text-sm text-zinc-400">Brand logo</label>
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
                            className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-600 bg-zinc-950 py-4 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200">
                            {logoUploadStatus === "loading" ? "Reading…"
                              : logoUploadStatus === "done" ? <span className="text-emerald-400">Logo uploaded — click to change</span>
                              : logoUploadStatus === "error" ? <span className="text-red-400">Must be under 2 MB</span>
                              : "Upload logo (PNG, SVG — max 2 MB)"}
                          </button>
                        </div>
                      )}
                      {logoUrl ? (
                        <div className="mt-2 flex items-center gap-2">
                          {/* eslint-disable-next-line @next/next/no-img-element */}
                          <img src={logoUrl} alt="logo" className="h-8 w-auto max-w-[100px] rounded object-contain"
                            onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                          <button type="button" onClick={() => { setLogoUrl(""); setLogoUploadStatus("idle"); }}
                            className="text-xs text-zinc-600 hover:text-zinc-400">Remove</button>
                        </div>
                      ) : null}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* ════════════════════════════════════════════════════
              STEP 1 — PRODUCT / SERVICE
          ════════════════════════════════════════════════════ */}
          <div style={{ display: step === 1 ? undefined : "none" }}>
            <div className="space-y-4">

              {/* Select your product — brand-scoped catalog */}
              {hasProductCatalog && (
                <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                  <h2 className="text-lg font-semibold">Select your product</h2>
                  <p className="mt-1 text-sm text-zinc-400">Pick a product to generate creatives for, or add a new one.</p>
                  <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {brandProducts.map((p) => {
                      const sel = p.id === productSelectedId;
                      return (
                        <button key={p.id} type="button" onClick={() => selectProduct(p)}
                          className={`flex flex-col gap-3 rounded-2xl border p-4 text-left transition-all ${
                            sel ? "border-amber-400 bg-amber-950/25 ring-1 ring-amber-400"
                                : "border-zinc-700 bg-zinc-950/70 hover:border-zinc-600"}`}>
                          <div className="flex items-center gap-3">
                            {p.photoUrl ? (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={p.photoUrl} alt={p.name} className="h-10 w-10 shrink-0 rounded-lg object-cover"
                                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
                            ) : (
                              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-zinc-800 text-sm">📦</div>
                            )}
                            <span className="flex-1 truncate text-sm font-semibold text-zinc-100">{p.name}</span>
                          </div>
                          {sel && (
                            <div className="flex items-center gap-1 text-[11px] font-semibold text-amber-400">
                              <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" /></svg>
                              Selected
                            </div>
                          )}
                        </button>
                      );
                    })}
                  </div>
                  <button type="button" onClick={() => (showNewProduct ? setShowNewProduct(false) : startNewProduct())}
                    className="mt-4 text-xs text-zinc-500 hover:text-zinc-300 transition-colors">
                    {showNewProduct ? "Hide new product form" : "+ New product"}
                  </button>
                </div>
              )}

              {/* Product info — new / freeform */}
              {showProductForm && (
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                <h2 className="text-lg font-semibold">{hasProductCatalog ? "New product" : "What are you advertising?"}</h2>
                <p className="mt-1 text-sm text-zinc-400">Product, service, offer — describe what this creative is for.</p>

                {/* URL scan */}
                <div className="mt-5">
                  <label className="text-sm text-zinc-400">Auto-fill from your website</label>
                  <div className="mt-1.5 flex gap-2">
                    <input type="text" placeholder="yourstore.com" value={scanUrl}
                      onChange={(e) => setScanUrl(e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); handleScan(); } }}
                      className="min-w-0 flex-1 rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500" />
                    <button type="button" onClick={handleScan}
                      disabled={scanStatus === "loading" || !scanUrl.trim()}
                      className="flex shrink-0 items-center gap-1.5 rounded-xl border border-zinc-600 bg-zinc-800 px-4 py-2.5 text-sm font-medium text-zinc-200 hover:bg-zinc-700 disabled:opacity-50">
                      {scanStatus === "loading" ? (
                        <><svg className="h-3.5 w-3.5 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Scanning…</>
                      ) : "Scan website"}
                    </button>
                  </div>
                  {scanStatus === "done" && (
                    <p className="mt-1.5 flex items-center gap-1 text-xs text-emerald-400">
                      <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>
                      Fields auto-filled from your website
                    </p>
                  )}
                  {scanError && <p className="mt-1.5 text-xs text-red-400">{scanError}</p>}
                </div>

                <div className="mt-4 space-y-3">
                  <div>
                    <label className="text-sm text-zinc-400">Product / service name *</label>
                    <input placeholder="e.g. Argan Face Serum, Summer Collection, NooRattan Chair…"
                      className={`mt-1.5 ${field}`}
                      value={productName} onChange={(e) => setProductName(e.target.value)} />
                  </div>
                  <div>
                    <label className="text-sm text-zinc-400">Description</label>
                    <textarea rows={3} placeholder="Key features, benefits, or what makes it special…"
                      className={`mt-1.5 ${field}`}
                      value={productDescription} onChange={(e) => setProductDescription(e.target.value)} />
                  </div>
                </div>
              </div>
              )}

              {/* Photo / background */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                <h2 className="text-lg font-semibold">Visuals</h2>
                <p className="mt-1 text-sm text-zinc-400">How should your creative look?</p>

                <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
                  {([
                    { key: "ai",      icon: "✦", label: "AI Generate", desc: "AI creates the scene" },
                    { key: "compose", icon: "✨", label: "AI Compose",   desc: "Blend product + model" },
                    { key: "upload",  icon: "↑", label: "Upload Photo", desc: "Your product photo" },
                    { key: "stock",   icon: "🖼", label: "Stock Photo",  desc: "Free stock library" },
                  ] as const).map((src) => (
                    <button key={src.key} type="button" onClick={() => { setPhotoSource(src.key); if (src.key === "ai") setPhotoUrl(""); }}
                      className={`flex flex-col items-center gap-2 rounded-2xl border p-4 text-center transition-all ${
                        photoSource === src.key
                          ? "border-amber-400 bg-amber-950/30 ring-1 ring-amber-400"
                          : "border-zinc-700 bg-zinc-950/70 hover:border-zinc-600"}`}>
                      <span className="text-2xl">{src.icon}</span>
                      <div>
                        <p className="text-xs font-semibold text-zinc-200">{src.label}</p>
                        <p className="mt-0.5 text-[10px] text-zinc-500">{src.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>

                {/* Upload panel */}
                {photoSource === "upload" && (
                  <div className="mt-4">
                    <input ref={photoFileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
                    {photoUrl && !photoUploading ? (
                      <div className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-950 p-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoUrl} alt="product" className="h-14 w-14 rounded-lg object-cover" />
                        <div className="flex-1 min-w-0">
                          <p className="truncate text-xs text-zinc-400">{photoUrl.slice(0, 60)}…</p>
                        </div>
                        <button type="button" onClick={() => { setPhotoUrl(""); if (photoFileRef.current) photoFileRef.current.value = ""; }}
                          className="text-xs text-zinc-600 hover:text-zinc-400 shrink-0">Remove</button>
                      </div>
                    ) : (
                      <button type="button" onClick={() => photoFileRef.current?.click()} disabled={photoUploading}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-600 bg-zinc-950 py-5 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200 disabled:opacity-60">
                        {photoUploading ? (
                          <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"/><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"/></svg>Uploading…</>
                        ) : (
                          <><svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}><path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5"/></svg>Upload product photo (PNG, JPG — max 5 MB)</>
                        )}
                      </button>
                    )}
                    {photoUploadError && <p className="mt-2 text-xs text-red-400">{photoUploadError}</p>}
                  </div>
                )}

                {/* Stock photo panel */}
                {photoSource === "stock" && (
                  <div className="mt-4 rounded-xl border border-zinc-700 bg-zinc-950 p-4">
                    <StockPhotoPicker
                      selectedId={stockSelectedId}
                      defaultQuery={productName || "lifestyle product"}
                      onSelect={(photo: StockPhoto) => {
                        setPhotoUrl(photo.full);
                        setStockSelectedId(photo.id);
                      }}
                    />
                    {photoUrl && stockSelectedId && (
                      <div className="mt-3 flex items-center gap-2 border-t border-zinc-800 pt-3">
                        {/* eslint-disable-next-line @next/next/no-img-element */}
                        <img src={photoUrl} alt="selected" className="h-10 w-10 rounded-lg object-cover" />
                        <p className="flex-1 truncate text-xs text-emerald-400">Photo selected</p>
                        <button type="button" onClick={() => { setPhotoUrl(""); setStockSelectedId(undefined); }}
                          className="text-xs text-zinc-600 hover:text-zinc-400">Clear</button>
                      </div>
                    )}
                  </div>
                )}

                {/* AI Compose panel */}
                {photoSource === "compose" && (
                  <div className="mt-4 space-y-3">
                    {/* Shared hidden file input for all compose slots */}
                    <input
                      ref={composeFileInputRef}
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={handleCompositeFile}
                    />

                    {composeUploadError && (
                      <p className="rounded-lg bg-red-950/40 px-3 py-2 text-sm text-red-400">{composeUploadError}</p>
                    )}

                    {composeSlots.map((slot, i) => (
                      <div key={slot.id} className="flex items-center gap-3 rounded-xl border border-zinc-700 bg-zinc-950 p-3">
                        {/* Thumbnail / upload trigger */}
                        <button
                          type="button"
                          onClick={() => openCompositeUpload(slot.id)}
                          disabled={uploadingSlotId === slot.id}
                          className="relative h-14 w-14 shrink-0 overflow-hidden rounded-lg border border-zinc-700 bg-zinc-900 transition-colors hover:border-zinc-500 disabled:opacity-60">
                          {uploadingSlotId === slot.id ? (
                            <svg className="absolute inset-0 m-auto h-5 w-5 animate-spin text-zinc-500" viewBox="0 0 24 24" fill="none">
                              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                            </svg>
                          ) : slot.url ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={slot.url} alt={slot.label} className="h-full w-full object-cover" />
                          ) : (
                            <svg className="absolute inset-0 m-auto h-6 w-6 text-zinc-600" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                            </svg>
                          )}
                        </button>

                        {/* Label + status */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-zinc-200">{slot.label}</p>
                          <p className="mt-0.5 text-xs text-zinc-500">
                            {slot.url ? (
                              <button type="button" onClick={() => openCompositeUpload(slot.id)} className="text-zinc-500 hover:text-zinc-300 transition-colors">
                                Replace photo
                              </button>
                            ) : (
                              <button type="button" onClick={() => openCompositeUpload(slot.id)} className="text-amber-400/80 hover:text-amber-400 transition-colors">
                                {i === 0 ? "Upload product photo" : "Upload (optional)"}
                              </button>
                            )}
                          </p>
                        </div>

                        {/* Remove (not for the first slot) */}
                        {i > 0 && (
                          <button type="button" onClick={() => removeCompositeSlot(slot.id)}
                            className="shrink-0 rounded-lg p-1.5 text-zinc-600 transition-colors hover:bg-zinc-800 hover:text-zinc-300">
                            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                            </svg>
                          </button>
                        )}
                      </div>
                    ))}

                    {composeSlots.length < 4 && (
                      <button type="button" onClick={addCompositeSlot}
                        className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-700 py-2.5 text-sm text-zinc-500 transition-colors hover:border-zinc-500 hover:text-zinc-300">
                        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                        </svg>
                        Add another image
                      </button>
                    )}

                    {/* Scene description */}
                    <div className="pt-1">
                      <div className="flex items-center justify-between gap-3">
                        <label className="text-sm text-zinc-400">Scene description <span className="text-zinc-600">(optional)</span></label>
                        <button type="button" onClick={handleWriteScenePrompt}
                          disabled={sceneWriting || composeSlots.every((s) => !s.url)}
                          className="flex shrink-0 items-center gap-1.5 rounded-lg border border-zinc-600 bg-zinc-800 px-3 py-1.5 text-xs font-semibold text-zinc-200 transition-colors hover:bg-zinc-700 disabled:opacity-50">
                          {sceneWriting ? (
                            <><svg className="h-3 w-3 animate-spin" viewBox="0 0 24 24" fill="none"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>Writing…</>
                          ) : (
                            <><svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}><path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" /></svg>AI from images</>
                          )}
                        </button>
                      </div>
                      <textarea
                        rows={2}
                        placeholder="Model holding the product in a sunlit studio, editorial lifestyle photography, soft shadows…"
                        className={`mt-1.5 ${field}`}
                        value={scenePrompt}
                        onChange={(e) => setScenePrompt(e.target.value)}
                      />
                      {sceneWriteError && <p className="mt-1.5 text-xs text-red-400">{sceneWriteError}</p>}
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════
              STEP 2 — BRIEF
          ════════════════════════════════════════════════════ */}
          <div style={{ display: step === 2 ? undefined : "none" }}>
            <div className="space-y-4">

              {/* Copy mode */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                <h2 className="text-lg font-semibold">Ad copy</h2>
                <p className="mt-1 text-sm text-zinc-400">Let AI craft conversion-focused copy, or write it yourself.</p>

                <div className="mt-5 flex gap-1 rounded-xl border border-zinc-700 bg-zinc-950 p-1">
                  {([["ai", "AI writes it", "Recommended"], ["manual", "I'll write it", ""]] as const).map(([mode, label, badge]) => (
                    <button key={mode} type="button" onClick={() => setTextMode(mode)}
                      className={`relative flex flex-1 items-center justify-center gap-2 rounded-lg py-2.5 text-sm font-medium transition-colors ${
                        textMode === mode ? "bg-zinc-700 text-zinc-100" : "text-zinc-500 hover:text-zinc-300"}`}>
                      {label}
                      {badge && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">{badge}</span>}
                    </button>
                  ))}
                </div>

                {textMode === "ai" ? (
                  <div className="mt-5 space-y-4">
                    <div>
                      <label className="text-sm text-zinc-400">Creative goal *</label>
                      <input placeholder="Drive sales for the summer collection, grow brand awareness…"
                        className={`mt-1.5 ${field}`}
                        value={goal} onChange={(e) => setGoal(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm text-zinc-400">Target audience</label>
                      <input placeholder="Women 25–45 in Morocco, interested in home decor…"
                        className={`mt-1.5 ${field}`}
                        value={audience} onChange={(e) => setAudience(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm text-zinc-400">Call to action</label>
                      <input placeholder="Shop Now, Learn More, Get Started…"
                        className={`mt-1.5 ${field}`}
                        value={callToAction} onChange={(e) => setCallToAction(e.target.value)} />
                    </div>
                  </div>
                ) : (
                  <div className="mt-5 space-y-4">
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-400">Main headline *</label>
                        <CharCounter value={headline} max={40} />
                      </div>
                      <input maxLength={40} placeholder="Your main headline here!"
                        className={`mt-1.5 ${field}`}
                        value={headline} onChange={(e) => setHeadline(e.target.value)} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-400">Punchline / body</label>
                        <CharCounter value={body} max={90} />
                      </div>
                      <input maxLength={90} placeholder="Your punchline is here!"
                        className={`mt-1.5 ${field}`}
                        value={body} onChange={(e) => setBody(e.target.value)} />
                    </div>
                    <div>
                      <div className="flex items-center justify-between">
                        <label className="text-sm text-zinc-400">Call to action</label>
                        <CharCounter value={callToAction} max={25} />
                      </div>
                      <input maxLength={25} placeholder="Shop Now"
                        className={`mt-1.5 ${field}`}
                        value={callToAction} onChange={(e) => setCallToAction(e.target.value)} />
                    </div>
                    <div>
                      <label className="text-sm text-zinc-400">Target audience</label>
                      <input placeholder="Women 25–45 in Morocco…"
                        className={`mt-1.5 ${field}`}
                        value={audience} onChange={(e) => setAudience(e.target.value)} />
                    </div>
                  </div>
                )}
              </div>

              {/* Template */}
              <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
                <h2 className="text-lg font-semibold">Ad template</h2>
                <p className="mt-1 text-sm text-zinc-400">Controls how the text and image are laid out.</p>
                <div className="mt-5 grid grid-cols-2 gap-3">
                  {TEMPLATES.map((t) => (
                    <button key={t.id} type="button" onClick={() => setTemplate(t.id)}
                      className={`flex flex-col items-stretch gap-2 rounded-2xl border p-3 text-left transition-all ${
                        template === t.id ? "border-amber-400 bg-amber-950/30 ring-1 ring-amber-400" : "border-zinc-700 bg-zinc-950/70 hover:border-zinc-600"}`}>
                      <div className="aspect-[3/2] w-full overflow-hidden rounded-lg">
                        <TemplateMini id={t.id} color={brandColor} />
                      </div>
                      <div>
                        <p className="text-sm font-semibold text-zinc-200">{t.label}</p>
                        <p className="mt-0.5 text-xs text-zinc-500">{t.desc}</p>
                      </div>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* ════════════════════════════════════════════════════
              STEP 3 — GENERATE
          ════════════════════════════════════════════════════ */}
          <div style={{ display: step === 3 ? undefined : "none" }}>
            <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-6">
              <h2 className="text-lg font-semibold">Ready to generate</h2>
              <p className="mt-1 text-sm text-zinc-400">Review your inputs, then launch.</p>

              <div className="mt-5 space-y-5">
                {/* Summary */}
                <div className="rounded-xl border border-zinc-800 bg-zinc-900 p-4 text-sm">
                  <p className="mb-3 font-medium text-zinc-300">Summary</p>
                  <dl className="space-y-1.5 text-zinc-500">
                    {brandSelectedId && (
                      <div className="flex gap-2"><dt className="w-28 shrink-0">Brand</dt>
                        <dd className="text-zinc-300">{savedBrands.find(b => b.id === brandSelectedId)?.name ?? "—"}</dd></div>
                    )}
                    <div className="flex gap-2"><dt className="w-28 shrink-0">Product</dt><dd className="text-zinc-300 truncate">{productName || "—"}</dd></div>
                    <div className="flex gap-2"><dt className="w-28 shrink-0">Visuals</dt><dd className="text-zinc-300">
                      {photoSource === "ai"
                        ? `AI-generated (${imageModel})`
                        : photoSource === "compose"
                        ? `AI Compose — ${composeSlots.filter((s) => s.url).length} image${composeSlots.filter((s) => s.url).length !== 1 ? "s" : ""}`
                        : photoSource === "stock"
                        ? "Stock photo (FLUX Redux)"
                        : "Uploaded photo (FLUX Redux)"}
                    </dd></div>
                    <div className="flex gap-2"><dt className="w-28 shrink-0">Copy mode</dt><dd className="text-zinc-300">{textMode === "ai" ? "AI-generated (2–4 variants)" : "Manual (1 creative)"}</dd></div>
                    {textMode === "manual" && headline && (
                      <div className="flex gap-2"><dt className="w-28 shrink-0">Headline</dt><dd className="text-zinc-300 truncate">{headline}</dd></div>
                    )}
                    <div className="flex gap-2"><dt className="w-28 shrink-0">Template</dt><dd className="text-zinc-300 capitalize">{template}</dd></div>
                    <div className="flex gap-2"><dt className="w-28 shrink-0">Sizes</dt><dd className="text-zinc-300">4:5 · 1:1 · 9:16 · Link</dd></div>
                  </dl>
                </div>

                {/* Project name + campaign */}
                <div>
                  <label className="text-sm text-zinc-400">Project name <span className="text-zinc-600">(optional)</span></label>
                  <input name="projectName" placeholder="Summer 2025 Campaign"
                    className={`mt-1.5 ${field}`}
                    value={projectName} onChange={(e) => setProjectName(e.target.value)} />
                </div>

                {campaigns.length > 0 && (
                  <div>
                    <label className="text-sm text-zinc-400">Assign to campaign <span className="text-zinc-600">(optional)</span></label>
                    <select name="campaignId" defaultValue={prefillCampaignId ?? ""} className={`mt-1.5 ${field}`}>
                      <option value="">None — save as standalone</option>
                      {campaigns.map((camp) => (
                        <option key={camp.id} value={camp.id}>{camp.name}</option>
                      ))}
                    </select>
                  </div>
                )}

                {/* Image model */}
                <div>
                  <label className="text-sm text-zinc-400">Image generation model</label>
                  <div className="mt-2 grid grid-cols-2 gap-3">
                    {([
                      { id: "nano-banana-2", label: "Nano Banana 2", desc: "High quality · AI reasoning", badge: "Recommended" },
                      { id: "flux-schnell",  label: "FLUX Schnell",  desc: "Faster · Lower cost",        badge: "" },
                    ] as const).map((m) => (
                      <button key={m.id} type="button" onClick={() => setImageModel(m.id)}
                        className={`flex flex-col gap-1 rounded-xl border p-3 text-left transition-all ${
                          imageModel === m.id ? "border-amber-400 bg-amber-950/30 ring-1 ring-amber-400" : "border-zinc-700 bg-zinc-950/70 hover:border-zinc-600"}`}>
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-semibold text-zinc-200">{m.label}</span>
                          {m.badge && <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-semibold text-amber-400">{m.badge}</span>}
                        </div>
                        <p className="text-xs text-zinc-500">{m.desc}</p>
                      </button>
                    ))}
                  </div>
                  {photoSource !== "ai" && photoUrl && (
                    <p className="mt-2 text-xs text-zinc-600">When a product photo is set, FLUX Redux is used for image-to-image variation regardless of this choice.</p>
                  )}
                </div>

                {error && (
                  <p className="rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">{error}</p>
                )}

                <GenerateButton />
              </div>
            </div>
          </div>

          {/* Step error */}
          {stepError && (
            <p className="mt-3 rounded-xl border border-amber-400/20 bg-amber-950/30 px-4 py-3 text-sm text-amber-300">{stepError}</p>
          )}

          {/* Nav buttons */}
          <div className="mt-5 flex items-center gap-3">
            {step > 0 && (
              <button type="button" onClick={handleBack}
                className="rounded-xl border border-zinc-700 px-5 py-3 text-sm text-zinc-300 transition-colors hover:border-zinc-500 hover:text-zinc-100">
                ← Back
              </button>
            )}
            {step < STEP_LABELS.length - 1 && (
              <button type="button" onClick={handleNext}
                className="rounded-xl bg-zinc-800 px-6 py-3 text-sm font-semibold text-zinc-100 transition-colors hover:bg-zinc-700">
                Next step →
              </button>
            )}
          </div>
        </form>

        {/* ── LIVE PREVIEW ──────────────────────────────────────────────── */}
        <LivePreview
          brandColor={brandColor}
          accentColor={accentColor}
          logoUrl={logoUrl}
          photoUrl={photoSource !== "ai" && photoSource !== "compose" ? photoUrl : photoSource === "compose" ? (composeSlots.find((s) => s.url)?.url ?? "") : ""}
          headline={textMode === "manual" ? headline : ""}
          body={textMode === "manual" ? body : ""}
          cta={callToAction}
          productName={productName}
        />
      </div>
    </div>
  );
}
