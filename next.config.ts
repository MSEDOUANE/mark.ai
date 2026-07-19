import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Pin the workspace root to THIS checkout. Without it, Turbopack root
  // detection sees two lockfiles (main checkout + a nested .claude/worktrees/
  // checkout, each with its own package-lock.json) and picks the main
  // checkout — wrong whenever the dev server runs inside a worktree.
  turbopack: {
    root: __dirname,
  },
};

export default nextConfig;
