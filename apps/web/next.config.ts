import { initOpenNextCloudflareForDev } from "@opennextjs/cloudflare";
import type { NextConfig } from "next";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const appDirectory = dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
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
    /**
     * Static generation must run in a single worker, or the build fails.
     *
     * Next spawns one prerender worker per CPU (16 on this machine). Each is a
     * separate process, so each one's `getCloudflareContext` call falls through to
     * `getPlatformProxy()`, which starts its OWN miniflare instance - and every one
     * of them opens the same local D1 SQLite file under `.wrangler/state`. The
     * resulting cross-process lock contention makes workerd's D1 return an internal
     * error, surfacing as:
     *
     *   Error: D1_ERROR: Failed to parse body as JSON, got: Error: internal error
     *
     * It aborted the build at a different `/learn-web3/[category]` page every run,
     * which is what a lock race looks like. With one worker there is one miniflare
     * instance and the build completes 122/122. The cost is a slower, serialized
     * static generation - worth it for a build that finishes.
     */
    cpus: 1,
  },
};

export default nextConfig;

initOpenNextCloudflareForDev();
