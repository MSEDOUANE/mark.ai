"use client";

import { useState } from "react";
import { AdCopyGenerator } from "./ad-copy-generator";
import { ProductDescriptionGenerator } from "./product-description-generator";
import { MarketingCopyGenerator } from "./marketing-copy-generator";
import type { BrandContextOption } from "@/components/brand-context-picker";

type ContentType = "ad" | "description" | "marketing";

const TABS: { id: ContentType; label: string; icon: string }[] = [
  { id: "ad", label: "Ad Copy", icon: "✍️" },
  { id: "description", label: "Product Descriptions", icon: "📄" },
  { id: "marketing", label: "Marketing Copy", icon: "📣" },
];

export function ContentGenerator({ brands = [] }: { brands?: BrandContextOption[] }) {
  const [type, setType] = useState<ContentType>("ad");

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap gap-2">
        {TABS.map((t) => (
          <button key={t.id} type="button" onClick={() => setType(t.id)}
            className={`flex items-center gap-2 rounded-xl border px-4 py-2.5 text-sm font-medium transition-colors ${
              type === t.id
                ? "border-amber-400 bg-amber-400/10 text-amber-300"
                : "border-app-border-strong text-app-text-muted hover:border-zinc-500 hover:text-app-text"
            }`}>
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {type === "ad" && <AdCopyGenerator brands={brands} />}
      {type === "description" && <ProductDescriptionGenerator brands={brands} />}
      {type === "marketing" && <MarketingCopyGenerator brands={brands} />}
    </div>
  );
}
