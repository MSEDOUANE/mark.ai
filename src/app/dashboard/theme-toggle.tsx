"use client";

import { useEffect } from "react";

const STORAGE_KEY = "markai-theme";

/**
 * Light/dark toggle for the dashboard shell. Deliberately has NO React state
 * for its own icon/label — both variants are always in the DOM (see
 * .theme-toggle-dark-only / .theme-toggle-light-only in globals.css) and
 * only CSS visibility flips off the data-theme attribute already applied by
 * the anti-FOUC inline script in dashboard/layout.tsx. This sidesteps both a
 * hydration mismatch (server can't know localStorage) and the
 * react-hooks/set-state-in-effect lint error a state-mirroring effect would
 * trigger (the same class of bug fixed twice already this session).
 *
 * Scoped to /dashboard only: the public marketing pages never opt into
 * app-* tokens, so the effect's cleanup strips data-theme back off <html>
 * when this component unmounts (leaving /dashboard entirely), rather than
 * letting a "light" choice bleed onto pages that don't theme with it.
 */
export function ThemeToggle() {
  useEffect(() => {
    return () => {
      document.documentElement.removeAttribute("data-theme");
    };
  }, []);

  function toggle() {
    const isLight = document.documentElement.getAttribute("data-theme") === "light";
    const next = isLight ? "dark" : "light";
    if (next === "light") {
      document.documentElement.setAttribute("data-theme", "light");
    } else {
      document.documentElement.removeAttribute("data-theme");
    }
    localStorage.setItem(STORAGE_KEY, next);
  }

  return (
    <button
      type="button"
      onClick={toggle}
      className="flex w-full items-center gap-2 rounded-lg border border-app-border px-2.5 py-1.5 text-xs text-app-text-muted transition-colors hover:border-app-border-strong hover:text-app-text"
    >
      {/* Sun — shown while dark is active; clicking switches to light. */}
      <svg className="theme-toggle-dark-only h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
      </svg>
      {/* Moon — shown while light is active; clicking switches to dark. */}
      <svg className="theme-toggle-light-only h-3.5 w-3.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
      </svg>
      <span className="theme-toggle-dark-only">Light mode</span>
      <span className="theme-toggle-light-only">Dark mode</span>
    </button>
  );
}
