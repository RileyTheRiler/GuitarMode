#!/usr/bin/env node
/**
 * Copy Basic Pitch's model files out of node_modules into public/ so they're
 * served as static assets. Runs as a prebuild step so Vercel picks it up
 * during deploy; idempotent so re-runs are cheap.
 */
import { mkdir, copyFile, readdir, stat } from "node:fs/promises";
import { dirname, join, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "..");
const SRC = join(ROOT, "node_modules", "@spotify", "basic-pitch", "model");
const DEST = join(ROOT, "public", "models", "basic-pitch");

async function exists(path) {
  try {
    await stat(path);
    return true;
  } catch {
    return false;
  }
}

async function copyRecursive(src, dest) {
  await mkdir(dest, { recursive: true });
  const entries = await readdir(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = join(src, entry.name);
    const destPath = join(dest, entry.name);
    if (entry.isDirectory()) {
      await copyRecursive(srcPath, destPath);
    } else {
      await copyFile(srcPath, destPath);
    }
  }
}

async function main() {
  if (!(await exists(SRC))) {
    // The dep is missing — skip rather than failing the build. Lazy import in
    // the app would throw at the call site with a clearer message.
    console.warn(
      `[copy-basic-pitch-model] ${SRC} not found; skipping. ` +
        `Run "npm install" if you intend to use Basic Pitch.`
    );
    return;
  }
  await copyRecursive(SRC, DEST);
  console.log(`[copy-basic-pitch-model] copied model files → ${DEST}`);
}

main().catch((err) => {
  console.error("[copy-basic-pitch-model] failed:", err);
  process.exit(1);
});
