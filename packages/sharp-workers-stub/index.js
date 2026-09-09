"use strict";

/**
 * A stand-in for `sharp` in the Cloudflare Workers build.
 *
 * WHY THIS EXISTS
 *
 * `sharp` is a native Node addon. The Workers runtime cannot execute `.node`
 * binaries, and esbuild — which bundles the OpenNext worker — cannot even parse
 * one, so `opennextjs-cloudflare build` aborts with:
 *
 *   No loader is configured for ".node" files:
 *     node_modules/@img/sharp-win32-x64/lib/sharp-win32-x64-0.35.4.node
 *
 * Nothing in this repository imports `sharp`. It is reached only from
 * `next/dist/server/image-optimizer.js`, which does a lazy `require("sharp")`
 * inside a function. That call is unreachable here — `next/image` is imported in
 * zero files and `images.unoptimized` is set in apps/web/next.config.ts — but
 * esbuild resolves the require statically regardless of it being lazy.
 *
 * WHY A STUB RATHER THAN A CONFIG OPTION
 *
 * There is no supported way to exclude it. Next's `serverExternalPackages` is the
 * documented mechanism, but OpenNext only applies it to packages that carry
 * workerd build conditions (see `@opennextjs/cloudflare/dist/cli/build/utils/workerd.js`),
 * which `sharp` does not. The upstream request to stub `.node` addons automatically
 * is open and unresolved:
 *   https://github.com/opennextjs/opennextjs-cloudflare/issues/1226
 *
 * WHEN TO DELETE THIS
 *
 * Remove this package and the `pnpm.overrides.sharp` entry in the root
 * package.json as soon as either becomes true:
 *   - OpenNext ships automatic stubbing or a config hook for native addons; or
 *   - this app starts using `next/image`, in which case image optimization needs a
 *     real solution (Cloudflare Images or a custom loader) and this stub would
 *     silently break it.
 *
 * It throws rather than returning a no-op on purpose: if image optimization is
 * ever genuinely invoked, it should fail loudly here instead of quietly producing
 * broken images.
 */
function sharpUnavailable() {
  throw new Error(
    "sharp is not available in the Cloudflare Workers runtime. " +
      "This build uses the sharp-workers-stub package; see packages/sharp-workers-stub/index.js. " +
      "If you need image optimization, use Cloudflare Images or a custom next/image loader.",
  );
}

module.exports = sharpUnavailable;
module.exports.default = sharpUnavailable;
module.exports.cache = sharpUnavailable;
module.exports.concurrency = sharpUnavailable;
module.exports.format = {};
module.exports.versions = {};
module.exports.simd = sharpUnavailable;
