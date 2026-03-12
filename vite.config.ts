import path from "node:path";
import { defineConfig } from "vite";
import { devvit } from "@devvit/start/vite";

function resolveWorktreeLabel(cwd = process.cwd()): string {
  const normalizedSegments = cwd.split(path.sep).filter(Boolean);
  const worktreesIndex = normalizedSegments.lastIndexOf("worktrees");
  if (worktreesIndex >= 0 && worktreesIndex + 1 < normalizedSegments.length) {
    return normalizedSegments[worktreesIndex + 1] ?? "";
  }
  return "";
}

export default defineConfig({
  plugins: [devvit()],
  define: {
    __VOUCHX_WORKTREE_LABEL__: JSON.stringify(resolveWorktreeLabel()),
  },
});
