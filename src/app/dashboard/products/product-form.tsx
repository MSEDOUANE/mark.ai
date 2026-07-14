"use client";

import { useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { saveProduct } from "./actions";

interface ProductFormProps {
  product?: {
    id: string;
    name: string;
    brandProfileId: string | null;
    description: string | null;
    targetAudience: string | null;
    photoUrl: string | null;
  };
  brands: { id: string; name: string }[];
  error?: string;
}

function SaveButton({ isEdit }: { isEdit: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending}
      className="flex items-center gap-2 rounded-xl bg-amber-400 px-6 py-3 font-semibold text-zinc-950 shadow shadow-amber-500/20 transition-colors hover:bg-amber-300 disabled:opacity-70">
      {pending ? (
        <><svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>Saving…</>
      ) : isEdit ? "Save changes" : "Create product"}
    </button>
  );
}

export function ProductForm({ product, brands, error }: ProductFormProps) {
  const isEdit = !!product;
  const photoFileRef = useRef<HTMLInputElement>(null);

  const [name, setName] = useState(product?.name ?? "");
  const [brandProfileId, setBrandProfileId] = useState(product?.brandProfileId ?? "");
  const [description, setDescription] = useState(product?.description ?? "");
  const [targetAudience, setTargetAudience] = useState(product?.targetAudience ?? "");
  const [photoUrl, setPhotoUrl] = useState(product?.photoUrl ?? "");
  const [uploadStatus, setUploadStatus] = useState<"idle" | "loading" | "done" | "error">("idle");

  const field = "w-full rounded-xl border border-zinc-700 bg-zinc-950 px-4 py-3 text-sm text-zinc-100 outline-none placeholder:text-zinc-600 focus:border-zinc-500";

  async function handlePhotoFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 5 * 1024 * 1024) { setUploadStatus("error"); return; }
    setUploadStatus("loading");
    try {
      const fd = new FormData();
      fd.set("file", file);
      const res = await fetch("/api/upload-asset", { method: "POST", body: fd });
      if (!res.ok) throw new Error("Upload failed");
      const { url } = (await res.json()) as { url: string };
      setPhotoUrl(url);
      setUploadStatus("done");
    } catch {
      setUploadStatus("error");
    }
  }

  return (
    <form action={saveProduct} className="space-y-5">
      {isEdit ? <input type="hidden" name="id" value={product!.id} /> : null}
      <input type="hidden" name="photoUrl" value={photoUrl} />

      {error ? (
        <div className="rounded-xl border border-red-400/20 bg-red-950/35 px-4 py-3 text-sm text-red-200">{error}</div>
      ) : null}

      <div className="rounded-2xl border border-zinc-800 bg-zinc-900/60 p-5 space-y-4">
        <div>
          <label className="text-sm text-zinc-400">Product name *</label>
          <input name="name" placeholder="Argan Face Serum, NooRattan Chair…" className={`mt-1.5 ${field}`}
            value={name} onChange={(e) => setName(e.target.value)} />
        </div>

        <div>
          <label className="text-sm text-zinc-400">Brand <span className="text-zinc-600">(optional — reuses that brand&apos;s voice &amp; colors)</span></label>
          <select name="brandProfileId" className={`mt-1.5 ${field}`}
            value={brandProfileId} onChange={(e) => setBrandProfileId(e.target.value)}>
            <option value="">No brand</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{b.name}</option>
            ))}
          </select>
        </div>

        <div>
          <label className="text-sm text-zinc-400">Description</label>
          <textarea name="description" rows={3} placeholder="Key features, benefits, what makes it special…"
            className={`mt-1.5 ${field}`}
            value={description} onChange={(e) => setDescription(e.target.value)} />
        </div>

        <div>
          <label className="text-sm text-zinc-400">Target audience</label>
          <input name="targetAudience" placeholder="Women 25-45 in Morocco interested in home decor"
            className={`mt-1.5 ${field}`}
            value={targetAudience} onChange={(e) => setTargetAudience(e.target.value)} />
        </div>

        <div>
          <label className="text-sm text-zinc-400">Product photo</label>
          <div className="mt-1.5">
            <input ref={photoFileRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoFile} />
            <button type="button" onClick={() => photoFileRef.current?.click()}
              className="flex w-full items-center justify-center gap-2 rounded-xl border border-dashed border-zinc-600 bg-zinc-950 py-4 text-sm text-zinc-400 transition-colors hover:border-zinc-500 hover:text-zinc-200">
              {uploadStatus === "loading" ? "Uploading…"
                : uploadStatus === "error" ? <span className="text-red-400">Upload failed — try again (max 5 MB)</span>
                : photoUrl ? <span className="text-emerald-400">Photo set — click to change</span>
                : "Upload a product photo (max 5 MB)"}
            </button>
          </div>
          {photoUrl ? (
            <div className="mt-2 flex items-center gap-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={photoUrl} alt="product" className="h-14 w-14 rounded-lg object-cover"
                onError={(e) => { (e.currentTarget as HTMLImageElement).style.display = "none"; }} />
              <button type="button" onClick={() => { setPhotoUrl(""); setUploadStatus("idle"); }}
                className="text-xs text-zinc-600 hover:text-zinc-400">Remove</button>
            </div>
          ) : null}
        </div>
      </div>

      <div className="flex items-center gap-3">
        <SaveButton isEdit={isEdit} />
        <a href="/dashboard/products" className="rounded-xl border border-zinc-700 px-5 py-3 text-sm text-zinc-400 hover:text-zinc-200">
          Cancel
        </a>
      </div>
    </form>
  );
}
