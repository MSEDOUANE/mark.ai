/**
 * Style presets for Product Photo Ads — one-click "professional shoot" from a
 * single uploaded product photo. Each style is a fixed, tuned prompt for
 * nano-banana-2/edit (the same multi-image compositor AI Compose uses):
 * given ONE reference image, it preserves the product's exact look while
 * placing it in a new professional scene.
 */
export interface PhotoshootStyle {
  id: string;
  label: string;
  icon: string;
  description: string;
  prompt: string;
}

export const PHOTOSHOOT_STYLES: PhotoshootStyle[] = [
  {
    id: "white-bg",
    label: "Clean White Background",
    icon: "⬜",
    description: "E-commerce-ready studio shot",
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
    prompt:
      "Top-down flat lay product photography: shoot this exact product from directly above on a " +
      "clean styled surface with tasteful complementary props arranged around it, even soft " +
      "lighting, no harsh shadows, Instagram-ready composition. Preserve the product's exact " +
      "appearance — do not alter the product itself.",
  },
];
