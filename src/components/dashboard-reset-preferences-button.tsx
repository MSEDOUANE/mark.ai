"use client";

type DashboardResetPreferencesButtonProps = {
  href: string;
  className?: string;
};

export function DashboardResetPreferencesButton({
  href,
  className,
}: DashboardResetPreferencesButtonProps) {
  return (
    <button
      type="button"
      className={className}
      onClick={() => {
        const shouldReset = window.confirm(
          "Reset dashboard preferences to defaults? This will clear your saved filters, sort, density, and focus.",
        );
        if (!shouldReset) return;
        window.location.assign(href);
      }}
    >
      Reset
    </button>
  );
}