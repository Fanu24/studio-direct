import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { PHASE_DEVELOPMENT_SERVER } from "next/constants";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = dirname(fileURLToPath(import.meta.url));
process.env.XDG_CONFIG_HOME ||= join(appDirectory, '../../.wrangler/config');
process.env.WRANGLER_LOG_PATH ||= join(appDirectory, '../../.wrangler/logs');

const nextConfig: NextConfig = {
  distDir: process.env.NEXT_BUILD_DIR || ".next",
  outputFileTracingRoot: join(appDirectory, "../.."),
  /**
   * The Workers runtime cannot execute native `.node` binaries, and Next's image
   * optimizer pulls in `sharp`, which is exactly that - so `opennextjs-cloudflare build`
   * fails at the bundling step with:
   *
   *   No loader is configured for ".node" files: .../sharp-win32-x64-0.35.4.node
   *
   * This app imports `next/image` in zero files, so the optimizer is dead weight here
   * and turning it off costs nothing. If `next/image` is ever adopted, this cannot
   * simply be flipped back: image optimization would need Cloudflare Images or a
   * custom loader instead.
   */
  images: {
    unoptimized: true,
  },
  experimental: {
    // Keep build worker memory bounded on developer machines and CI.
    cpus: 1,
  },
};

export default async function config(phase: string) {
  // Only the dev server needs a local binding proxy. Production requests receive
  // their bindings from the Worker; build-time pages do not query D1.
  if (phase === PHASE_DEVELOPMENT_SERVER) {
    // getPlatformProxy takes the versioned directory; Wrangler CLI adds v3 itself.
    await initOpenNextCloudflareForDev({persist: {path: join(appDirectory, "../../.wrangler/state/v3")}});
  }
  return nextConfig;
}
