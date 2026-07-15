/**
 * Shared language + Arabic-dialect support for every text-generation tool
 * (ad copy, captions, personas, audience insights, landing pages, etc).
 * Primary market is Morocco — Arabic is the default language and Moroccan
 * Darija the default dialect throughout.
 *
 * Kept separate from image-models/fal-audio-video.ts's VOICE_LANGUAGES:
 * that list is constrained to what the TTS models actually support: text
 * generation has no such constraint.
 */

export const LANGUAGES: Array<{ id: string; label: string }> = [
  { id: "ar", label: "العربية (Arabic)" },
  { id: "en", label: "English" },
  { id: "fr", label: "Français" },
];

const LANGUAGE_LABEL: Record<string, string> = {
  ar: "Arabic",
  en: "English",
  fr: "French",
};

/**
 * Arabic dialects — the difference that makes or breaks an Arabic ad. Each
 * carries authentic vocabulary guidance so the AI writes how that audience
 * actually speaks (not generic Fusha). Moroccan Darija is the default,
 * given the primary market.
 */
export const ARABIC_DIALECTS: Array<{
  id: string;
  label: string;
  hint: string;
}> = [
  {
    id: "darija",
    label: "🇲🇦 Moroccan Darija",
    hint:
      "Moroccan Darija (الدارجة المغربية) — the everyday spoken Moroccan dialect, NOT " +
      "Modern Standard Arabic. Use authentic Moroccan words and expressions such as " +
      "بزاف (a lot), دابا (now), واخا (okay), مزيان (good/nice), دروك (right now), " +
      "شحال (how much), ديال (of), خاصك (you need). Warm, casual, exactly how Moroccans " +
      "talk to each other. Write in Arabic script.",
  },
  {
    id: "msa",
    label: "Standard Arabic (فصحى)",
    hint:
      "Modern Standard Arabic (الفصحى) — formal, pan-Arab, polished. Suits premium/" +
      "corporate tone and audiences across all Arab countries.",
  },
  {
    id: "egyptian",
    label: "🇪🇬 Egyptian",
    hint:
      "Egyptian Arabic (المصرية) — the most widely understood dialect across the Arab " +
      "world thanks to media. Use Egyptian vocabulary (e.g. أوي، دلوقتي، عايز، كده).",
  },
  {
    id: "gulf",
    label: "🇸🇦 Gulf / Khaleeji",
    hint:
      "Gulf/Khaleeji Arabic (الخليجية) — for Saudi/UAE/Gulf audiences. Use Gulf " +
      "vocabulary (e.g. وايد، الحين، أبغى، زين).",
  },
  {
    id: "levantine",
    label: "🇱🇧 Levantine",
    hint:
      "Levantine Arabic (الشامية) — Syria/Lebanon/Jordan/Palestine. Use Levantine " +
      "vocabulary (e.g. كتير، هلق، بدي، منيح).",
  },
];

export function arabicDialectHint(dialect?: string | null): string {
  const d = ARABIC_DIALECTS.find((x) => x.id === dialect) ?? ARABIC_DIALECTS[0];
  return d.hint;
}

/**
 * One prompt line telling the model exactly what language/dialect to write
 * in — append this to any generateObject/generateText prompt. Every
 * text-generation tool in the app should call this instead of assuming
 * English.
 */
export function languageDirective(language?: string | null, dialect?: string | null): string {
  const lang = language || "ar";
  if (lang === "ar") {
    return `Write in ${arabicDialectHint(dialect)} Write ALL text natively in this exact dialect — an audience will immediately reject the wrong dialect or a stiff translation.`;
  }
  return `Write in ${LANGUAGE_LABEL[lang] ?? "Arabic"} (write natively, not as a translation).`;
}
