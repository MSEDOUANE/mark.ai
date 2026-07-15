/**
 * Style presets for Product Photo Ads — one-click "professional shoot" from a
 * single uploaded product photo. Each style is a fixed, tuned prompt for
 * nano-banana-2/edit (the same multi-image compositor AI Compose uses):
 * given ONE reference image, it preserves the product's exact look while
 * placing it in a new professional scene.
 *
 * "fashion" category styles put the item on an AI human model instead of a
 * still-life scene — same model, same route, just a different prompt intent.
 */
export interface PhotoshootStyle {
  id: string;
  label: string;
  icon: string;
  description: string;
  prompt: string;
  category: "product" | "fashion";
}

export const PHOTOSHOOT_STYLES: PhotoshootStyle[] = [
  {
    id: "white-bg",
    label: "Clean White Background",
    icon: "⬜",
    description: "E-commerce-ready studio shot",
    category: "product",
    prompt:
      "Professional e-commerce product photography: place this exact product on a seamless " +
      "pure white background, studio softbox lighting from the front-left, soft realistic " +
      "shadow beneath the product, sharp focus, high detail, centered composition. Preserve " +
      "the product's exact shape, color, material, and branding — do not alter the product itself.",
  },
  {
    id: "lifestyle",
    label: "Lifestyle Scene",
    icon: "🏡",
    description: "In natural use, real setting",
    category: "product",
    prompt:
      "Editorial lifestyle product photography: place this exact product naturally within a " +
      "warm, realistic everyday setting fitting its category (home, desk, outdoor, or in-use), " +
      "soft natural window light, shallow depth of field, authentic and aspirational mood. " +
      "Preserve the product's exact appearance — do not alter the product itself.",
  },
  {
    id: "editorial",
    label: "Editorial Surface",
    icon: "🎨",
    description: "Marble, textured, premium",
    category: "product",
    prompt:
      "High-end editorial product photography: place this exact product on an elegant surface " +
      "(marble, textured stone, or premium fabric), dramatic side lighting, rich shadows, " +
      "minimal styling props, magazine-quality composition. Preserve the product's exact " +
      "appearance — do not alter the product itself.",
  },
  {
    id: "outdoor",
    label: "Outdoor Natural Light",
    icon: "☀️",
    description: "Golden hour, organic backdrop",
    category: "product",
    prompt:
      "Outdoor product photography: place this exact product in natural daylight or golden-hour " +
      "sunlight against an organic outdoor backdrop (greenery, wood, sand, or sky) fitting the " +
      "product category, soft realistic shadows, vibrant but natural color grading. Preserve the " +
      "product's exact appearance — do not alter the product itself.",
  },
  {
    id: "dark-luxury",
    label: "Dark Luxury",
    icon: "🖤",
    description: "Moody, premium, high-contrast",
    category: "product",
    prompt:
      "Luxury product photography: place this exact product against a dark, moody background " +
      "(black, deep charcoal, or dark velvet), dramatic rim lighting, high contrast, glossy " +
      "reflective surface beneath the product, premium and exclusive mood. Preserve the " +
      "product's exact appearance — do not alter the product itself.",
  },
  {
    id: "flatlay",
    label: "Flat Lay",
    icon: "📐",
    description: "Top-down, styled arrangement",
    category: "product",
    prompt:
      "Top-down flat lay product photography: shoot this exact product from directly above on a " +
      "clean styled surface with tasteful complementary props arranged around it, even soft " +
      "lighting, no harsh shadows, Instagram-ready composition. Preserve the product's exact " +
      "appearance — do not alter the product itself.",
  },
  {
    id: "fashion-studio",
    label: "On-Model Studio",
    icon: "🧍",
    description: "Worn by a model, clean backdrop",
    category: "fashion",
    prompt:
      "Professional fashion e-commerce photography: show this exact garment or accessory being " +
      "worn by a realistic human model against a seamless neutral studio backdrop, even softbox " +
      "lighting, confident natural pose, sharp focus on the product's fabric and fit. Preserve " +
      "the product's exact color, pattern, material, and design — do not alter the product itself.",
  },
  {
    id: "fashion-street",
    label: "Street Style",
    icon: "🚶",
    description: "Urban, editorial, on-model",
    category: "fashion",
    prompt:
      "Editorial street-style fashion photography: show this exact garment or accessory worn by " +
      "a model walking or posing in an urban outdoor setting, natural daylight, candid confident " +
      "energy, shallow depth of field with a softly blurred city backdrop. Preserve the product's " +
      "exact color, pattern, material, and design — do not alter the product itself.",
  },
  {
    id: "fashion-runway",
    label: "Runway Editorial",
    icon: "💃",
    description: "High-fashion, dramatic lighting",
    category: "fashion",
    prompt:
      "High-fashion runway-style photography: show this exact garment or accessory worn by a " +
      "model in a dramatic editorial pose, moody directional lighting, dark or minimal backdrop, " +
      "magazine cover quality. Preserve the product's exact color, pattern, material, and design " +
      "— do not alter the product itself.",
  },
  {
    id: "fashion-lifestyle",
    label: "Lifestyle Wear",
    icon: "🌿",
    description: "Everyday, natural, relatable",
    category: "fashion",
    prompt:
      "Natural lifestyle fashion photography: show this exact garment or accessory worn by a " +
      "model in an everyday relatable setting (cafe, park, home), soft natural light, warm " +
      "authentic mood, candid unposed feel. Preserve the product's exact color, pattern, " +
      "material, and design — do not alter the product itself.",
  },
];
